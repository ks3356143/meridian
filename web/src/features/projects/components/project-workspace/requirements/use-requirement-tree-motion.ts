import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import type { TreeApi } from "react-arborist";
import { gsap, useGSAP } from "@/lib/gsap";

type TreeRow = { outer: HTMLElement; inner: HTMLElement; id: string };

/** 折叠/展开动效请求：事件处理器只登记意图，真正的动画在 layout effect 里播放。 */
type ToggleMotion = {
  direction: "collapse" | "expand";
  nodeId: string;
  /** 是否已经申请过 overscan 扩窗，避免 setState 自循环。 */
  boosted: boolean;
  /** 本次动画最终要扩到的行数；首批只挂一小段，其余在动画期间分批补齐。 */
  fullBoost?: number;
};

type TreeStructureSnapshot = {
  signature: string;
  positions: Map<string, number>;
};

/** 两棵需求树共用的基准 overscan 行数。 */
export const TREE_BASE_OVERSCAN = 12;
/**
 * 参与折叠/展开动画的最大子树行数。
 * 超过这个规模的子树直接切换：为动画把上百行虚拟行挂进 DOM 得不偿失。
 */
const MAX_ANIMATED_BLOCK_ROWS = 200;
/** 首次扩窗行数上限：保证点击后立刻起动画，剩余行在动画期间补。 */
const FIRST_BOOST_ROWS = 24;
/** 剩余扩窗分成几批在动画过程中补齐。 */
const BOOST_CHUNKS = 2;
const TOGGLE_DURATION_MIN = 0.2;
const TOGGLE_DURATION_MAX = 0.36;
const TOGGLE_DURATION_PER_ROW = 0.004;

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function useRequirementTreeMotion<T>({
  treeRef,
  shellRef,
  structureSignature,
  selectedTreeId,
}: {
  treeRef: RefObject<TreeApi<T> | null>;
  shellRef: RefObject<HTMLElement | null>;
  structureSignature: string;
  selectedTreeId?: string;
}) {
  const requestTreeExitRef = useRef((_id: string) => Promise.resolve());
  const structureSnapshotRef = useRef<TreeStructureSnapshot | null>(null);
  const structureSignatureRef = useRef(structureSignature);
  const previousSelectedTreeIdRef = useRef(selectedTreeId);
  const [toggleMotion, setToggleMotion] = useState<ToggleMotion | null>(null);
  const [overscanBoost, setOverscanBoost] = useState(0);
  const overscanBoostRef = useRef(0);
  const activeToggleRef = useRef<{ finish: () => void } | null>(null);
  const toggleMotionActiveRef = useRef(false);
  const boostResetTimerRef = useRef<number | null>(null);
  overscanBoostRef.current = overscanBoost;

  // 扩窗后的渲染窗口保留一小段时间：连续折叠/展开同一个节点时不必反复挂载、卸载同一批行。
  const scheduleBoostReset = useCallback(() => {
    if (boostResetTimerRef.current !== null) window.clearTimeout(boostResetTimerRef.current);
    boostResetTimerRef.current = window.setTimeout(() => {
      boostResetTimerRef.current = null;
      setOverscanBoost(0);
    }, 1500);
  }, []);

  const cancelBoostReset = useCallback(() => {
    if (boostResetTimerRef.current === null) return;
    window.clearTimeout(boostResetTimerRef.current);
    boostResetTimerRef.current = null;
  }, []);

  useEffect(
    () => () => {
      if (boostResetTimerRef.current !== null) window.clearTimeout(boostResetTimerRef.current);
    },
    [],
  );

  // 维护「当前是否存在纵向滚动条」标记：无滚动条时 CSS 会补上行内容右内边距，
  // 让徽章到面板右边缘的距离与有滚动条时一致（行盒子仍满宽，hover/选中底色不会缺角）。
  const syncScrollbarStateRef = useRef<(() => void) | null>(null);
  useLayoutEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    const scroller = getTreeScroller(shell);
    if (!scroller) return;

    const sync = () => {
      if (shell.dataset.motion === "true") return;
      const scrollbarWidth = scroller.offsetWidth - scroller.clientWidth;
      shell.dataset.hasScrollbar = scrollbarWidth > 0 ? "true" : "false";
      if (scrollbarWidth > 0) {
        shell.style.setProperty("--tree-scrollbar-width", `${scrollbarWidth}px`);
      }
    };

    syncScrollbarStateRef.current = sync;
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(scroller);

    return () => {
      syncScrollbarStateRef.current = null;
      observer.disconnect();
    };
  }, [shellRef, structureSignature]);

  structureSignatureRef.current = structureSignature;

  useLayoutEffect(() => {
    const shell = shellRef.current;
    const previousTreeId = previousSelectedTreeIdRef.current;
    previousSelectedTreeIdRef.current = selectedTreeId;

    if (!shell || !selectedTreeId || selectedTreeId === previousTreeId) return;

    const row = Array.from(shell.querySelectorAll<HTMLElement>("[data-node-id]")).find(
      (item) => item.dataset.nodeId === selectedTreeId,
    );
    if (!row) return;

    row.dataset.selectionMotion = "true";
    const timer = window.setTimeout(() => {
      delete row.dataset.selectionMotion;
    }, 320);

    return () => {
      window.clearTimeout(timer);
      delete row.dataset.selectionMotion;
    };
  }, [selectedTreeId, shellRef]);

  useGSAP(
    (_context, contextSafe) => {
      const shell = shellRef.current;
      const makeSafe = contextSafe ?? ((callback: (id: string) => void) => callback);

      const requestTreeExit = (id: string) =>
        new Promise<void>((resolve) => {
          if (!shell || prefersReducedMotion()) {
            resolve();
            return;
          }

          const row = getTreeRows(shell).find((item) => item.id === `requirement:${id}`);
          if (!row) {
            resolve();
            return;
          }

          gsap.killTweensOf(row.inner);
          gsap.to(row.inner, {
            autoAlpha: 0,
            duration: 0.16,
            ease: "power1.in",
            onComplete: () => resolve(),
            onInterrupt: () => resolve(),
          });
        });
      requestTreeExitRef.current = makeSafe(requestTreeExit) as typeof requestTreeExit;

      if (!shell) return;
      // 折叠/展开动画进行中：结构变化不抢动画，等动画收尾后由 cleanup 刷新快照。
      if (toggleMotionActiveRef.current) return;
      syncStructureMotion(shell, structureSignature, structureSnapshotRef);
    },
    { dependencies: [structureSignature], scope: shellRef },
  );

  const requestTreeToggle = useCallback(
    (id: string) => {
      const tree = treeRef.current;
      const shell = shellRef.current;
      if (!tree) return;

      const node = tree.get(id);
      if (!node || node.isLeaf) {
        node?.toggle();
        return;
      }

      cancelBoostReset();
      // 已有动画在跑：先让它立即落到终态，避免两段动画互相打断。
      const active = activeToggleRef.current;
      if (active) {
        activeToggleRef.current = null;
        active.finish();
      }

      if (!shell || prefersReducedMotion()) {
        node.toggle();
        return;
      }

      const rows = getTreeRows(shell);
      const targetIndex = rows.findIndex((row) => row.id === id);
      if (targetIndex < 0) {
        node.toggle();
        return;
      }

      if (node.isOpen) {
        const blockCount = countVisibleDescendants(tree, id);
        // 子树规模超出动画上限：直接切换，不为动画挂载大量虚拟行。
        if (!blockCount || blockCount > MAX_ANIMATED_BLOCK_ROWS) {
          node.toggle();
          return;
        }

        const neededBoost = resolveOverscanBoost(
          Math.min(blockCount, countRowsBelowWindow(tree, rows)),
          0,
        );
        const initialBoost = Math.min(neededBoost, FIRST_BOOST_ROWS);
        if (initialBoost > 0) setOverscanBoost(initialBoost);
        setToggleMotion({
          direction: "collapse",
          nodeId: id,
          boosted: initialBoost > 0,
          fullBoost: neededBoost,
        });
        return;
      }

      // 展开要在同一个提交里决定扩窗量：等 render 后再补一次 setState 会多一个提交，
      // 第二次提交又会触发一次整树布局（实测展开比折叠多 40ms 左右就来自这里）。
      const expansionCount = countExpandableRows(tree, id);
      tree.open(id);
      const neededBoost = resolveOverscanBoost(
        Math.min(expansionCount, countRowsBelowWindow(tree, rows)),
        0,
      );
      const initialBoost = Math.min(neededBoost, FIRST_BOOST_ROWS);
      if (initialBoost > 0) setOverscanBoost(initialBoost);
      setToggleMotion({
        direction: "expand",
        nodeId: id,
        boosted: initialBoost > 0,
        fullBoost: neededBoost,
      });
    },
    [cancelBoostReset, shellRef, treeRef],
  );

  useLayoutEffect(() => {
    const shell = shellRef.current;
    const tree = treeRef.current;

    if (!shell || !tree || !toggleMotion) {
      toggleMotionActiveRef.current = false;
      return;
    }

    toggleMotionActiveRef.current = true;
    const rowHeight = resolveRowHeight(tree);
    const rows = getTreeRows(shell);
    const targetIndex = rows.findIndex((row) => row.id === toggleMotion.nodeId);

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      activeToggleRef.current = null;
      toggleMotionActiveRef.current = false;
      if (toggleMotion.direction === "collapse") {
        const node = tree.get(toggleMotion.nodeId);
        if (node?.isOpen) tree.close(toggleMotion.nodeId);
      }
      setToggleMotion(null);
      scheduleBoostReset();
    };

    if (targetIndex < 0) {
      finish();
      return;
    }

    const blockCount = countVisibleDescendants(tree, toggleMotion.nodeId);
    if (!blockCount || blockCount > MAX_ANIMATED_BLOCK_ROWS) {
      finish();
      return;
    }

    // 两个方向都需要扩窗：折叠时后续行上移进入视口，展开时后续行被压到裁剪线下方，
    // 这两段内容原本都在渲染窗口之外，不提前挂进 DOM 就会出现空白。
    // 扩窗量取「子树行数」与「渲染窗口下方剩余行数」的较小值：
    // 只要能覆盖会进入视口的那段位移即可，不必按整棵子树去挂载。
    // 两个方向都需要扩窗：折叠时后续行上移进入视口，展开时后续行被压到裁剪线下方。
    // 首批只挂 FIRST_BOOST_ROWS 行，保证点击后立刻起动画；其余行在动画期间分批补齐。
    const neededBoost = resolveOverscanBoost(
      Math.min(blockCount, countRowsBelowWindow(tree, rows)),
      0,
    );
    if (!toggleMotion.boosted && neededBoost > overscanBoostRef.current) {
      setOverscanBoost(Math.min(neededBoost, FIRST_BOOST_ROWS));
      setToggleMotion({ ...toggleMotion, boosted: true, fullBoost: neededBoost });
      return;
    }

    const targetRow = rows[targetIndex];
    const innerEl = targetRow.outer.parentElement;
    const blockHeight = blockCount * rowHeight;
    // 先批量读完所有坐标，再统一写样式：读写交错会让每一行都触发一次强制同步布局。
    const innerStartHeight = innerEl ? resolveElementHeight(innerEl) : 0;
    const blockTop = resolveRowTop(targetRow.outer) + rowHeight;
    const scrollerMetrics = measureScroller(shell);
    // 动画结束时内容会不会超出视口：会的话提前占住滚动条槽位，
    // 否则滚动条会在动画中途冒出来，把行宽挤掉 10px（徽章会跳）。
    const finalRowCount =
      toggleMotion.direction === "collapse"
        ? tree.visibleNodes.length - blockCount
        : tree.visibleNodes.length + blockCount;
    const keepScrollbarGutter =
      scrollerMetrics.hasScrollbar || finalRowCount * rowHeight > scrollerMetrics.viewportHeight;
    const direction = toggleMotion.direction;
    // 子树比视口高时，位移的前半段发生在视口外：按可视比例重排时间，
    // 否则大子树会先“静止”一大半时间，再在末尾飞快擦掉。
    const visibleBottom = scrollerMetrics.scrollTop + scrollerMetrics.viewportHeight;
    const offscreenRatio = clampRatio((blockTop + blockHeight - visibleBottom) / blockHeight);

    applyMotionMarks(shell, tree, toggleMotion.nodeId, rowHeight);
    markTreeMotion(shell, keepScrollbarGutter);

    const apply = (progress: number) => {
      const moved = remapOffscreenTravel(progress, direction, offscreenRatio);
      // 折叠：裁剪线从子树底部升到顶部；展开：从顶部降到子树底部。
      const line = direction === "collapse" ? blockHeight * (1 - moved) : blockHeight * moved;
      // 折叠时后续行继续上移；展开时后续行先退回“展开前”的位置再落回原位。
      // 位移量与裁剪线共用同一个 travel，两边不同步就会表现为重影。
      const travel = direction === "collapse" ? moved : 1 - moved;
      shell.style.setProperty("--tree-motion-line", `${line}px`);
      shell.style.setProperty("--tree-motion-shift", `${-blockHeight * travel}px`);
      if (innerEl) {
        const nextHeight = innerStartHeight - blockHeight * travel;
        innerEl.style.height = `${Math.max(0, nextHeight)}px`;
      }
    };
    apply(0);

    const proxy = { progress: 0 };
    const duration = Math.min(
      TOGGLE_DURATION_MAX,
      TOGGLE_DURATION_MIN + blockCount * TOGGLE_DURATION_PER_ROW,
    );
    const tween = gsap.to(proxy, {
      progress: 1,
      duration,
      ease: "power2.out",
      onUpdate: () => apply(proxy.progress),
      onComplete: finish,
    });

    activeToggleRef.current = {
      finish: () => {
        tween.progress(1, true);
        finish();
      },
    };

    // 剩余扩窗在动画进行中分两批补齐：每批只挂十几行，动画不会因为一次性挂载而顿住。
    const boostTimers: number[] = [];
    const pendingBoost =
      (toggleMotion.fullBoost ?? overscanBoostRef.current) - overscanBoostRef.current;
    if (pendingBoost > 0) {
      const chunk = Math.ceil(pendingBoost / BOOST_CHUNKS);
      for (let index = 1; index <= BOOST_CHUNKS; index += 1) {
        boostTimers.push(
          window.setTimeout(
            () =>
              setOverscanBoost((current) =>
                Math.min(toggleMotion.fullBoost ?? current + chunk, current + chunk),
              ),
            Math.round((duration * 1000 * index) / (BOOST_CHUNKS + 1)),
          ),
        );
      }
    }

    return () => {
      for (const timer of boostTimers) window.clearTimeout(timer);
      tween.kill();
      clearToggleArtifacts(shell);
      // 动画期间会跳过滚动条状态同步，收尾后补一次，避免标记停留在动画中状态。
      syncScrollbarStateRef.current?.();
      structureSnapshotRef.current = {
        signature: structureSignatureRef.current,
        positions: snapshotPositions(getTreeRows(shell)),
      };
    };
    // toggleMotion 是唯一的驱动源；overscanBoost / structureSignature 通过 ref 读取，
    // 避免分批扩窗或结构变化把动画重启。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toggleMotion, shellRef, treeRef]);

  // 分批扩窗后新挂载的行也要带上裁剪/位移标记，否则它们会在动画中途“跳”进最终位置。
  // 标记写入是幂等的，扩窗量每变一次就补一次。
  useLayoutEffect(() => {
    const shell = shellRef.current;
    const tree = treeRef.current;
    if (!shell || !tree || !toggleMotion) return;
    applyMotionMarks(shell, tree, toggleMotion.nodeId, resolveRowHeight(tree));
  }, [toggleMotion, overscanBoost, shellRef, treeRef]);

  return {
    overscanBoost,
    requestTreeToggle,
    requestTreeExit: (id: string) => requestTreeExitRef.current(id),
  };
}

/** 目标节点在受控展开状态下可见的子树行数。 */
function countVisibleDescendants<T>(tree: TreeApi<T>, id: string) {
  const nodes = tree.visibleNodes;
  const index = nodes.findIndex((node) => node.id === id);
  if (index < 0) return 0;

  const level = nodes[index].level;
  let count = 0;
  for (let cursor = index + 1; cursor < nodes.length; cursor += 1) {
    if (nodes[cursor].level <= level) break;
    count += 1;
  }
  return count;
}

/**
 * 动画会把子树整体位移 blockCount 行，需要保证这段距离内的行已经挂进 DOM，
 * 否则动画中段会出现空白。基准 overscan 已经覆盖短距离位移。
 */
/**
 * 按数据模型推算「展开后会有多少行可见」，用于在渲染前决定扩窗量。
 * 子节点默认展开状态取 `openByDefault`，用户折叠过的节点在 openState 里为 false。
 */
function countExpandableRows<T>(tree: TreeApi<T>, id: string) {
  const node = tree.get(id);
  if (!node) return 0;

  const openState = tree.openState as Record<string, boolean> | undefined;
  const openByDefault = Boolean(tree.props.openByDefault);
  type RawNode = { key?: string; children?: RawNode[] };
  const children = (node.data as { children?: RawNode[] } | undefined)?.children;
  if (!children?.length) return 0;

  let count = 0;
  const walk = (items: RawNode[]) => {
    for (const item of items) {
      count += 1;
      if (!item.children?.length) continue;
      const expanded = item.key ? (openState?.[item.key] ?? openByDefault) : openByDefault;
      if (expanded) walk(item.children);
    }
  };
  walk(children);
  return count;
}

/** 当前渲染窗口下方还剩多少可见行：动画中最多只会把这段内容带进视口。 */
function countRowsBelowWindow<T>(tree: TreeApi<T>, rows: TreeRow[]) {
  const lastId = rows[rows.length - 1]?.id;
  if (!lastId) return 0;
  const index = tree.visibleNodes.findIndex((node) => node.id === lastId);
  if (index < 0) return 0;
  return tree.visibleNodes.length - 1 - index;
}

function resolveOverscanBoost(neededRows: number, currentBoost: number) {
  if (neededRows <= TREE_BASE_OVERSCAN + currentBoost) return currentBoost;
  return Math.min(neededRows, MAX_ANIMATED_BLOCK_ROWS);
}

function resolveRowHeight<T>(tree: TreeApi<T>) {
  const rowHeight = tree.props.rowHeight;
  return typeof rowHeight === "number" && rowHeight > 0 ? rowHeight : 30;
}

/** 从可见节点模型推导「子树行」与「后续行」的 id 集合，不依赖当前渲染窗口。 */
function resolveMotionIdSets<T>(tree: TreeApi<T>, nodeId: string) {
  const nodes = tree.visibleNodes;
  const targetIndex = nodes.findIndex((node) => node.id === nodeId);
  const blockIds = new Set<string>();
  const followIds = new Set<string>();
  if (targetIndex < 0) return { blockIds, followIds };

  const level = nodes[targetIndex].level;
  let blockEnded = false;
  for (let index = targetIndex + 1; index < nodes.length; index += 1) {
    const node = nodes[index];
    if (!blockEnded && node.level <= level) blockEnded = true;
    (blockEnded ? followIds : blockIds).add(node.id);
  }
  return { blockIds, followIds };
}

/**
 * 把动效标记写到当前已渲染的行上：子树行记 `--tree-row-top`（逐行裁剪用），
 * 后续行打 `data-motion-follow`（整体位移用）。幂等，分批扩窗后可重复调用。
 */
function applyMotionMarks<T>(
  shell: HTMLElement,
  tree: TreeApi<T>,
  nodeId: string,
  rowHeight: number,
) {
  const { blockIds, followIds } = resolveMotionIdSets(tree, nodeId);
  if (!blockIds.size) return;

  const blockRows: Array<{ outer: HTMLElement; top: number }> = [];
  for (const row of getTreeRows(shell)) {
    if (blockIds.has(row.id)) blockRows.push({ outer: row.outer, top: resolveRowTop(row.outer) });
    else if (followIds.has(row.id)) row.outer.dataset.motionFollow = "true";
  }
  if (!blockRows.length) return;

  const base = Math.min(...blockRows.map((row) => row.top));
  for (const row of blockRows) {
    row.outer.dataset.motionBlock = "true";
    row.outer.style.setProperty("--tree-row-top", `${row.top - base}px`);
  }
  shell.style.setProperty("--tree-row-h", `${rowHeight}px`);
}

function syncStructureMotion(
  shell: HTMLElement,
  signature: string,
  snapshotRef: RefObject<TreeStructureSnapshot | null>,
) {
  const rows = getTreeRows(shell);
  const previous = snapshotRef.current;
  if (previous?.signature === signature) return;
  const reducedMotion = prefersReducedMotion();

  prepareForCapture(rows);
  const animations: Array<{ el: HTMLElement; dy: number }> = [];
  for (const row of rows) {
    if (!previous || reducedMotion) continue;
    const previousTop = previous.positions.get(row.id);
    if (previousTop == null) continue;
    // 快照与当前值都用内联 top：混用 getBoundingClientRect 会带上 padding 常量误差。
    const dy = previousTop - resolveRowTop(row.outer);
    if (Math.abs(dy) > 0.5) animations.push({ el: row.outer, dy });
  }

  if (animations.length) {
    gsap.fromTo(
      animations.map((item) => item.el),
      { y: (index: number) => animations[index].dy },
      {
        y: 0,
        duration: 0.2,
        ease: "power2.out",
        clearProps: "transform",
      },
    );
  }

  if (previous && rows.length && !reducedMotion) {
    const enteringRows = rows
      .filter((row) => !previous.positions.has(row.id))
      .map((row) => row.inner);
    if (enteringRows.length) {
      gsap.fromTo(
        enteringRows,
        { autoAlpha: 0 },
        {
          autoAlpha: 1,
          clearProps: "opacity,visibility,transform",
          duration: 0.18,
          ease: "power2.out",
        },
      );
    }
  }

  snapshotRef.current = { signature, positions: snapshotPositions(rows) };
}

function snapshotPositions(rows: TreeRow[]) {
  const positions = new Map<string, number>();
  for (const row of rows) {
    positions.set(row.id, resolveRowTop(row.outer));
  }
  return positions;
}

function getTreeScroller(shell: HTMLElement): HTMLElement | null {
  const row = shell.querySelector<HTMLElement>("[role='treeitem']");
  let element = row?.parentElement ?? null;
  while (element && element !== shell) {
    if (getComputedStyle(element).overflowY === "auto") return element;
    element = element.parentElement;
  }
  return null;
}

/** 读取行在滚动内容里的基准位置；react-window 总是写内联 top，不需要触发布局。 */
function resolveRowTop(outer: HTMLElement) {
  const inlineTop = Number.parseFloat(outer.style.top);
  if (Number.isFinite(inlineTop)) return inlineTop;
  return outer.getBoundingClientRect().top;
}

function resolveElementHeight(element: HTMLElement) {
  const inlineHeight = Number.parseFloat(element.style.height);
  if (Number.isFinite(inlineHeight)) return inlineHeight;
  return element.getBoundingClientRect().height;
}

/** 动画开始前一次性量好滚动条与视口；提前量好，避免和样式写入交错造成强制同步布局。 */
function measureScroller(shell: HTMLElement) {
  const scroller = getTreeScroller(shell);
  if (!scroller) return { hasScrollbar: false, scrollTop: 0, viewportHeight: 0 };
  return {
    hasScrollbar: scroller.offsetWidth - scroller.clientWidth > 0,
    scrollTop: scroller.scrollTop,
    viewportHeight: scroller.clientHeight,
  };
}

function clampRatio(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(0.85, Math.max(0, value));
}

/**
 * 把线性进度映射成位移进度：视口外的那段位移只占用固定的一小段时间，
 * 保证肉眼可见的部分拿到绝大部分时长。
 */
function remapOffscreenTravel(
  progress: number,
  direction: "collapse" | "expand",
  offscreenRatio: number,
) {
  if (offscreenRatio <= 0.001) return progress;
  const slice = 0.26;
  if (direction === "collapse") {
    if (progress <= slice) return (progress / slice) * offscreenRatio;
    return offscreenRatio + (1 - offscreenRatio) * ((progress - slice) / (1 - slice));
  }
  const lead = 1 - slice;
  if (progress <= lead) return (progress / lead) * (1 - offscreenRatio);
  return 1 - offscreenRatio + ((progress - lead) / slice) * offscreenRatio;
}

function markTreeMotion(shell: HTMLElement, keepScrollbarGutter: boolean) {
  if (keepScrollbarGutter) {
    shell.dataset.scrollbar = "true";
  } else {
    delete shell.dataset.scrollbar;
  }
  shell.dataset.motion = "true";
}

function clearToggleArtifacts(shell: HTMLElement) {
  shell.style.removeProperty("--tree-motion-line");
  shell.style.removeProperty("--tree-motion-shift");
  shell.style.removeProperty("--tree-row-h");
  for (const element of shell.querySelectorAll<HTMLElement>(
    "[data-motion-block], [data-motion-follow]",
  )) {
    delete element.dataset.motionBlock;
    delete element.dataset.motionFollow;
    element.style.removeProperty("--tree-row-top");
  }
  clearTreeMotion(shell);
}

function clearTreeMotion(shell: HTMLElement) {
  delete shell.dataset.motion;
  delete shell.dataset.scrollbar;
}

function getTreeRows(shell: HTMLElement): TreeRow[] {
  const rows: TreeRow[] = [];
  for (const inner of shell.querySelectorAll<HTMLElement>("[data-tree-row]")) {
    const outer = inner.parentElement;
    const id = inner.dataset.nodeId;
    if (outer && id) rows.push({ outer, inner, id });
  }
  return rows;
}

function prepareForCapture(rows: TreeRow[]) {
  const outers = rows.map((row) => row.outer);
  const inners = rows.map((row) => row.inner);
  gsap.killTweensOf(outers);
  gsap.killTweensOf(inners);
  gsap.set(outers, { clearProps: "transform" });
  gsap.set(inners, { clearProps: "opacity,visibility,transform" });
}

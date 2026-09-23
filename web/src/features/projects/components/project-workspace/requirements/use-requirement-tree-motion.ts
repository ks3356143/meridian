import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { flushSync } from "react-dom";
import type { TreeApi } from "react-arborist";
import { Flip, gsap, useGSAP } from "@/lib/gsap";

type TreeFlipState = ReturnType<typeof Flip.getState>;

type TreeRow = { outer: HTMLElement; inner: HTMLElement; id: string };
type TreeMotionRequest = { previousIds: Set<string>; state: TreeFlipState };
type TreeStructureSnapshot = {
  signature: string;
  ids: Set<string>;
  state: TreeFlipState;
};

export function useRequirementTreeMotion<T>({
  treeRef,
  shellRef,
  structureSignature,
  selectedTreeId,
}: {
  treeRef: RefObject<TreeApi<T> | null>;
  shellRef: RefObject<HTMLDivElement | null>;
  structureSignature: string;
  selectedTreeId?: string;
}) {
  const requestTreeToggleRef = useRef((_id: string) => {});
  const requestTreeExitRef = useRef((_id: string) => Promise.resolve());
  const [motionRequest, setMotionRequest] = useState<TreeMotionRequest | null>(null);
  const structureSnapshotRef = useRef<TreeStructureSnapshot | null>(null);
  const previousSelectedTreeIdRef = useRef(selectedTreeId);

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
          if (!shell || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
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

      requestTreeToggleRef.current = makeSafe((id: string) => {
        const tree = treeRef.current;
        if (!tree) return;

        const node = tree.get(id);
        if (!node || node.isLeaf || !shell) {
          node?.toggle();
          return;
        }

        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          node.toggle();
          return;
        }

        const rows = getTreeRows(shell);
        if (!rows.length) {
          node.toggle();
          return;
        }

        prepareForCapture(rows);
        const state = Flip.getState(
          rows.map((row) => row.outer),
          { simple: true },
        );
        shell.dataset.motion = "true";

        if (node.isOpen) {
          const descendants = getVisibleDescendantRows(tree, shell, id);
          if (!descendants.length) {
            delete shell.dataset.motion;
            tree.close(id);
            return;
          }

          gsap.to(
            descendants.map((row) => row.inner),
            {
              autoAlpha: 0,
              duration: 0.16,
              ease: "power1.in",
              stagger: 0.003,
              onComplete: () => {
                flushSync(() => tree.close(id));

                let released = false;
                const releaseMotion = () => {
                  if (released) return;
                  released = true;
                  delete shell.dataset.motion;
                };
                const nextRows = getTreeRows(shell);
                prepareForCapture(nextRows);
                Flip.from(state, {
                  duration: 0.2,
                  ease: "power2.out",
                  scale: false,
                  targets: nextRows.map((row) => row.outer),
                  onComplete: releaseMotion,
                  onInterrupt: releaseMotion,
                });
              },
            },
          );
          return;
        }

        const previousIds = new Set(rows.map((row) => row.id));
        tree.open(id);
        setMotionRequest({ previousIds, state });
      });

      if (shell) {
        syncStructureMotion(shell, structureSignature, structureSnapshotRef);
      }

      if (!motionRequest || !shell) return;

      const rows = getTreeRows(shell);
      let released = false;
      const releaseMotion = () => {
        if (released) return;
        released = true;
        delete shell.dataset.motion;
        setMotionRequest(null);
      };

      prepareForCapture(rows);
      const enteringRows = rows
        .filter((row) => !motionRequest.previousIds.has(row.id))
        .map((row) => row.inner);
      const movingRows = rows.filter((row) => motionRequest.previousIds.has(row.id));

      if (enteringRows.length) {
        gsap.set(enteringRows, { autoAlpha: 0 });
      }

      Flip.from(motionRequest.state, {
        duration: 0.2,
        ease: "power2.out",
        scale: false,
        targets: movingRows.map((row) => row.outer),
        onComplete: () => {
          if (!enteringRows.length) {
            releaseMotion();
            return;
          }

          gsap.fromTo(
            enteringRows,
            { autoAlpha: 0 },
            {
              autoAlpha: 1,
              clearProps: "opacity,visibility,transform",
              duration: 0.18,
              ease: "power2.out",
              stagger: 0.003,
              onComplete: releaseMotion,
              onInterrupt: releaseMotion,
            },
          );
        },
        onInterrupt: () => {
          if (enteringRows.length) {
            gsap.set(enteringRows, {
              autoAlpha: 1,
              clearProps: "opacity,visibility,transform",
            });
          }
          releaseMotion();
        },
      });
    },
    { dependencies: [motionRequest, structureSignature], scope: shellRef },
  );

  return {
    requestTreeToggle: (id: string) => requestTreeToggleRef.current(id),
    requestTreeExit: (id: string) => requestTreeExitRef.current(id),
  };
}

function syncStructureMotion(
  shell: HTMLElement,
  signature: string,
  snapshotRef: RefObject<TreeStructureSnapshot | null>,
) {
  const rows = getTreeRows(shell);
  const previous = snapshotRef.current;
  if (previous?.signature === signature) return;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (previous && rows.length && !reducedMotion) {
    prepareForCapture(rows);
    Flip.from(previous.state, {
      duration: 0.2,
      ease: "power2.out",
      scale: false,
      targets: rows.map((row) => row.outer),
    });

    const enteringRows = rows.filter((row) => !previous.ids.has(row.id)).map((row) => row.inner);
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

  snapshotRef.current = {
    signature,
    ids: new Set(rows.map((row) => row.id)),
    state: Flip.getState(
      rows.map((row) => row.outer),
      { simple: true },
    ),
  };
}

function getTreeRows(shell: HTMLElement): TreeRow[] {
  return Array.from(shell.querySelectorAll<HTMLElement>("[role='treeitem']")).flatMap((outer) => {
    const inner = outer.querySelector<HTMLElement>("[data-tree-row]");
    const id = inner?.dataset.nodeId;
    if (!inner || !id) return [];
    return [{ outer, inner, id }];
  });
}

function prepareForCapture(rows: TreeRow[]) {
  const outers = rows.map((row) => row.outer);
  const inners = rows.map((row) => row.inner);
  Flip.killFlipsOf(outers);
  gsap.killTweensOf(inners);
  gsap.set(inners, { clearProps: "opacity,visibility,transform" });
}

function getVisibleDescendantRows<T>(tree: TreeApi<T>, shell: HTMLElement, id: string): TreeRow[] {
  const node = tree.get(id);
  if (!node) return [];

  const targetIndex = tree.visibleNodes.findIndex((visibleNode) => visibleNode.id === id);
  if (targetIndex < 0) return [];

  const descendantIds = new Set<string>();
  for (let index = targetIndex + 1; index < tree.visibleNodes.length; index += 1) {
    const current = tree.visibleNodes[index];
    if (current.level <= node.level) break;
    descendantIds.add(current.id);
  }

  if (!descendantIds.size) return [];
  return getTreeRows(shell).filter((row) => descendantIds.has(row.id));
}

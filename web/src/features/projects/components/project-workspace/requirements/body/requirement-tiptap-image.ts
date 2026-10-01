import { mergeAttributes, Node, type NodeViewRendererProps } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { EditorView, NodeView } from "@tiptap/pm/view";
import { requestBlob } from "@/api/client";
import type { RequirementAsset } from "@/features/requirements/types";
import styles from "./requirement-body-editor.module.css";

// 图片内容块扩展：schema、NodeView（替换/删除/加载占位）与对齐归一化。
// 与表格/段落扩展分开，便于富文本复用时按需裁剪。
type AssetImageOptions = {
  projectCode: string;
  upload: (file: File) => Promise<RequirementAsset>;
};

export const AssetImage = Node.create<AssetImageOptions>({
  name: "assetImage",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,
  addOptions() {
    return {
      projectCode: "",
      upload: async () => {
        throw new Error("附件上传未配置");
      },
    };
  },
  addAttributes() {
    return {
      assetId: { default: null },
      src: { default: null },
      alt: { default: null },
      width: { default: null },
      height: { default: null },
      align: { default: null },
    };
  },
  parseHTML() {
    return [{ tag: "img[data-asset-id]" }, { tag: "img" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "img",
      mergeAttributes({
        "data-asset-id": HTMLAttributes.assetId,
        src: HTMLAttributes.src,
        alt: HTMLAttributes.alt,
        width: HTMLAttributes.width,
        height: HTMLAttributes.height,
      }),
    ];
  },
  addNodeView() {
    return (props) => new AssetImageNodeView(props);
  },
});

class AssetImageNodeView implements NodeView {
  dom: HTMLDivElement;

  private node: ProseMirrorNode;

  private view: EditorView;

  private getPos: () => number | undefined;

  private options: AssetImageOptions;

  private preview: HTMLDivElement;

  private placeholder: HTMLSpanElement;

  private actions: HTMLDivElement;

  private fileInput: HTMLInputElement;

  private events = new AbortController();

  private loadController: AbortController | null = null;

  private objectUrl: string | null = null;

  private destroyed = false;

  constructor(props: NodeViewRendererProps) {
    this.node = props.node;
    this.view = props.view;
    this.getPos = props.getPos;
    this.options = props.extension.options as AssetImageOptions;
    this.dom = document.createElement("div");
    this.dom.className = styles.imageNode;

    this.preview = document.createElement("div");
    this.preview.className = styles.imageNodePreview;
    this.placeholder = document.createElement("span");
    this.preview.append(this.placeholder);
    this.dom.append(this.preview);

    this.actions = document.createElement("div");
    this.actions.className = styles.imageNodeActions;
    this.fileInput = document.createElement("input");
    this.fileInput.className = styles.hiddenInput;
    this.fileInput.type = "file";
    this.fileInput.accept = "image/png,image/jpeg,image/webp,image/gif";
    this.fileInput.addEventListener("change", this.handleFileChange, {
      signal: this.events.signal,
    });

    const replaceButton = document.createElement("button");
    replaceButton.type = "button";
    replaceButton.className = styles.imageActionButton;
    replaceButton.textContent = "替换";
    replaceButton.addEventListener("click", this.handleReplaceClick, {
      signal: this.events.signal,
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = styles.imageActionButton;
    deleteButton.textContent = "删除";
    deleteButton.addEventListener(
      "click",
      () => {
        const pos = this.getPos();
        if (typeof pos === "number") {
          this.view.dispatch(this.view.state.tr.delete(pos, pos + this.node.nodeSize));
        }
      },
      { signal: this.events.signal },
    );

    this.actions.append(this.fileInput, replaceButton, deleteButton);
    this.dom.append(this.actions);
    this.render();
    this.syncAlign();
  }

  update(node: ProseMirrorNode) {
    if (node.type !== this.node.type) return false;
    const previous = this.node;
    this.node = node;
    this.syncAlign();
    const imageChanged =
      previous.attrs.assetId !== node.attrs.assetId ||
      previous.attrs.src !== node.attrs.src ||
      previous.attrs.alt !== node.attrs.alt ||
      previous.attrs.width !== node.attrs.width ||
      previous.attrs.height !== node.attrs.height;
    if (imageChanged) this.render();
    return true;
  }

  selectNode() {
    this.dom.dataset.selected = "true";
  }

  deselectNode() {
    delete this.dom.dataset.selected;
  }

  destroy() {
    this.destroyed = true;
    this.events.abort();
    this.loadController?.abort();
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
  }

  private syncAlign() {
    const align = normalizeImageAlign(this.node.attrs.align);
    if (align) this.dom.dataset.align = align;
    else delete this.dom.dataset.align;
  }

  private handleReplaceClick = () => {
    this.fileInput.click();
  };

  private handleFileChange = () => {
    const file = this.fileInput.files?.[0];
    if (!file) return;
    this.fileInput.value = "";
    void this.upload(file);
  };

  private async upload(file: File) {
    this.showPlaceholder("正在上传图片…");
    try {
      const uploaded = await this.options.upload(file);
      if (this.destroyed) return;
      const pos = this.getPos();
      if (typeof pos !== "number") return;
      this.view.dispatch(
        this.view.state.tr.setNodeMarkup(pos, undefined, {
          ...this.node.attrs,
          assetId: uploaded.id,
          src: null,
          width: `${uploaded.width}px`,
          height: `${uploaded.height}px`,
        }),
      );
    } catch {
      if (!this.destroyed) this.showPlaceholder("图片上传失败，请重试。");
    }
  }

  private render() {
    this.loadController?.abort();
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }

    const assetId = typeof this.node.attrs.assetId === "string" ? this.node.attrs.assetId : "";
    const pastedSource = typeof this.node.attrs.src === "string" ? this.node.attrs.src : "";
    if (pastedSource) {
      this.renderImage(pastedSource);
      return;
    }
    if (!assetId) {
      this.showPlaceholder("图片待上传");
      return;
    }

    const controller = new AbortController();
    this.loadController = controller;
    this.showPlaceholder("图片加载中…");
    const path = `/api/v1/projects/${encodeURIComponent(this.options.projectCode)}/assets/${encodeURIComponent(assetId)}?w=960`;
    void requestBlob(path, controller.signal)
      .then((blob) => {
        if (this.destroyed || controller.signal.aborted) return;
        this.objectUrl = URL.createObjectURL(blob);
        this.renderImage(this.objectUrl);
      })
      .catch(() => {
        if (!this.destroyed && !controller.signal.aborted) {
          this.showPlaceholder("图片加载失败");
        }
      });
  }

  private renderImage(src: string) {
    const img = document.createElement("img");
    img.src = src;
    img.alt = typeof this.node.attrs.alt === "string" ? this.node.attrs.alt : "需求正文图片";
    // 按存储宽度渲染，与只读正文一致；否则会按缩略图原始像素铺满弹窗。
    img.style.width = typeof this.node.attrs.width === "string" ? this.node.attrs.width : "auto";
    img.style.height = "auto";
    img.style.maxWidth = "100%";
    img.addEventListener(
      "error",
      () => {
        if (!this.destroyed) this.showPlaceholder("图片加载失败");
      },
      { signal: this.events.signal },
    );
    delete this.dom.dataset.failed;
    this.preview.replaceChildren(img);
  }

  private showPlaceholder(text: string) {
    this.placeholder.textContent = text;
    if (text.includes("失败")) {
      this.dom.dataset.failed = "true";
    } else {
      delete this.dom.dataset.failed;
    }
    this.preview.replaceChildren(this.placeholder);
  }
}

function normalizeImageAlign(raw: unknown) {
  if (typeof raw !== "string") return "";
  switch (raw.trim().toLowerCase()) {
    case "left":
    case "center":
    case "right":
      return raw.trim().toLowerCase();
    default:
      return "";
  }
}

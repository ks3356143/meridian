import { requirementsApi } from "@/features/requirements/api";
import type { RequirementBlockNode } from "@/features/requirements/types";

export async function materializeAssetImages(
  doc: RequirementBlockNode,
  projectCode: string,
): Promise<RequirementBlockNode> {
  const clone = JSON.parse(JSON.stringify(doc)) as RequirementBlockNode;
  await visitNodes(clone.content ?? [], projectCode);
  return clone;
}

async function visitNodes(nodes: RequirementBlockNode[], projectCode: string) {
  for (const node of nodes) {
    if (node.type === "assetImage") {
      await materializeAssetImage(node, projectCode);
    }
    if (node.content?.length) await visitNodes(node.content, projectCode);
  }
}

async function materializeAssetImage(node: RequirementBlockNode, projectCode: string) {
  const attrs = node.attrs ?? {};
  const assetId = typeof attrs.assetId === "string" ? attrs.assetId.trim() : "";
  if (assetId) return;

  const source = typeof attrs.src === "string" ? attrs.src.trim() : "";
  if (!source) {
    throw new Error("正文中存在未上传的图片，请先替换或删除该图片");
  }
  if (source.startsWith("file:")) {
    throw new Error("Word 粘贴的本地图片无法读取，请使用“替换”按钮重新上传");
  }

  let response: Response;
  try {
    response = await fetch(source);
  } catch {
    throw new Error("图片资源读取失败，请使用“替换”按钮重新上传");
  }
  if (!response.ok) {
    throw new Error("图片资源读取失败，请使用“替换”按钮重新上传");
  }
  const blob = await response.blob();
  const extension = blob.type.split("/")[1] || "png";
  const file = new File([blob], `pasted-image.${extension}`, { type: blob.type });
  const uploaded = await requirementsApi.uploadAsset(projectCode, file);
  node.attrs = {
    ...attrs,
    assetId: uploaded.id,
    width: `${uploaded.width}px`,
    height: `${uploaded.height}px`,
  };
  delete node.attrs.src;
}
// 浏览器不能解码的矢量图格式；正文按 MIME 降级为占位提示，Word 生成侧仍按原格式嵌入。
const VECTOR_IMAGE_LABELS: Record<string, string> = {
  "image/emf": "EMF",
  "image/wmf": "WMF",
};

/** 矢量图占位文案；非矢量图返回 null。 */
export function vectorImageNotice(mimeType: string): string | null {
  const label = VECTOR_IMAGE_LABELS[mimeType.toLowerCase()];
  return label ? `矢量图（${label}）无法在网页预览，请在 Word 中查看` : null;
}

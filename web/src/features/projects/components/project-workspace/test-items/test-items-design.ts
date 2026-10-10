import type { TestItemType } from "@/features/test-items/types";

/** 语义色相（映射到主题里的 primary/info/warning/chart-* token）。 */
export type Tone = "green" | "blue" | "amber" | "violet" | "cyan" | "red";

const CATEGORY_TONES: Record<string, Tone> = {
  静态: "blue",
  功能验证: "green",
  性能强度: "amber",
  环境适配: "violet",
  专项分析: "cyan",
  审查摸底: "red",
};

export function categoryTone(category: string): Tone {
  return CATEGORY_TONES[category] ?? "green";
}

/**
 * 类型选择器模糊搜索用：24 类种子的拼音首字母（管理端可配类型前固定，配好后改为字典字段）。
 * shortcut: 类型字典改为可配置后，拼音挪到 test_item_types 字段并由接口返回。
 */
const TYPE_INITIALS: Record<string, string> = {
  DC: "wdsc dmsc wen dang shen cha",
  SA: "jtfx jing tai fen xi",
  CR: "dmsc dai ma shen cha",
  CW: "dmzc dai ma zou cha",
  SU: "gncs gong neng ce shi",
  IO: "jkcs jie kou ce shi",
  GUI: "rjjhjmcs ren ji jiao hu jie mian ce shi",
  AC: "xncs xing neng ce shi",
  BT: "bjcs bian jie ce shi",
  AT: "ylcs yu liang ce shi",
  ST: "qdcs qiang du ce shi",
  RL: "rlcs rong liang ce shi",
  JR: "jrcs jian rong xing ce shi",
  AZ: "azcs an zhuang xing ce shi",
  HZ: "hczxcs hu cao zuo xing ce shi",
  SE: "aqcs an quan xing ce shi",
  KK: "kkcs ke kao xing ce shi",
  LT: "ljcs luo ji ce shi",
  TT: "sxcs shi xu ce shi",
  PA: "ggfx gong hao fen xi",
  RE: "hfcs hui fu xing ce shi",
  DP: "sjclcs shu ju chu li ce shi",
  DT: "sjsc shu ju shen cha",
  MD: "mdcs mo di ce shi",
};

export function typeSearchText(type: TestItemType) {
  return `${type.code} ${type.name} ${TYPE_INITIALS[type.code] ?? ""} ${type.category}`;
}

/** 类型按类别分组，供类型选择器两列展示。 */
export function groupTypesByCategory(types: TestItemType[]) {
  const groups = new Map<string, TestItemType[]>();
  for (const type of types) {
    const list = groups.get(type.category);
    if (list) list.push(type);
    else groups.set(type.category, [type]);
  }
  return [...groups.entries()];
}

/** 用例状态中文标签（详情表与树上共用）。 */
export function caseStatusLabel(status: string) {
  if (status === "passed") return "通过";
  if (status === "failed") return "未通过";
  return "未执行";
}

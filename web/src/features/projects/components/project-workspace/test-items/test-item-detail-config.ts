export const SECTION_BASIC = "ti-section-basic";
export const SECTION_METHOD = "ti-section-method";
export const SECTION_CASES = "ti-section-cases";
export const DETAIL_INFO = "ti-detail-info";
export const DETAIL_STATIC = "ti-detail-static";

export const SECTION_LINKS = [
  { id: SECTION_BASIC, label: "基本信息" },
  { id: SECTION_METHOD, label: "测试方法" },
  { id: SECTION_CASES, label: "用例概况" },
] as const;

export const PRIORITIES = ["高", "中", "低"] as const;

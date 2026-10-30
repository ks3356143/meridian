export type TestItemsView = "tree" | "coverage" | "trace" | "annotations";

const TEST_ITEMS_VIEWS: TestItemsView[] = ["tree", "coverage", "trace", "annotations"];

export function isTestItemsView(value: string | null): value is TestItemsView {
  return TEST_ITEMS_VIEWS.includes(value as TestItemsView);
}

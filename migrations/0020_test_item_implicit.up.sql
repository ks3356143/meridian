-- 测试项隐含需求标记：允许测试项不关联需求，按隐含需求处理（完善度的追踪关系按已满足计）
-- 2026-10-10

ALTER TABLE test_items ADD COLUMN implicit_requirement INTEGER NOT NULL DEFAULT 0 CHECK (implicit_requirement IN (0, 1));

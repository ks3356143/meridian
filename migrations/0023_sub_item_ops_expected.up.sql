-- 测试子项：操作步骤 / 通过准则（老项目子项字段，1:1 双栏）。
ALTER TABLE test_sub_items ADD COLUMN ops TEXT NOT NULL DEFAULT '';
ALTER TABLE test_sub_items ADD COLUMN expected TEXT NOT NULL DEFAULT '';
-- 用例表补测试说明侧两栏（切片 5b）：终止条件 / 通过准则。
ALTER TABLE test_cases ADD COLUMN termination_text TEXT NOT NULL DEFAULT '';
ALTER TABLE test_cases ADD COLUMN pass_criteria TEXT NOT NULL DEFAULT '';

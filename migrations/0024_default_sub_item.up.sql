-- 文档审查（DC）默认子项与测试项描述（来源：老项目 DC 默认口径，2026-10-10 用户给定）。
-- default_description：测试项默认描述；default_sub_item_name/desc/expected：默认子项的名称/描述/通过准则，
-- 默认子项的操作步骤复用 default_test_method（CPU）与 default_test_method_fpga（FPGA）。
ALTER TABLE test_item_types ADD COLUMN default_description TEXT NOT NULL DEFAULT '';
ALTER TABLE test_item_types ADD COLUMN default_sub_item_name TEXT NOT NULL DEFAULT '';
ALTER TABLE test_item_types ADD COLUMN default_sub_item_desc TEXT NOT NULL DEFAULT '';
ALTER TABLE test_item_types ADD COLUMN default_expected TEXT NOT NULL DEFAULT '';

UPDATE test_item_types
SET default_description = '依据测评大纲附录A中规定的文档审查要求，对被测软件交付的文档进行审查，验证文档的齐套性、规范性、准确性和一致性。',
    default_sub_item_name = '文档审查',
    default_expected = '1）被测软件文档种类齐全，内容完整，描述准确，格式规范；
2）需求文档内容完整，描述准确，格式规范，文档文文一致、文实相符；
3）设计说明文档内容完整，描述准确，格式规范，文档文文一致、文实相符。'
WHERE code = 'DC';

-- 修正历史默认子项（只匹配未被改动过的旧默认行：名称 文档审查方法、描述为默认方法文本、步骤与准则为空）。
UPDATE test_sub_items
SET name = '文档审查',
    description = '',
    ops = (SELECT default_test_method FROM test_item_types WHERE code = 'DC'),
    expected = (SELECT default_expected FROM test_item_types WHERE code = 'DC')
WHERE name = '文档审查方法'
  AND (ops IS NULL OR ops = '')
  AND (expected IS NULL OR expected = '');

-- 回填空的文档审查测试项描述（当前库中只有 R26107 一条 DC 测试项）。
UPDATE test_items
SET description = (SELECT default_description FROM test_item_types WHERE code = 'DC')
WHERE type_code = 'DC' AND (description IS NULL OR description = '');
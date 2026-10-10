UPDATE test_items SET description = '' WHERE type_code = 'DC' AND description = '依据测评大纲附录A中规定的文档审查要求，对被测软件交付的文档进行审查，验证文档的齐套性、规范性、准确性和一致性。';
UPDATE test_sub_items SET name = '文档审查方法', ops = '', expected = '' WHERE name = '文档审查' AND description = '';
ALTER TABLE test_item_types DROP COLUMN default_description;
ALTER TABLE test_item_types DROP COLUMN default_sub_item_name;
ALTER TABLE test_item_types DROP COLUMN default_sub_item_desc;
ALTER TABLE test_item_types DROP COLUMN default_expected;
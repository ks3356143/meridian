-- 边界测试归入「功能验证」类（原照搬老项目放在「性能强度」，2026-10-10 用户确认修正）。
UPDATE test_item_types
SET category = '功能验证', updated_at = datetime('now')
WHERE code = 'BT';

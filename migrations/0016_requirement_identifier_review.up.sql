ALTER TABLE software_requirements
    ADD COLUMN identifier_auto_generated BOOLEAN NOT NULL DEFAULT 0;

-- 历史手动录入数据没有生成来源标记；先纳入待确认池，由用户复核后清除。
UPDATE software_requirements
SET identifier_auto_generated = 1
WHERE origin = 'manual' AND external_identifier <> '';

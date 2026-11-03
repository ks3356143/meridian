-- 同一审查文档类型只允许一张模板；空类型（历史/齐套性）不参与唯一约束。
CREATE UNIQUE INDEX IF NOT EXISTS idx_review_checklist_templates_document_type
    ON review_checklist_templates (document_type)
    WHERE document_type <> '';

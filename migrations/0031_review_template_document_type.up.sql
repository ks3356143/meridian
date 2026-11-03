ALTER TABLE review_checklist_templates ADD COLUMN document_type TEXT NOT NULL DEFAULT '';
ALTER TABLE review_checklist_templates ADD COLUMN document_version TEXT NOT NULL DEFAULT '';

UPDATE review_checklist_templates SET document_type = '齐套性' WHERE code = 'rc-1';
UPDATE review_checklist_templates SET document_type = '需求规格说明' WHERE code = 'rc-2';
UPDATE review_checklist_templates SET document_type = '详细设计' WHERE code = 'rc-3';
UPDATE review_checklist_templates SET document_type = '用户手册' WHERE code = 'rc-4';

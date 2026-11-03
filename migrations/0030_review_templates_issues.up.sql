CREATE TABLE IF NOT EXISTS review_checklist_templates (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    appendix TEXT NOT NULL DEFAULT '',
    condition TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    items_json TEXT NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS issues (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    round_id TEXT NOT NULL,
    round_number INTEGER NOT NULL,
    test_item_id TEXT NOT NULL,
    test_item_identifier TEXT NOT NULL DEFAULT '',
    source_sheet_id TEXT NOT NULL DEFAULT '',
    source_sheet_name TEXT NOT NULL DEFAULT '',
    source_check_id TEXT NOT NULL DEFAULT '',
    source_check_title TEXT NOT NULL DEFAULT '',
    target_document TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    defect_type TEXT NOT NULL DEFAULT '文档问题',
    level TEXT NOT NULL DEFAULT '一般',
    closure_method TEXT NOT NULL DEFAULT '修改文档',
    status TEXT NOT NULL CHECK (status IN ('open', 'closed')),
    closure_note TEXT NOT NULL DEFAULT '',
    created_by TEXT NOT NULL,
    closed_by TEXT,
    closed_at DATETIME,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
    FOREIGN KEY (round_id) REFERENCES test_rounds (id) ON DELETE CASCADE,
    FOREIGN KEY (test_item_id) REFERENCES test_items (id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT,
    FOREIGN KEY (closed_by) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_issues_project_round
    ON issues (project_id, round_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_issues_check
    ON issues (test_item_id, source_check_id);

-- 旧版逐项从「未审」开始；2026-11-03 起 DC 默认全部通过。
-- 只改 DC；CR 仍保留 unreviewed 三态，历史轮次也不应被批量改写。
UPDATE static_test_workbenches
SET payload_json = REPLACE(payload_json, '"result":"unreviewed"', '"result":"passed"')
WHERE kind = 'DC';

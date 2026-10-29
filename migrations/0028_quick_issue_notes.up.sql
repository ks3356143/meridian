CREATE TABLE quick_issue_notes (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    round_id TEXT NOT NULL,
    test_case_id TEXT NOT NULL,
    test_case_step_id TEXT,
    note_text TEXT NOT NULL CHECK (length(trim(note_text)) BETWEEN 1 AND 500),
    screenshot_asset_id TEXT,
    created_by TEXT NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
    FOREIGN KEY (round_id) REFERENCES test_rounds (id) ON DELETE CASCADE,
    FOREIGN KEY (test_case_id) REFERENCES test_cases (id) ON DELETE CASCADE,
    FOREIGN KEY (test_case_step_id) REFERENCES test_case_steps (id) ON DELETE SET NULL,
    FOREIGN KEY (screenshot_asset_id) REFERENCES assets (id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT
);

CREATE INDEX idx_quick_issue_notes_case
    ON quick_issue_notes (test_case_id, created_at DESC);

CREATE INDEX idx_quick_issue_notes_round
    ON quick_issue_notes (round_id, created_at DESC);

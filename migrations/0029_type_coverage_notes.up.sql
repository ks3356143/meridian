CREATE TABLE test_item_type_coverage_notes (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    round_id TEXT NOT NULL,
    type_code TEXT NOT NULL,
    reason_text TEXT NOT NULL CHECK (length(trim(reason_text)) > 0),
    updated_by TEXT NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE (round_id, type_code),
    FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
    FOREIGN KEY (round_id) REFERENCES test_rounds (id) ON DELETE CASCADE,
    FOREIGN KEY (type_code) REFERENCES test_item_types (code) ON DELETE RESTRICT,
    FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE RESTRICT
);

CREATE INDEX idx_type_coverage_notes_project_round
    ON test_item_type_coverage_notes (project_id, round_id);
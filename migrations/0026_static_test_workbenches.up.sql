CREATE TABLE IF NOT EXISTS static_test_workbenches (
    test_item_id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('DC', 'SA', 'CR', 'CW')),
    payload_json TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
    FOREIGN KEY (test_item_id) REFERENCES test_items (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_static_test_workbenches_project
    ON static_test_workbenches (project_id, kind);

CREATE TABLE IF NOT EXISTS project_static_seeds (
    project_id TEXT PRIMARY KEY,
    security_level TEXT NOT NULL,
    platform TEXT NOT NULL,
    seeded_at DATETIME NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
);

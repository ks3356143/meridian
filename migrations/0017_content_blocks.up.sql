CREATE TABLE IF NOT EXISTS content_blocks (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    owner_type TEXT NOT NULL CHECK (owner_type IN (
        'project', 'round', 'requirement', 'test_item', 'test_case', 'issue', 'document_section'
    )),
    owner_id TEXT NOT NULL,
    block_key TEXT NOT NULL,
    body_json TEXT NOT NULL DEFAULT '{"type":"doc","content":[]}',
    payload_json TEXT NOT NULL DEFAULT '{}',
    plain_text TEXT NOT NULL DEFAULT '',
    schema_version INTEGER NOT NULL DEFAULT 1,
    origin TEXT NOT NULL CHECK (origin IN ('manual', 'auto_draft', 'imported')),
    authoring_mode TEXT NOT NULL CHECK (authoring_mode IN ('auto', 'manual', 'mixed')),
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_by TEXT NOT NULL DEFAULT '',
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
    UNIQUE (project_id, owner_type, owner_id, block_key)
);

CREATE INDEX IF NOT EXISTS idx_content_blocks_owner
    ON content_blocks (owner_type, owner_id);

CREATE INDEX IF NOT EXISTS idx_content_blocks_project_key
    ON content_blocks (project_id, block_key);
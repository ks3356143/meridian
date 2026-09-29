CREATE TABLE IF NOT EXISTS assets (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    content_block_id TEXT,
    sha256 TEXT NOT NULL,
    storage_key TEXT NOT NULL,
    mime_type TEXT NOT NULL DEFAULT '',
    file_ext TEXT NOT NULL DEFAULT '',
    file_size INTEGER NOT NULL DEFAULT 0,
    width INTEGER NOT NULL DEFAULT 0,
    height INTEGER NOT NULL DEFAULT 0,
    caption TEXT NOT NULL DEFAULT '',
    created_by TEXT NOT NULL DEFAULT '',
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_assets_project_sha
    ON assets (project_id, sha256);

CREATE INDEX IF NOT EXISTS idx_assets_block
    ON assets (content_block_id);
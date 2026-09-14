CREATE TABLE IF NOT EXISTS work_objects (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    object_kind TEXT NOT NULL CHECK (object_kind IN (
        'srs', 'system_spec', 'development_requirement', 'task_book',
        'technical_requirement', 'code_package', 'other_reference'
    )),
    name TEXT NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE (project_id, object_kind, name COLLATE NOCASE),
    FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_work_objects_project
    ON work_objects (project_id, object_kind, updated_at DESC);

CREATE TABLE IF NOT EXISTS work_object_versions (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    work_object_id TEXT NOT NULL,
    version TEXT NOT NULL,
    platform TEXT NOT NULL DEFAULT 'common'
        CHECK (platform IN ('common', 'cpu', 'fpga')),
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'confirmed')),
    source TEXT NOT NULL,
    received_at TEXT NOT NULL,
    receive_mode TEXT NOT NULL CHECK (receive_mode IN ('email', 'onsite', 'platform', 'other')),
    created_by TEXT NOT NULL DEFAULT '',
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE (work_object_id, version),
    FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
    FOREIGN KEY (work_object_id) REFERENCES work_objects (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_work_object_versions_project_status
    ON work_object_versions (project_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS received_assets (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    work_object_version_id TEXT NOT NULL UNIQUE,
    original_name TEXT NOT NULL,
    storage_path TEXT NOT NULL UNIQUE,
    file_size INTEGER NOT NULL CHECK (file_size >= 0),
    file_type TEXT NOT NULL DEFAULT '',
    mime_type TEXT NOT NULL DEFAULT '',
    sha256 TEXT NOT NULL,
    created_by TEXT NOT NULL DEFAULT '',
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
    FOREIGN KEY (work_object_version_id) REFERENCES work_object_versions (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_received_assets_project
    ON received_assets (project_id, created_at DESC);

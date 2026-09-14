ALTER TABLE work_object_versions RENAME TO work_object_versions_legacy;
ALTER TABLE received_assets RENAME TO received_assets_legacy;

CREATE TABLE work_object_versions (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    work_object_id TEXT NOT NULL,
    version TEXT NOT NULL,
    platform TEXT NOT NULL DEFAULT 'common'
        CHECK (platform IN ('common', 'cpu', 'fpga')),
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'confirmed', 'superseded', 'revoked')),
    superseded_by_version_id TEXT,
    source TEXT NOT NULL,
    received_at TEXT NOT NULL,
    receive_mode TEXT NOT NULL CHECK (receive_mode IN ('email', 'onsite', 'platform', 'other')),
    created_by TEXT NOT NULL DEFAULT '',
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE (work_object_id, version),
    FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
    FOREIGN KEY (work_object_id) REFERENCES work_objects (id) ON DELETE CASCADE,
    FOREIGN KEY (superseded_by_version_id) REFERENCES work_object_versions (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_work_object_versions_project_status
    ON work_object_versions (project_id, status, updated_at DESC);

CREATE TABLE received_assets (
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

INSERT INTO work_object_versions (
    id, project_id, work_object_id, version, platform, status, superseded_by_version_id,
    source, received_at, receive_mode, created_by, created_at, updated_at
)
SELECT
    id, project_id, work_object_id, version, platform, status, NULL,
    source, received_at, receive_mode, created_by, created_at, updated_at
FROM work_object_versions_legacy;

INSERT INTO received_assets (
    id, project_id, work_object_version_id, original_name, storage_path, file_size,
    file_type, mime_type, sha256, created_by, created_at, updated_at
)
SELECT
    id, project_id, work_object_version_id, original_name, storage_path, file_size,
    file_type, mime_type, sha256, created_by, created_at, updated_at
FROM received_assets_legacy;

DROP TABLE received_assets_legacy;
DROP TABLE work_object_versions_legacy;

CREATE TABLE work_object_lifecycle_events (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    work_object_version_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('confirm', 'supersede', 'withdraw', 'restore', 'revoke')),
    from_status TEXT NOT NULL CHECK (from_status IN ('draft', 'confirmed', 'superseded', 'revoked')),
    to_status TEXT NOT NULL CHECK (to_status IN ('draft', 'confirmed', 'superseded', 'revoked')),
    replacement_version_id TEXT,
    reason TEXT NOT NULL,
    operated_by TEXT NOT NULL DEFAULT '',
    operated_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
    FOREIGN KEY (work_object_version_id) REFERENCES work_object_versions (id) ON DELETE CASCADE,
    FOREIGN KEY (replacement_version_id) REFERENCES work_object_versions (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_work_object_lifecycle_version
    ON work_object_lifecycle_events (work_object_version_id, operated_at DESC);

DROP TABLE IF EXISTS work_object_lifecycle_events;

ALTER TABLE work_object_versions RENAME TO work_object_versions_legacy;
ALTER TABLE received_assets RENAME TO received_assets_legacy;

CREATE TABLE work_object_versions (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    work_object_id TEXT NOT NULL,
    version TEXT NOT NULL,
    platform TEXT NOT NULL DEFAULT 'common'
        CHECK (platform IN ('common', 'cpu', 'fpga')),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed')),
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

INSERT INTO work_object_versions (
    id, project_id, work_object_id, version, platform, status,
    source, received_at, receive_mode, created_by, created_at, updated_at
)
SELECT
    id, project_id, work_object_id, version, platform,
    CASE status WHEN 'confirmed' THEN 'confirmed' ELSE 'draft' END,
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

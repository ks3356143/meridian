ALTER TABLE work_object_lifecycle_events RENAME TO work_object_lifecycle_events_legacy;

DROP INDEX IF EXISTS idx_work_object_lifecycle_version;

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

CREATE INDEX idx_work_object_lifecycle_version
    ON work_object_lifecycle_events (work_object_version_id, operated_at DESC);

INSERT INTO work_object_lifecycle_events (
    id, project_id, work_object_version_id, action, from_status, to_status,
    replacement_version_id, reason, operated_by, operated_at, created_at, updated_at
)
SELECT
    id, project_id, work_object_version_id,
    CASE action WHEN 'correct' THEN 'confirm' ELSE action END,
    from_status, to_status, replacement_version_id, reason, operated_by,
    operated_at, created_at, updated_at
FROM work_object_lifecycle_events_legacy;

DROP TABLE work_object_lifecycle_events_legacy;

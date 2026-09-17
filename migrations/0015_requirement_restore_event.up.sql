ALTER TABLE requirement_events RENAME TO requirement_events_legacy;

DROP INDEX IF EXISTS idx_requirement_events_requirement;

CREATE TABLE requirement_events (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    requirement_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN (
        'create', 'update', 'confirm', 'exclude', 'restore', 'parse'
    )),
    from_status TEXT NOT NULL,
    to_status TEXT NOT NULL,
    detail TEXT NOT NULL DEFAULT '',
    operated_by TEXT NOT NULL DEFAULT '',
    operated_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
    FOREIGN KEY (requirement_id) REFERENCES software_requirements (id) ON DELETE CASCADE
);

CREATE INDEX idx_requirement_events_requirement
    ON requirement_events (requirement_id, operated_at DESC);

INSERT INTO requirement_events (
    id, project_id, requirement_id, action, from_status, to_status,
    detail, operated_by, operated_at, created_at, updated_at
)
SELECT
    id, project_id, requirement_id, action, from_status, to_status,
    detail, operated_by, operated_at, created_at, updated_at
FROM requirement_events_legacy
ORDER BY rowid;

DROP TABLE requirement_events_legacy;

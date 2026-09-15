CREATE TABLE IF NOT EXISTS requirement_sections (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    source_version_id TEXT NOT NULL,
    parent_id TEXT,
    chapter_number TEXT NOT NULL,
    title TEXT NOT NULL,
    origin TEXT NOT NULL CHECK (origin IN ('manual', 'parsed')),
    source_anchor TEXT NOT NULL DEFAULT '',
    created_by TEXT NOT NULL DEFAULT '',
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE (source_version_id, chapter_number),
    FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
    FOREIGN KEY (source_version_id) REFERENCES work_object_versions (id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES requirement_sections (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_requirement_sections_source
    ON requirement_sections (source_version_id, chapter_number);

CREATE TABLE IF NOT EXISTS software_requirements (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    source_version_id TEXT NOT NULL,
    section_id TEXT,
    chapter_number TEXT NOT NULL,
    external_identifier TEXT NOT NULL DEFAULT '',
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    primary_kind TEXT NOT NULL CHECK (primary_kind IN (
        'functional', 'performance', 'interface', 'safety', 'reliability', 'other'
    )),
    tags TEXT NOT NULL DEFAULT '[]',
    origin TEXT NOT NULL CHECK (origin IN ('manual', 'parsed')),
    source_anchor TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL CHECK (status IN ('candidate', 'official', 'excluded', 'superseded')),
    test_item_task_status TEXT NOT NULL DEFAULT 'none'
        CHECK (test_item_task_status IN ('none', 'pending', 'completed')),
    test_item_id TEXT,
    superseded_by_id TEXT,
    created_by TEXT NOT NULL DEFAULT '',
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
    FOREIGN KEY (source_version_id) REFERENCES work_object_versions (id) ON DELETE CASCADE,
    FOREIGN KEY (section_id) REFERENCES requirement_sections (id) ON DELETE SET NULL,
    FOREIGN KEY (superseded_by_id) REFERENCES software_requirements (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_software_requirements_source_status
    ON software_requirements (source_version_id, status, chapter_number);

CREATE UNIQUE INDEX IF NOT EXISTS idx_software_requirements_active_chapter
    ON software_requirements (source_version_id, chapter_number)
    WHERE status IN ('candidate', 'official');

CREATE TABLE IF NOT EXISTS requirement_events (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    requirement_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('create', 'update', 'confirm', 'exclude', 'parse')),
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

CREATE INDEX IF NOT EXISTS idx_requirement_events_requirement
    ON requirement_events (requirement_id, operated_at DESC);

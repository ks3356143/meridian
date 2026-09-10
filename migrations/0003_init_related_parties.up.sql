CREATE TABLE IF NOT EXISTS related_parties (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL CHECK (category IN ('client', 'developer', 'test_center')),
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
    is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE (category, name COLLATE NOCASE)
);

CREATE INDEX IF NOT EXISTS idx_related_parties_category_enabled
    ON related_parties (category, is_enabled, sort_order);

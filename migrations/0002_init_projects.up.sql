CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name TEXT NOT NULL,
    nature TEXT NOT NULL CHECK (nature IN ('鉴定测评', '第三方测评', '二方测评')),
    platform TEXT NOT NULL CHECK (platform IN ('FPGA', 'CPU/非嵌')),
    software_type TEXT NOT NULL CHECK (software_type IN ('新研', '改造', '沿用')),
    classification TEXT NOT NULL CHECK (classification IN ('公开', '内部', '秘密', '机密', '绝密')),
    security_level TEXT NOT NULL CHECK (security_level IN ('A', 'B', 'C', 'D')),
    organization TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT '编制大纲中'
        CHECK (status IN ('编制大纲中', '大纲已评审', '测试执行中', '回归验证中', '报告编制中', '已完成')),
    cases_total INTEGER NOT NULL DEFAULT 0 CHECK (cases_total >= 0),
    cases_executed INTEGER NOT NULL DEFAULT 0 CHECK (cases_executed >= 0 AND cases_executed <= cases_total),
    critical_issues INTEGER NOT NULL DEFAULT 0 CHECK (critical_issues >= 0),
    serious_issues INTEGER NOT NULL DEFAULT 0 CHECK (serious_issues >= 0),
    normal_issues INTEGER NOT NULL DEFAULT 0 CHECK (normal_issues >= 0),
    suggestion_issues INTEGER NOT NULL DEFAULT 0 CHECK (suggestion_issues >= 0),
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS dictionary_items (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL CHECK (category IN ('language', 'runtime_environment', 'development_environment')),
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
    is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
    is_preset INTEGER NOT NULL DEFAULT 0 CHECK (is_preset IN (0, 1)),
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE (category, name COLLATE NOCASE)
);

CREATE INDEX IF NOT EXISTS idx_dictionary_items_category_enabled
    ON dictionary_items (category, is_enabled, sort_order);

CREATE TABLE IF NOT EXISTS reference_standards (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    code TEXT NOT NULL DEFAULT '',
    published_date TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
    is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reference_standards_enabled_sort
    ON reference_standards (is_enabled, sort_order);

CREATE TABLE IF NOT EXISTS project_languages (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    dictionary_item_id TEXT NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE (project_id, dictionary_item_id),
    FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
    FOREIGN KEY (dictionary_item_id) REFERENCES dictionary_items (id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS project_runtime_environments (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    dictionary_item_id TEXT NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE (project_id, dictionary_item_id),
    FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
    FOREIGN KEY (dictionary_item_id) REFERENCES dictionary_items (id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS project_development_environments (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    dictionary_item_id TEXT NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE (project_id, dictionary_item_id),
    FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
    FOREIGN KEY (dictionary_item_id) REFERENCES dictionary_items (id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS project_reference_standards (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    reference_standard_id TEXT NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE (project_id, reference_standard_id),
    FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
    FOREIGN KEY (reference_standard_id) REFERENCES reference_standards (id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS project_members (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    is_owner INTEGER NOT NULL DEFAULT 0 CHECK (is_owner IN (0, 1)),
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE (project_id, user_id),
    FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_projects_status
    ON projects (status);
CREATE INDEX IF NOT EXISTS idx_projects_owner
    ON projects (owner_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user
    ON project_members (user_id);

INSERT OR IGNORE INTO dictionary_items (id, category, name, sort_order, is_enabled, is_preset, created_at, updated_at)
VALUES
    ('018f5f0f-1000-7000-8000-000000000001', 'language', 'C', 1, 1, 1, datetime('now'), datetime('now')),
    ('018f5f0f-1000-7000-8000-000000000002', 'language', 'C++', 2, 1, 1, datetime('now'), datetime('now')),
    ('018f5f0f-1000-7000-8000-000000000003', 'language', 'Java', 3, 1, 1, datetime('now'), datetime('now')),
    ('018f5f0f-1000-7000-8000-000000000004', 'language', 'Python', 4, 1, 1, datetime('now'), datetime('now')),
    ('018f5f0f-1000-7000-8000-000000000005', 'language', 'Ada', 5, 1, 1, datetime('now'), datetime('now')),
    ('018f5f0f-1000-7000-8000-000000000006', 'language', '汇编', 6, 1, 1, datetime('now'), datetime('now')),
    ('018f5f0f-2000-7000-8000-000000000001', 'runtime_environment', 'Windows', 1, 1, 1, datetime('now'), datetime('now')),
    ('018f5f0f-2000-7000-8000-000000000002', 'runtime_environment', 'Linux', 2, 1, 1, datetime('now'), datetime('now')),
    ('018f5f0f-2000-7000-8000-000000000003', 'runtime_environment', 'VxWorks', 3, 1, 1, datetime('now'), datetime('now')),
    ('018f5f0f-2000-7000-8000-000000000004', 'runtime_environment', '天脉', 4, 1, 1, datetime('now'), datetime('now')),
    ('018f5f0f-2000-7000-8000-000000000005', 'runtime_environment', 'ReWorks', 5, 1, 1, datetime('now'), datetime('now')),
    ('018f5f0f-3000-7000-8000-000000000001', 'development_environment', 'Keil', 1, 1, 1, datetime('now'), datetime('now')),
    ('018f5f0f-3000-7000-8000-000000000002', 'development_environment', 'IAR', 2, 1, 1, datetime('now'), datetime('now')),
    ('018f5f0f-3000-7000-8000-000000000003', 'development_environment', 'VS Code', 3, 1, 1, datetime('now'), datetime('now')),
    ('018f5f0f-3000-7000-8000-000000000004', 'development_environment', 'Eclipse', 4, 1, 1, datetime('now'), datetime('now')),
    ('018f5f0f-3000-7000-8000-000000000005', 'development_environment', 'CCS', 5, 1, 1, datetime('now'), datetime('now'));

INSERT OR IGNORE INTO reference_standards (id, name, code, published_date, source, sort_order, is_enabled, created_at, updated_at)
VALUES
    ('018f5f0f-4000-7000-8000-000000000001', 'GJB 438C-2021', 'GJB 438C-2021', '2021-01-01', '中央军委装备发展部', 1, 1, datetime('now'), datetime('now')),
    ('018f5f0f-4000-7000-8000-000000000002', 'GJB 2786A-2009', 'GJB 2786A-2009', '2009-01-01', '中国人民解放军总装备部', 2, 1, datetime('now'), datetime('now')),
    ('018f5f0f-4000-7000-8000-000000000003', 'GJB 8114-2013', 'GJB 8114-2013', '2013-01-01', '中国人民解放军总装备部', 3, 1, datetime('now'), datetime('now')),
    ('018f5f0f-4000-7000-8000-000000000004', 'GJB 102A-1998', 'GJB 102A-1998', '1998-01-01', '中国人民解放军总装备部', 4, 1, datetime('now'), datetime('now'));

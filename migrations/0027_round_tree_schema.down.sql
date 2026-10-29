-- migrate:foreign-keys-off
-- 0027 回滚：仅当不存在跨轮重复标识时可用。
DROP TRIGGER IF EXISTS trg_test_items_round_project_update;
DROP TRIGGER IF EXISTS trg_test_items_round_project_insert;
DROP TRIGGER IF EXISTS trg_test_item_folders_round_project_update;
DROP TRIGGER IF EXISTS trg_test_item_folders_round_project_insert;
DROP TRIGGER IF EXISTS trg_test_items_folder_round_update;
DROP TRIGGER IF EXISTS trg_test_items_folder_round_insert;
DROP TRIGGER IF EXISTS trg_test_item_folders_parent_round_update;
DROP TRIGGER IF EXISTS trg_test_item_folders_parent_round_insert;

DROP TABLE IF EXISTS test_case_steps_old;
CREATE TABLE test_case_steps_old (
    id TEXT PRIMARY KEY,
    test_case_id TEXT NOT NULL,
    seq INTEGER NOT NULL,
    expect_text TEXT NOT NULL DEFAULT '',
    passed TEXT NOT NULL DEFAULT 'none' CHECK (passed IN ('none', 'pass', 'fail')),
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY (test_case_id) REFERENCES test_cases (id) ON DELETE CASCADE,
    UNIQUE (test_case_id, seq)
);
INSERT INTO test_case_steps_old
    (id, test_case_id, seq, expect_text, passed, sort_order, created_at, updated_at)
SELECT id, test_case_id, seq, expect_text, passed, sort_order, created_at, updated_at
FROM test_case_steps;
DROP TABLE test_case_steps;
ALTER TABLE test_case_steps_old RENAME TO test_case_steps;

DROP TABLE IF EXISTS test_cases_old;
CREATE TABLE test_cases_old (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    test_item_id TEXT NOT NULL,
    identifier TEXT NOT NULL,
    seq INTEGER NOT NULL,
    name TEXT NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    init_text TEXT NOT NULL DEFAULT '',
    prerequisites TEXT NOT NULL DEFAULT '',
    designer_id TEXT,
    tester_id TEXT,
    monitor_id TEXT,
    exec_date DATETIME,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'passed', 'failed')),
    notes TEXT NOT NULL DEFAULT '',
    not_executed_reason TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    termination_text TEXT NOT NULL DEFAULT '',
    pass_criteria TEXT NOT NULL DEFAULT '',
    FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
    FOREIGN KEY (test_item_id) REFERENCES test_items (id) ON DELETE CASCADE,
    UNIQUE (project_id, identifier),
    UNIQUE (test_item_id, seq)
);
INSERT INTO test_cases_old
    (id, project_id, test_item_id, identifier, seq, name, summary, init_text,
     prerequisites, designer_id, tester_id, monitor_id, exec_date, status, notes,
     not_executed_reason, sort_order, created_at, updated_at, termination_text, pass_criteria)
SELECT id, project_id, test_item_id, identifier, seq, name, summary, init_text,
       prerequisites, designer_id, tester_id, monitor_id, exec_date, status, notes,
       not_executed_reason, sort_order, created_at, updated_at, termination_text, pass_criteria
FROM test_cases;
DROP TABLE test_cases;
ALTER TABLE test_cases_old RENAME TO test_cases;
CREATE INDEX idx_test_cases_item ON test_cases (test_item_id, sort_order);

DROP TABLE IF EXISTS test_items_old;
CREATE TABLE test_items_old (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    type_code TEXT NOT NULL,
    identifier TEXT NOT NULL,
    suffix TEXT NOT NULL,
    name TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT '中' CHECK (priority IN ('高', '中', '低')),
    folder_id TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    description TEXT NOT NULL DEFAULT '',
    adequacy TEXT NOT NULL DEFAULT '',
    pass_criteria TEXT NOT NULL DEFAULT '',
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    implicit_requirement INTEGER NOT NULL DEFAULT 0 CHECK (implicit_requirement IN (0, 1)),
    FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
    UNIQUE (project_id, identifier)
);
INSERT INTO test_items_old
    (id, project_id, type_code, identifier, suffix, name, priority, folder_id,
     sort_order, description, adequacy, pass_criteria, created_at, updated_at, implicit_requirement)
SELECT id, project_id, type_code, identifier, suffix, name, priority, folder_id,
       sort_order, description, adequacy, pass_criteria, created_at, updated_at, implicit_requirement
FROM test_items;
DROP TABLE test_items;
ALTER TABLE test_items_old RENAME TO test_items;
CREATE INDEX idx_test_items_container ON test_items (project_id, type_code, folder_id, sort_order);

DROP TABLE IF EXISTS test_item_folders_old;
CREATE TABLE test_item_folders_old (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    type_code TEXT NOT NULL,
    parent_id TEXT,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
);
INSERT INTO test_item_folders_old
    (id, project_id, type_code, parent_id, name, sort_order, created_at, updated_at)
SELECT id, project_id, type_code, parent_id, name, sort_order, created_at, updated_at
FROM test_item_folders;
DROP TABLE test_item_folders;
ALTER TABLE test_item_folders_old RENAME TO test_item_folders;
CREATE INDEX idx_test_item_folders_container
    ON test_item_folders (project_id, type_code, parent_id, sort_order);

CREATE TABLE IF NOT EXISTS round_test_items (
    id TEXT PRIMARY KEY,
    round_id TEXT NOT NULL,
    test_item_id TEXT NOT NULL,
    source_type TEXT NOT NULL DEFAULT 'new' CHECK (source_type IN ('reuse', 'modified', 'new')),
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL,
    FOREIGN KEY (round_id) REFERENCES test_rounds (id) ON DELETE CASCADE,
    FOREIGN KEY (test_item_id) REFERENCES test_items (id) ON DELETE CASCADE,
    UNIQUE (round_id, test_item_id)
);

CREATE TABLE IF NOT EXISTS round_test_cases (
    id TEXT PRIMARY KEY,
    round_id TEXT NOT NULL,
    test_case_id TEXT NOT NULL,
    source_type TEXT NOT NULL DEFAULT 'new' CHECK (source_type IN ('reuse', 'modified', 'new')),
    created_at DATETIME NOT NULL,
    FOREIGN KEY (round_id) REFERENCES test_rounds (id) ON DELETE CASCADE,
    FOREIGN KEY (test_case_id) REFERENCES test_cases (id) ON DELETE CASCADE,
    UNIQUE (round_id, test_case_id)
);
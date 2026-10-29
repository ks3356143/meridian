-- migrate:foreign-keys-off
-- 0027：测试项树改为按轮独立。SQLite 需要重建受唯一约束影响的父表；
-- 因此本迁移由迁移器在事务外关闭外键，事务内完成复制并在提交前执行 foreign_key_check。

-- 迁移前防误删：旧轮次范围表必须为空。
DROP TABLE IF EXISTS round_tree_guard_round_test_items;
CREATE TEMP TABLE round_tree_guard_round_test_items (
    ok INTEGER NOT NULL CHECK (ok = 1)
);
INSERT INTO round_tree_guard_round_test_items (ok)
SELECT CASE WHEN COUNT(*) = 0 THEN 1 ELSE 0 END FROM round_test_items;
DROP TABLE round_tree_guard_round_test_items;

DROP TABLE IF EXISTS round_tree_guard_round_test_cases;
CREATE TEMP TABLE round_tree_guard_round_test_cases (
    ok INTEGER NOT NULL CHECK (ok = 1)
);
INSERT INTO round_tree_guard_round_test_cases (ok)
SELECT CASE WHEN COUNT(*) = 0 THEN 1 ELSE 0 END FROM round_test_cases;
DROP TABLE round_tree_guard_round_test_cases;

-- 迁移前防误删：有树数据的项目必须已有第 1 轮。
DROP TABLE IF EXISTS round_tree_guard_items_first_round;
CREATE TEMP TABLE round_tree_guard_items_first_round (
    ok INTEGER NOT NULL CHECK (ok = 1)
);
INSERT INTO round_tree_guard_items_first_round (ok)
SELECT CASE WHEN COUNT(*) = 0 THEN 1 ELSE 0 END
FROM test_items item
WHERE NOT EXISTS (
    SELECT 1 FROM test_rounds round
    WHERE round.project_id = item.project_id AND round.round_number = 1
);
DROP TABLE round_tree_guard_items_first_round;

DROP TABLE IF EXISTS round_tree_guard_folders_first_round;
CREATE TEMP TABLE round_tree_guard_folders_first_round (
    ok INTEGER NOT NULL CHECK (ok = 1)
);
INSERT INTO round_tree_guard_folders_first_round (ok)
SELECT CASE WHEN COUNT(*) = 0 THEN 1 ELSE 0 END
FROM test_item_folders folder
WHERE NOT EXISTS (
    SELECT 1 FROM test_rounds round
    WHERE round.project_id = folder.project_id AND round.round_number = 1
);
DROP TABLE round_tree_guard_folders_first_round;

-- 重建文件夹表：增加 round_id，父目录同轮由后置触发器校验。
DROP TABLE IF EXISTS test_item_folders_new;
CREATE TABLE test_item_folders_new (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    round_id TEXT NOT NULL,
    type_code TEXT NOT NULL,
    parent_id TEXT,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
    FOREIGN KEY (round_id) REFERENCES test_rounds (id) ON DELETE CASCADE
);

INSERT INTO test_item_folders_new
    (id, project_id, round_id, type_code, parent_id, name, sort_order, created_at, updated_at)
SELECT folder.id, folder.project_id, round.id, folder.type_code, folder.parent_id,
       folder.name, folder.sort_order, folder.created_at, folder.updated_at
FROM test_item_folders folder
JOIN test_rounds round
  ON round.project_id = folder.project_id AND round.round_number = 1;

DROP TABLE IF EXISTS round_tree_guard_folder_copy;
CREATE TEMP TABLE round_tree_guard_folder_copy (
    ok INTEGER NOT NULL CHECK (ok = 1)
);
INSERT INTO round_tree_guard_folder_copy (ok)
SELECT CASE
    WHEN (SELECT COUNT(*) FROM test_item_folders) = (SELECT COUNT(*) FROM test_item_folders_new)
     AND NOT EXISTS (
        SELECT 1
        FROM test_item_folders_new child
        LEFT JOIN test_item_folders_new parent
          ON parent.id = child.parent_id
         AND parent.project_id = child.project_id
         AND parent.round_id = child.round_id
         AND parent.type_code = child.type_code
        WHERE child.parent_id IS NOT NULL AND parent.id IS NULL
     )
    THEN 1 ELSE 0
END;
DROP TABLE round_tree_guard_folder_copy;

DROP TABLE test_item_folders;
ALTER TABLE test_item_folders_new RENAME TO test_item_folders;
CREATE INDEX idx_test_item_folders_container
    ON test_item_folders (round_id, type_code, parent_id, sort_order);

-- 重建测试项表：增加 round_id、lineage_key，并把标识唯一性收敛到轮次内。
DROP TABLE IF EXISTS test_items_new;
CREATE TABLE test_items_new (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    round_id TEXT NOT NULL,
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
    implicit_requirement INTEGER NOT NULL DEFAULT 0 CHECK (implicit_requirement IN (0, 1)),
    lineage_key TEXT NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
    FOREIGN KEY (round_id) REFERENCES test_rounds (id) ON DELETE CASCADE,
    UNIQUE (round_id, identifier)
);

INSERT INTO test_items_new
    (id, project_id, round_id, type_code, identifier, suffix, name, priority,
     folder_id, sort_order, description, adequacy, pass_criteria,
     implicit_requirement, lineage_key, created_at, updated_at)
SELECT item.id, item.project_id, round.id, item.type_code, item.identifier,
       item.suffix, item.name, item.priority, item.folder_id, item.sort_order,
       item.description, item.adequacy, item.pass_criteria,
       item.implicit_requirement, item.id, item.created_at, item.updated_at
FROM test_items item
JOIN test_rounds round
  ON round.project_id = item.project_id AND round.round_number = 1;

DROP TABLE IF EXISTS round_tree_guard_item_copy;
CREATE TEMP TABLE round_tree_guard_item_copy (
    ok INTEGER NOT NULL CHECK (ok = 1)
);
INSERT INTO round_tree_guard_item_copy (ok)
SELECT CASE
    WHEN (SELECT COUNT(*) FROM test_items) = (SELECT COUNT(*) FROM test_items_new)
     AND NOT EXISTS (
        SELECT 1
        FROM test_items_new item
        LEFT JOIN test_item_folders folder
          ON folder.id = item.folder_id
         AND folder.project_id = item.project_id
         AND folder.round_id = item.round_id
         AND folder.type_code = item.type_code
        WHERE item.folder_id IS NOT NULL AND folder.id IS NULL
     )
    THEN 1 ELSE 0
END;
DROP TABLE round_tree_guard_item_copy;

DROP TABLE test_items;
ALTER TABLE test_items_new RENAME TO test_items;
CREATE INDEX idx_test_items_container
    ON test_items (round_id, type_code, folder_id, sort_order);

-- 用例：增加 lineage_key；标识唯一性改成测试项内唯一。
DROP TABLE IF EXISTS test_cases_new;
CREATE TABLE test_cases_new (
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
    lineage_key TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
    FOREIGN KEY (test_item_id) REFERENCES test_items (id) ON DELETE CASCADE,
    UNIQUE (test_item_id, identifier),
    UNIQUE (test_item_id, seq)
);

INSERT INTO test_cases_new
    (id, project_id, test_item_id, identifier, seq, name, summary, init_text,
     prerequisites, designer_id, tester_id, monitor_id, exec_date, status, notes,
     not_executed_reason, sort_order, created_at, updated_at, termination_text,
     pass_criteria, lineage_key)
SELECT id, project_id, test_item_id, identifier, seq, name, summary, init_text,
       prerequisites, designer_id, tester_id, monitor_id, exec_date, status, notes,
       not_executed_reason, sort_order, created_at, updated_at, termination_text,
       pass_criteria, id
FROM test_cases;

DROP TABLE IF EXISTS round_tree_guard_case_copy;
CREATE TEMP TABLE round_tree_guard_case_copy (
    ok INTEGER NOT NULL CHECK (ok = 1)
);
INSERT INTO round_tree_guard_case_copy (ok)
SELECT CASE
    WHEN (SELECT COUNT(*) FROM test_cases) = (SELECT COUNT(*) FROM test_cases_new)
    THEN 1 ELSE 0
END;
DROP TABLE round_tree_guard_case_copy;

DROP TABLE test_cases;
ALTER TABLE test_cases_new RENAME TO test_cases;
CREATE INDEX idx_test_cases_item ON test_cases (test_item_id, sort_order);

-- 步骤：增加 lineage_key；步骤定义与实测内容块都以原 step id 保持关联。
DROP TABLE IF EXISTS test_case_steps_new;
CREATE TABLE test_case_steps_new (
    id TEXT PRIMARY KEY,
    test_case_id TEXT NOT NULL,
    seq INTEGER NOT NULL,
    expect_text TEXT NOT NULL DEFAULT '',
    passed TEXT NOT NULL DEFAULT 'none' CHECK (passed IN ('none', 'pass', 'fail')),
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    lineage_key TEXT NOT NULL,
    FOREIGN KEY (test_case_id) REFERENCES test_cases (id) ON DELETE CASCADE,
    UNIQUE (test_case_id, seq),
    UNIQUE (test_case_id, lineage_key)
);

INSERT INTO test_case_steps_new
    (id, test_case_id, seq, expect_text, passed, sort_order, created_at, updated_at, lineage_key)
SELECT id, test_case_id, seq, expect_text, passed, sort_order, created_at, updated_at, id
FROM test_case_steps;

DROP TABLE IF EXISTS round_tree_guard_step_copy;
CREATE TEMP TABLE round_tree_guard_step_copy (
    ok INTEGER NOT NULL CHECK (ok = 1)
);
INSERT INTO round_tree_guard_step_copy (ok)
SELECT CASE
    WHEN (SELECT COUNT(*) FROM test_case_steps) = (SELECT COUNT(*) FROM test_case_steps_new)
    THEN 1 ELSE 0
END;
DROP TABLE round_tree_guard_step_copy;

DROP TABLE test_case_steps;
ALTER TABLE test_case_steps_new RENAME TO test_case_steps;

-- 父目录必须与子目录同项目、同轮次、同类型。
CREATE TRIGGER trg_test_item_folders_parent_round_insert
BEFORE INSERT ON test_item_folders
WHEN NEW.parent_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM test_item_folders parent
    WHERE parent.id = NEW.parent_id
      AND parent.project_id = NEW.project_id
      AND parent.round_id = NEW.round_id
      AND parent.type_code = NEW.type_code
)
BEGIN
    SELECT RAISE(ABORT, '父目录必须与子目录同项目、同轮次、同类型');
END;

CREATE TRIGGER trg_test_item_folders_parent_round_update
BEFORE UPDATE OF parent_id, project_id, round_id, type_code ON test_item_folders
WHEN NEW.parent_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM test_item_folders parent
    WHERE parent.id = NEW.parent_id
      AND parent.project_id = NEW.project_id
      AND parent.round_id = NEW.round_id
      AND parent.type_code = NEW.type_code
)
BEGIN
    SELECT RAISE(ABORT, '父目录必须与子目录同项目、同轮次、同类型');
END;

-- 测试项只能挂到同项目、同轮次、同类型的文件夹。
CREATE TRIGGER trg_test_items_folder_round_insert
BEFORE INSERT ON test_items
WHEN NEW.folder_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM test_item_folders folder
    WHERE folder.id = NEW.folder_id
      AND folder.project_id = NEW.project_id
      AND folder.round_id = NEW.round_id
      AND folder.type_code = NEW.type_code
)
BEGIN
    SELECT RAISE(ABORT, '测试项文件夹必须与测试项同项目、同轮次、同类型');
END;

CREATE TRIGGER trg_test_items_folder_round_update
BEFORE UPDATE OF folder_id, project_id, round_id, type_code ON test_items
WHEN NEW.folder_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM test_item_folders folder
    WHERE folder.id = NEW.folder_id
      AND folder.project_id = NEW.project_id
      AND folder.round_id = NEW.round_id
      AND folder.type_code = NEW.type_code
)
BEGIN
    SELECT RAISE(ABORT, '测试项文件夹必须与测试项同项目、同轮次、同类型');
END;

-- round_id 必须属于同一项目。
CREATE TRIGGER trg_test_item_folders_round_project_insert
BEFORE INSERT ON test_item_folders
WHEN NOT EXISTS (
    SELECT 1 FROM test_rounds round
    WHERE round.id = NEW.round_id AND round.project_id = NEW.project_id
)
BEGIN
    SELECT RAISE(ABORT, '文件夹轮次必须属于同一项目');
END;

CREATE TRIGGER trg_test_item_folders_round_project_update
BEFORE UPDATE OF project_id, round_id ON test_item_folders
WHEN NOT EXISTS (
    SELECT 1 FROM test_rounds round
    WHERE round.id = NEW.round_id AND round.project_id = NEW.project_id
)
BEGIN
    SELECT RAISE(ABORT, '文件夹轮次必须属于同一项目');
END;

CREATE TRIGGER trg_test_items_round_project_insert
BEFORE INSERT ON test_items
WHEN NOT EXISTS (
    SELECT 1 FROM test_rounds round
    WHERE round.id = NEW.round_id AND round.project_id = NEW.project_id
)
BEGIN
    SELECT RAISE(ABORT, '测试项轮次必须属于同一项目');
END;

CREATE TRIGGER trg_test_items_round_project_update
BEFORE UPDATE OF project_id, round_id ON test_items
WHEN NOT EXISTS (
    SELECT 1 FROM test_rounds round
    WHERE round.id = NEW.round_id AND round.project_id = NEW.project_id
)
BEGIN
    SELECT RAISE(ABORT, '测试项轮次必须属于同一项目');
END;

-- 旧的两张范围桥表退出模型。
DROP TABLE IF EXISTS round_test_cases;
DROP TABLE IF EXISTS round_test_items;
-- 测试项与执行：类型字典、文件夹、测试项、子项、用例、步骤、需求关联、轮次
-- 2026-10-10 切片 1

CREATE TABLE IF NOT EXISTS test_item_types (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    is_static INTEGER NOT NULL DEFAULT 0 CHECK (is_static IN (0, 1)),
    platform_scope TEXT NOT NULL DEFAULT 'all' CHECK (platform_scope IN ('all', 'cpu', 'fpga')),
    output_order INTEGER NOT NULL DEFAULT 0,
    default_adequacy TEXT NOT NULL DEFAULT '',
    default_pass_criteria TEXT NOT NULL DEFAULT '',
    is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS test_item_folders (
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

CREATE INDEX IF NOT EXISTS idx_test_item_folders_container
    ON test_item_folders (project_id, type_code, parent_id, sort_order);

CREATE TABLE IF NOT EXISTS test_items (
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
    FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
    UNIQUE (project_id, identifier)
);

CREATE INDEX IF NOT EXISTS idx_test_items_container
    ON test_items (project_id, type_code, folder_id, sort_order);

CREATE TABLE IF NOT EXISTS test_sub_items (
    id TEXT PRIMARY KEY,
    test_item_id TEXT NOT NULL,
    seq INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY (test_item_id) REFERENCES test_items (id) ON DELETE CASCADE,
    UNIQUE (test_item_id, seq)
);

CREATE TABLE IF NOT EXISTS test_cases (
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
    FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
    FOREIGN KEY (test_item_id) REFERENCES test_items (id) ON DELETE CASCADE,
    UNIQUE (project_id, identifier),
    UNIQUE (test_item_id, seq)
);

CREATE INDEX IF NOT EXISTS idx_test_cases_item ON test_cases (test_item_id, sort_order);

CREATE TABLE IF NOT EXISTS test_case_steps (
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

CREATE TABLE IF NOT EXISTS requirement_test_items (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    requirement_id TEXT NOT NULL,
    test_item_id TEXT NOT NULL,
    created_at DATETIME NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
    FOREIGN KEY (requirement_id) REFERENCES software_requirements (id) ON DELETE CASCADE,
    FOREIGN KEY (test_item_id) REFERENCES test_items (id) ON DELETE CASCADE,
    UNIQUE (requirement_id, test_item_id)
);

CREATE INDEX IF NOT EXISTS idx_requirement_test_items_item ON requirement_test_items (test_item_id);

CREATE TABLE IF NOT EXISTS test_rounds (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    round_number INTEGER NOT NULL,
    name TEXT NOT NULL,
    round_type TEXT NOT NULL DEFAULT 'initial' CHECK (round_type IN ('initial', 'regression')),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'executing', 'closed')),
    started_on TEXT,
    ended_on TEXT,
    dut_version TEXT NOT NULL DEFAULT '',
    change_reason TEXT NOT NULL DEFAULT '',
    reason_summary TEXT NOT NULL DEFAULT '',
    source_round_id TEXT,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
    UNIQUE (project_id, round_number)
);

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

-- 24 类测试项类型字典（种子，来源：老项目字典 + BCD 星真实大纲套话）
INSERT OR IGNORE INTO test_item_types
    (id, code, name, category, is_static, platform_scope, output_order, default_adequacy, default_pass_criteria, is_enabled, created_at, updated_at)
VALUES
    ('tit-dc', 'DC', '文档审查', '静态', 1, 'all', 1,
     '对所有被测软件文档按照文档检查单逐项进行审查。',
     '被测软件文档内容完整，描述准确，格式规范，文档文文一致。', 1, datetime('now'), datetime('now')),
    ('tit-sa', 'SA', '静态分析', '静态', 1, 'cpu', 2,
     '对全部源程序进行静态分析，覆盖控制流、数据流与质量度量要求。',
     '被测软件文档内容完整，描述准确，格式规范，文档文文一致。', 1, datetime('now'), datetime('now')),
    ('tit-cr', 'CR', '代码审查', '静态', 1, 'all', 3,
     '对所有软件全部源代码进行代码审查。',
     '代码编码符合编程准则、代码流程实现正确、代码结构设计合理，代码实现需求正确。', 1, datetime('now'), datetime('now')),
    ('tit-cw', 'CW', '代码走查', '静态', 1, 'all', 4,
     '按照设计的用例进行走查，形成测试记录，若发现问题提交软件问题报告单。',
     '完成要求的源代码走查，软件无走查问题。', 1, datetime('now'), datetime('now')),
    ('tit-su', 'SU', '功能测试', '功能验证', 0, 'all', 5,
     '测试用例覆盖所有测试子项要求的全部内容。所有用例执行完毕，对于未执行的用例说明未执行原因。',
     '各测试步骤、测试用例执行结果与预期一致，功能实现正确。', 1, datetime('now'), datetime('now')),
    ('tit-io', 'IO', '接口测试', '功能验证', 0, 'all', 6,
     '测试用例覆盖所有测试子项要求的全部内容。所有用例执行完毕，对于未执行的用例说明未执行原因。',
     '各测试步骤、测试用例执行结果与预期一致，功能实现正确。', 1, datetime('now'), datetime('now')),
    ('tit-gui', 'GUI', '人机交互界面测试', '功能验证', 0, 'all', 7,
     '测试用例覆盖所有测试子项要求的全部内容。所有用例执行完毕，对于未执行的用例说明未执行原因。',
     '各测试步骤、测试用例执行结果与预期一致，功能实现正确。', 1, datetime('now'), datetime('now')),
    ('tit-ac', 'AC', '性能测试', '性能强度', 0, 'all', 8,
     '测试用例覆盖所有测试子项要求的全部内容。所有用例执行完毕，对于未执行的用例说明未执行原因。',
     '各测试步骤、测试用例执行结果与预期一致，功能实现正确。', 1, datetime('now'), datetime('now')),
    ('tit-bt', 'BT', '边界测试', '功能验证', 0, 'all', 9,
     '测试用例覆盖所有测试子项要求的全部内容。所有用例执行完毕，对于未执行的用例说明未执行原因。',
     '各测试步骤、测试用例执行结果与预期一致，功能实现正确。', 1, datetime('now'), datetime('now')),
    ('tit-at', 'AT', '余量测试', '性能强度', 0, 'all', 10,
     '测试用例覆盖所有测试子项要求的全部内容。所有用例执行完毕，对于未执行的用例说明未执行原因。',
     '各测试步骤、测试用例执行结果与预期一致，功能实现正确。', 1, datetime('now'), datetime('now')),
    ('tit-st', 'ST', '强度测试', '性能强度', 0, 'all', 11,
     '测试用例覆盖所有测试子项要求的全部内容。所有用例执行完毕，对于未执行的用例说明未执行原因。',
     '各测试步骤、测试用例执行结果与预期一致，功能实现正确。', 1, datetime('now'), datetime('now')),
    ('tit-rl', 'RL', '容量测试', '性能强度', 0, 'all', 12,
     '测试用例覆盖所有测试子项要求的全部内容。所有用例执行完毕，对于未执行的用例说明未执行原因。',
     '各测试步骤、测试用例执行结果与预期一致，功能实现正确。', 1, datetime('now'), datetime('now')),
    ('tit-jr', 'JR', '兼容性测试', '环境适配', 0, 'all', 13,
     '测试用例覆盖所有测试子项要求的全部内容。所有用例执行完毕，对于未执行的用例说明未执行原因。',
     '各测试步骤、测试用例执行结果与预期一致，功能实现正确。', 1, datetime('now'), datetime('now')),
    ('tit-az', 'AZ', '安装性测试', '环境适配', 0, 'all', 14,
     '测试用例覆盖所有测试子项要求的全部内容。所有用例执行完毕，对于未执行的用例说明未执行原因。',
     '各测试步骤、测试用例执行结果与预期一致，功能实现正确。', 1, datetime('now'), datetime('now')),
    ('tit-hz', 'HZ', '互操作性测试', '环境适配', 0, 'all', 15,
     '测试用例覆盖所有测试子项要求的全部内容。所有用例执行完毕，对于未执行的用例说明未执行原因。',
     '各测试步骤、测试用例执行结果与预期一致，功能实现正确。', 1, datetime('now'), datetime('now')),
    ('tit-se', 'SE', '安全性测试', '专项分析', 0, 'all', 16,
     '测试用例覆盖所有测试子项要求的全部内容。所有用例执行完毕，对于未执行的用例说明未执行原因。',
     '各测试步骤、测试用例执行结果与预期一致，功能实现正确。', 1, datetime('now'), datetime('now')),
    ('tit-kk', 'KK', '可靠性测试', '专项分析', 0, 'all', 17,
     '测试用例覆盖所有测试子项要求的全部内容。所有用例执行完毕，对于未执行的用例说明未执行原因。',
     '各测试步骤、测试用例执行结果与预期一致，功能实现正确。', 1, datetime('now'), datetime('now')),
    ('tit-lt', 'LT', '逻辑测试', '专项分析', 0, 'all', 18,
     '测试用例覆盖所有测试子项要求的全部内容。所有用例执行完毕，对于未执行的用例说明未执行原因。',
     '各测试步骤、测试用例执行结果与预期一致，功能实现正确。', 1, datetime('now'), datetime('now')),
    ('tit-tt', 'TT', '时序测试', '专项分析', 0, 'all', 19,
     '测试用例覆盖所有测试子项要求的全部内容。所有用例执行完毕，对于未执行的用例说明未执行原因。',
     '各测试步骤、测试用例执行结果与预期一致，功能实现正确。', 1, datetime('now'), datetime('now')),
    ('tit-pa', 'PA', '功耗分析', '专项分析', 0, 'all', 20,
     '测试用例覆盖所有测试子项要求的全部内容。所有用例执行完毕，对于未执行的用例说明未执行原因。',
     '各测试步骤、测试用例执行结果与预期一致，功能实现正确。', 1, datetime('now'), datetime('now')),
    ('tit-re', 'RE', '恢复性测试', '专项分析', 0, 'all', 21,
     '测试用例覆盖所有测试子项要求的全部内容。所有用例执行完毕，对于未执行的用例说明未执行原因。',
     '各测试步骤、测试用例执行结果与预期一致，功能实现正确。', 1, datetime('now'), datetime('now')),
    ('tit-dp', 'DP', '数据处理测试', '专项分析', 0, 'all', 22,
     '测试用例覆盖所有测试子项要求的全部内容。所有用例执行完毕，对于未执行的用例说明未执行原因。',
     '各测试步骤、测试用例执行结果与预期一致，功能实现正确。', 1, datetime('now'), datetime('now')),
    ('tit-dt', 'DT', '数据审查', '审查摸底', 0, 'all', 23,
     '测试用例覆盖所有测试子项要求的全部内容。所有用例执行完毕，对于未执行的用例说明未执行原因。',
     '各测试步骤、测试用例执行结果与预期一致，功能实现正确。', 1, datetime('now'), datetime('now')),
    ('tit-md', 'MD', '摸底测试', '审查摸底', 0, 'all', 24,
     '测试用例覆盖所有测试子项要求的全部内容。所有用例执行完毕，对于未执行的用例说明未执行原因。',
     '各测试步骤、测试用例执行结果与预期一致，功能实现正确。', 1, datetime('now'), datetime('now'));

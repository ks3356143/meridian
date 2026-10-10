-- 静态四类默认测试方法（来源：老项目默认话术，2026-10-10 用户要求"文档审查应有默认测试方法"）。
ALTER TABLE test_item_types ADD COLUMN default_test_method TEXT NOT NULL DEFAULT '';
ALTER TABLE test_item_types ADD COLUMN default_test_method_fpga TEXT NOT NULL DEFAULT '';

UPDATE test_item_types
SET default_test_method = '根据文档审查表人工逐项检查，检查此项目文档的齐套性、完整性、规范性：
1）使用人工审查方法，按照附录A中文档齐套性审查单检查需求类、设计类、用户类、测试类文档是否齐套；
2）使用人工审查方法，按照附录A中需求规格说明审查单对软件需求规格说明逐项检查；
3）使用人工审查方法，按照附录A中软件设计文档审查单逐项检查。'
WHERE code = 'DC';

UPDATE test_item_types
SET default_test_method = '根据静态分析的审查项和技术要求以及被测软件质量特性需求，编制检查单。使用静态分析工具Testbed和klocwork进行静态分析，对程序进行检查：
1）使用静态分析工具统计软件质量度量信息；
2）使用静态分析工具对软件进行规则检查；
3）使用静态分析工具结合人工分析对控制流和数据流进行分析。'
WHERE code = 'SA';

UPDATE test_item_types
SET default_test_method = '使用klocwork、testbed工具根据本大纲附录B中的代码审查单对代码审查范围内的源代码开展四个方面的审查，人工对所选模块进行如下四个方面的审查：
1）编程准则检查：依据编程准则的要求，对程序的编码与编程准则进行符合性检查；
2）代码流程审查：审查程序代码的条件判别、控制流程、数据处理等满足设计要求；
3）软件结构审查：依据设计文档，审查程序代码的结构设计的合理性，包括程序结构设计和数据结构设计；
4）需求实现审查：依据需求文档及其他相关资料，审查程序代码的需求层的功能实现是否正确。',
    default_test_method_fpga = '1）利用Vlink软件检查被测FPGA设计代码和编码规则的复合情况及设计结构的规范性；
2）利用Vchecker对软件设计代码进行跨时钟域分析；
3）使用人工审查方式根据附录中代码审查单，检查软件所有源代码，对编码规则中无法检查的命名规则、代码格式、文本格式、综合约束、设计方法、IP核配置进行审查；
4）对软件自主可控进行查验。'
WHERE code = 'CR';

UPDATE test_item_types
SET default_test_method = '人工对代码进行走查，针对代码设计具有代表性的走查用例，明确输入条件、走查步骤和执行结果'
WHERE code = 'CW';
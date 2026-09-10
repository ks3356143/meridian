import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FolderPlus, LoaderCircle, Save } from "lucide-react";
import { useMemo, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { projectsApi } from "@/features/projects/api";
import { BasicFields } from "@/features/projects/components/project-create/basic-fields";
import {
  initialBasicValues,
  type BasicProjectValues,
} from "@/features/projects/components/project-create/form-state";
import {
  DictionaryFields,
  type DictionarySelections,
} from "@/features/projects/components/project-create/dictionary-fields";
import { MemberFields } from "@/features/projects/components/project-create/member-fields";
import {
  StandardCountBadge,
  StandardField,
} from "@/features/projects/components/project-create/standard-field";
import type { CreateProjectPayload, DictionaryOption } from "@/features/projects/types";
import { gsap, useGSAP } from "@/lib/gsap";

const initialDictionarySelections: DictionarySelections = {
  language: [],
  runtime_environment: [],
  development_environment: [],
};

export function Component() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const containerRef = useRef<HTMLDivElement>(null);
  const optionsQuery = useQuery({
    queryKey: ["projects", "options"],
    queryFn: projectsApi.options,
  });

  const [basic, setBasic] = useState<BasicProjectValues>(initialBasicValues);
  const [dictionarySelections, setDictionarySelections] = useState(initialDictionarySelections);
  const [referenceStandardIds, setReferenceStandardIds] = useState<string[]>([]);
  const [customDictionaries, setCustomDictionaries] = useState<DictionaryOption[]>([]);
  const [ownerId, setOwnerId] = useState("");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [shouldShowErrors, setShouldShowErrors] = useState(false);
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});

  const selectedOwnerId = ownerId || optionsQuery.data?.users[0]?.id || "";

  useGSAP(
    () => {
      if (!containerRef.current) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      gsap.from(".project-create-reveal", {
        opacity: 0,
        y: 16,
        duration: 0.45,
        stagger: 0.06,
        ease: "power3.out",
      });
    },
    { scope: containerRef },
  );

  const dictionaryOptions = useMemo(() => {
    const existing = optionsQuery.data?.dictionaries ?? [];
    const seen = new Set(existing.map((item) => item.name.trim().toLowerCase()));
    const custom = customDictionaries.filter((item) => {
      const key = item.name.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return [...existing, ...custom];
  }, [customDictionaries, optionsQuery.data]);

  const createProject = useMutation({
    mutationFn: (payload: CreateProjectPayload) => projectsApi.create(payload),
    onSuccess: async (project) => {
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success(`项目 ${project.id} 创建成功`);
      navigate(`/projects/${project.id}`);
    },
  });

  const invalidGroups = {
    identifier: !/^\d{4,5}$/.test(basic.identifierSuffix),
    name: basic.name.trim().length === 0,
    language: dictionarySelections.language.length === 0,
    runtime_environment: dictionarySelections.runtime_environment.length === 0,
    development_environment: dictionarySelections.development_environment.length === 0,
    reference_standard: referenceStandardIds.length === 0,
    owner: !selectedOwnerId,
  };
  const errorMessages: Record<string, string> = {
    identifier: "请输入 4 到 5 位数字后缀",
    name: "请输入项目名称",

    language: "请选择编程语言",
    runtime_environment: "请选择运行环境",
    development_environment: "请选择开发环境",
    reference_standard: "请选择依据标准",
    owner: "请选择项目负责人",
  };
  const errors = Object.fromEntries(
    Object.keys(invalidGroups).map((field) => [
      field,
      invalidGroups[field as keyof typeof invalidGroups] &&
      (shouldShowErrors || touchedFields[field])
        ? errorMessages[field]
        : undefined,
    ]),
  );
  const missingGroups = Object.keys(invalidGroups)
    .filter((field) => invalidGroups[field as keyof typeof invalidGroups])
    .map((field) => errorMessages[field].replace(/^(请输入|请选择)/, ""));

  const markTouched = (field: string) =>
    setTouchedFields((previous) => (previous[field] ? previous : { ...previous, [field]: true }));

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (missingGroups.length > 0) {
      setShouldShowErrors(true);
      toast.error(`请先补齐：${missingGroups.join("、")}`);
      requestAnimationFrame(() => {
        containerRef.current?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
      });
      return;
    }

    createProject.mutate({
      identifierSuffix: basic.identifierSuffix,
      name: basic.name.trim(),
      nature: basic.nature,
      platform: basic.platform,
      softwareType: basic.softwareType,
      classification: basic.classification,
      securityLevel: basic.securityLevel,
      ownerId: selectedOwnerId,
      memberIds,
      languages: dictionarySelections.language,
      runtimeEnvironments: dictionarySelections.runtime_environment,
      developmentEnvironments: dictionarySelections.development_environment,
      referenceStandardIds,
    });
  };

  const handleOwnerChange = (userId: string) => {
    setOwnerId(userId);
    setMemberIds((previous) => previous.filter((id) => id !== userId));
  };

  if (optionsQuery.isPending) {
    return (
      <div className="flex min-h-80 items-center justify-center">
        <span className="text-muted-foreground flex items-center gap-2 text-sm">
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
          正在加载项目创建选项
        </span>
      </div>
    );
  }

  if (optionsQuery.isError) {
    return (
      <Card className="mx-auto w-full max-w-3xl">
        <CardHeader>
          <CardTitle>项目创建选项加载失败</CardTitle>
          <CardDescription>请确认后端服务已启动，然后重新加载。</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => optionsQuery.refetch()}>重新加载</Button>
        </CardContent>
      </Card>
    );
  }

  const options = optionsQuery.data;

  return (
    <div ref={containerRef} className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <header className="project-create-reveal flex flex-col gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground -ml-2 w-fit"
          onClick={() => navigate("/")}
        >
          <ArrowLeft data-icon="inline-start" />
          返回项目列表
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <span className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-sm">
            <FolderPlus className="size-5" aria-hidden />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">新建测评项目</h1>
              <Badge variant="secondary" className="h-5 text-[11px]">
                全部业务字段必填
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1 text-sm">
              项目是测评大纲、测试项、执行记录和报告的流程基点。
            </p>
          </div>
        </div>
      </header>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4 pb-4">
        <Card className="project-create-reveal">
          <CardHeader>
            <CardTitle>基本信息</CardTitle>
            <CardDescription>创建后项目标识不可复用，状态初始为编制大纲中。</CardDescription>
          </CardHeader>
          <CardContent>
            <BasicFields
              values={basic}
              errors={errors}
              onChange={(values) => setBasic((previous) => ({ ...previous, ...values }))}
              markTouched={markTouched}
            />
          </CardContent>
        </Card>

        <Card className="project-create-reveal">
          <CardHeader>
            <CardTitle>技术属性</CardTitle>
            <CardDescription>选项来自字典；新增自定义值会随项目一起保存进字典。</CardDescription>
          </CardHeader>
          <CardContent>
            <DictionaryFields
              options={dictionaryOptions}
              selections={dictionarySelections}
              errors={{
                language: errors.language,
                runtime_environment: errors.runtime_environment,
                development_environment: errors.development_environment,
              }}
              onChange={(category, values) =>
                setDictionarySelections((previous) => ({ ...previous, [category]: values }))
              }
              onCustom={setCustomDictionaries}
            />
          </CardContent>
        </Card>

        <Card className="project-create-reveal">
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              依据标准
              <StandardCountBadge count={referenceStandardIds.length} />
            </CardTitle>
            <CardDescription>按字典顺序渲染到后续测评大纲的依据文件章节。</CardDescription>
          </CardHeader>
          <CardContent>
            <StandardField
              standards={options.standards}
              selectedIds={referenceStandardIds}
              error={errors.reference_standard}
              onChange={setReferenceStandardIds}
            />
          </CardContent>
        </Card>

        <Card className="project-create-reveal">
          <CardHeader>
            <CardTitle>项目人员</CardTitle>
            <CardDescription>负责人必选，负责人自动成为项目成员。</CardDescription>
          </CardHeader>
          <CardContent>
            <MemberFields
              users={options.users}
              selectedOwnerId={selectedOwnerId}
              memberIds={memberIds}
              ownerError={errors.owner}
              onOwnerChange={handleOwnerChange}
              onMembersChange={setMemberIds}
            />
          </CardContent>
        </Card>

        <div className="border-border bg-card/80 elevation-1 project-create-reveal sticky bottom-0 flex flex-wrap items-center justify-between gap-3 rounded-sm border p-3 backdrop-blur">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5" aria-live="polite">
            {missingGroups.length > 0 ? (
              missingGroups.map((group) => (
                <Badge key={group} variant="warning" className="h-5 text-[11px]">
                  待填 {group}
                </Badge>
              ))
            ) : (
              <Badge variant="success" className="h-5 text-[11px]">
                必填项已齐
              </Badge>
            )}
          </div>
          <Button type="button" variant="outline" onClick={() => navigate("/")}>
            取消
          </Button>
          <Button type="submit" disabled={createProject.isPending}>
            {createProject.isPending ? (
              <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />
            ) : (
              <Save data-icon="inline-start" />
            )}
            创建项目
          </Button>
        </div>
      </form>
    </div>
  );
}

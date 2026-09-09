import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FolderPlus, LoaderCircle, Plus, Save } from "lucide-react";
import { useMemo, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { projectsApi } from "@/features/projects/api";
import type {
  CreateProjectPayload,
  DictionaryOption,
  ProjectClassification,
  ProjectNature,
  ProjectPlatform,
  SecurityLevel,
  SoftwareType,
} from "@/features/projects/types";
import { gsap, useGSAP } from "@/lib/gsap";

const natureOptions: ProjectNature[] = ["鉴定测评", "第三方测评", "二方测评"];
const platformOptions: ProjectPlatform[] = ["FPGA", "CPU/非嵌"];
const softwareTypeOptions: SoftwareType[] = ["新研", "改造", "沿用"];
const classificationOptions: ProjectClassification[] = ["公开", "内部", "秘密", "机密", "绝密"];
const securityLevelLabels: Record<SecurityLevel, string> = {
  A: "关键A",
  B: "重要B",
  C: "一般C",
  D: "不重要D",
};

export function Component() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const containerRef = useRef<HTMLDivElement>(null);
  const optionsQuery = useQuery({
    queryKey: ["projects", "options"],
    queryFn: projectsApi.options,
  });

  const [identifierSuffix, setIdentifierSuffix] = useState("");
  const [name, setName] = useState("");
  const [organization, setOrganization] = useState("");
  const [nature, setNature] = useState<ProjectNature>("鉴定测评");
  const [platform, setPlatform] = useState<ProjectPlatform>("CPU/非嵌");
  const [softwareType, setSoftwareType] = useState<SoftwareType>("新研");
  const [classification, setClassification] = useState<ProjectClassification>("内部");
  const [securityLevel, setSecurityLevel] = useState<SecurityLevel>("C");
  const [ownerId, setOwnerId] = useState("");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [runtimeEnvironments, setRuntimeEnvironments] = useState<string[]>([]);
  const [developmentEnvironments, setDevelopmentEnvironments] = useState<string[]>([]);
  const [referenceStandardIds, setReferenceStandardIds] = useState<string[]>([]);
  const [customDictionaries, setCustomDictionaries] = useState<DictionaryOption[]>([]);
  const [memberKeyword, setMemberKeyword] = useState("");

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

  const filteredUsers = useMemo(() => {
    const keyword = memberKeyword.trim().toLowerCase();
    const users = optionsQuery.data?.users ?? [];
    if (!keyword) return users;
    return users.filter((user) =>
      [user.displayName, user.username].some((field) => field.toLowerCase().includes(keyword)),
    );
  }, [memberKeyword, optionsQuery.data]);

  const createProject = useMutation({
    mutationFn: (payload: CreateProjectPayload) => projectsApi.create(payload),
    onSuccess: async (project) => {
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success(`项目 ${project.id} 创建成功`);
      navigate(`/projects/${project.id}`);
    },
  });

  const canSubmit =
    /^\d{4}$/.test(identifierSuffix) &&
    name.trim().length > 0 &&
    organization.trim().length > 0 &&
    Boolean(selectedOwnerId) &&
    !createProject.isPending;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) {
      toast.error("请先补齐项目标识、名称、研制单位和负责人");
      return;
    }

    createProject.mutate({
      identifierSuffix,
      name: name.trim(),
      nature,
      platform,
      softwareType,
      classification,
      securityLevel,
      organization: organization.trim(),
      ownerId: selectedOwnerId,
      memberIds,
      languages,
      runtimeEnvironments,
      developmentEnvironments,
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
          返回项目组合
        </Button>
        <div className="flex items-center gap-3">
          <span className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-sm">
            <FolderPlus className="size-5" aria-hidden />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">新建测评项目</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              项目是测评大纲、测试项、执行记录和报告的流程基点。
            </p>
          </div>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 pb-4">
        <Card className="project-create-reveal">
          <CardHeader>
            <CardTitle>基本信息</CardTitle>
            <CardDescription>创建后项目标识不可复用，状态初始为编制大纲中。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="project-identifier">项目标识</Label>
              <div className="input-elevated flex h-8 items-center overflow-hidden rounded-sm border border-input bg-card/80 transition-[box-shadow] focus-within:ring-3 focus-within:ring-ring/50">
                <span className="bg-muted text-muted-foreground flex h-full min-w-9 items-center justify-center border-r border-input px-2 font-mono text-sm">
                  R
                </span>
                <Input
                  id="project-identifier"
                  value={identifierSuffix}
                  onChange={(event) =>
                    setIdentifierSuffix(event.target.value.replace(/\D/g, "").slice(0, 4))
                  }
                  placeholder="2607"
                  inputMode="numeric"
                  pattern="\d{4}"
                  maxLength={4}
                  required
                  className="h-full rounded-none border-0 bg-transparent px-2 font-mono shadow-none focus-visible:ring-0"
                />
              </div>
              <p className="text-muted-foreground text-xs">输入后四位数字，完整标识如 R2607。</p>
            </div>

            <TextField
              id="project-name"
              label="项目名称"
              value={name}
              onChange={setName}
              placeholder="例：XX03 探测单元鉴定测评"
              required
            />
            <TextField
              id="project-organization"
              label="研制单位"
              value={organization}
              onChange={setOrganization}
              placeholder="例：XX研究所"
              required
            />

            <RadioField
              label="测评性质"
              value={nature}
              options={natureOptions}
              onChange={(value) => setNature(value as ProjectNature)}
            />
            <RadioField
              label="测试平台"
              value={platform}
              options={platformOptions}
              onChange={(value) => setPlatform(value as ProjectPlatform)}
            />
            <RadioField
              label="软件类型"
              value={softwareType}
              options={softwareTypeOptions}
              onChange={(value) => setSoftwareType(value as SoftwareType)}
            />
            <RadioField
              label="安全等级"
              value={securityLevel}
              options={Object.keys(securityLevelLabels) as SecurityLevel[]}
              labels={securityLevelLabels}
              onChange={(value) => setSecurityLevel(value as SecurityLevel)}
            />

            <div className="flex flex-col gap-2">
              <Label htmlFor="project-classification">密级</Label>
              <Select
                value={classification}
                onValueChange={(value) => setClassification(value as ProjectClassification)}
              >
                <SelectTrigger id="project-classification" className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {classificationOptions.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">生成 Word 首页时按密级展示。</p>
            </div>
          </CardContent>
        </Card>

        <Card className="project-create-reveal">
          <CardHeader>
            <CardTitle>技术属性</CardTitle>
            <CardDescription>选项来自字典；新增自定义值会随项目一起保存进字典。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 lg:grid-cols-3">
            <DictionaryField
              label="编程语言"
              category="language"
              options={dictionaryOptions}
              selected={languages}
              onChange={setLanguages}
              onCustom={setCustomDictionaries}
            />
            <DictionaryField
              label="运行环境"
              category="runtime_environment"
              options={dictionaryOptions}
              selected={runtimeEnvironments}
              onChange={setRuntimeEnvironments}
              onCustom={setCustomDictionaries}
            />
            <DictionaryField
              label="开发环境"
              category="development_environment"
              options={dictionaryOptions}
              selected={developmentEnvironments}
              onChange={setDevelopmentEnvironments}
              onCustom={setCustomDictionaries}
            />
          </CardContent>
        </Card>

        <Card className="project-create-reveal">
          <CardHeader>
            <CardTitle>依据标准</CardTitle>
            <CardDescription>按字典顺序渲染到后续测评大纲的依据文件章节。</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 md:grid-cols-2">
              {options.standards.map((standard) => {
                const checked = referenceStandardIds.includes(standard.id);
                return (
                  <label
                    key={standard.id}
                    htmlFor={standard.id}
                    className="border-border bg-card/60 has-data-[state=checked]:border-primary/35 has-data-[state=checked]:bg-primary/6 flex cursor-pointer items-start gap-3 rounded-sm border p-3 transition-[background-color,border-color,box-shadow] duration-200 hover:shadow-[0_6px_16px_-12px_rgb(20_42_30_/_0.55)]"
                  >
                    <Checkbox
                      id={standard.id}
                      checked={checked}
                      onCheckedChange={() =>
                        setReferenceStandardIds((previous) =>
                          checked
                            ? previous.filter((id) => id !== standard.id)
                            : [...previous, standard.id],
                        )
                      }
                      className="mt-0.5"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{standard.name}</span>
                      <span className="text-muted-foreground mt-0.5 block text-xs">
                        {[standard.publishedDate, standard.source].filter(Boolean).join(" · ") ||
                          "--"}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="project-create-reveal">
          <CardHeader>
            <CardTitle>项目人员</CardTitle>
            <CardDescription>负责人必选，负责人自动成为项目成员。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-[minmax(240px,320px)_1fr]">
            <div className="flex flex-col gap-2">
              <Label htmlFor="project-owner">项目负责人</Label>
              <Select value={selectedOwnerId} onValueChange={handleOwnerChange}>
                <SelectTrigger id="project-owner" className="text-sm">
                  <SelectValue placeholder="选择负责人" />
                </SelectTrigger>
                <SelectContent>
                  {options.users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.displayName}（{user.username}）
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm leading-none font-medium">项目成员</span>
                <Input
                  value={memberKeyword}
                  onChange={(event) => setMemberKeyword(event.target.value)}
                  placeholder="搜索成员"
                  className="h-7 sm:w-48"
                />
              </div>
              <div className="grid max-h-56 gap-2 overflow-y-auto pr-1 md:grid-cols-2">
                {filteredUsers
                  .filter((user) => user.id !== selectedOwnerId)
                  .map((user) => {
                    const checked = memberIds.includes(user.id);
                    return (
                      <label
                        key={user.id}
                        htmlFor={user.id}
                        className="border-border bg-card/60 has-data-[state=checked]:border-primary/35 has-data-[state=checked]:bg-primary/6 flex cursor-pointer items-center gap-3 rounded-sm border px-3 py-2 transition-[background-color,border-color] duration-200"
                      >
                        <Checkbox
                          id={user.id}
                          checked={checked}
                          onCheckedChange={() =>
                            setMemberIds((previous) =>
                              checked
                                ? previous.filter((id) => id !== user.id)
                                : [...previous, user.id],
                            )
                          }
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">
                            {user.displayName}
                          </span>
                          <span className="text-muted-foreground block font-mono text-xs">
                            {user.username}
                          </span>
                        </span>
                      </label>
                    );
                  })}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="border-border bg-card/80 elevation-1 project-create-reveal sticky bottom-0 flex items-center justify-end gap-2 rounded-sm border p-3 backdrop-blur">
          <Button type="button" variant="outline" onClick={() => navigate("/")}>
            取消
          </Button>
          <Button type="submit" disabled={!canSubmit}>
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

function TextField({
  id,
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
      />
    </div>
  );
}

function RadioField({
  label,
  value,
  options,
  labels,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  labels?: Record<string, string>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm leading-none font-medium">{label}</span>
      <RadioGroup
        aria-label={label}
        value={value}
        onValueChange={onChange}
        className="grid grid-cols-2 gap-2"
      >
        {options.map((option) => (
          <label
            key={option}
            className="border-border bg-card/60 has-data-[state=checked]:border-primary/35 has-data-[state=checked]:bg-primary/6 flex min-h-8 cursor-pointer items-center gap-2 rounded-sm border px-3 text-sm transition-[background-color,border-color,box-shadow] duration-200 hover:shadow-[0_4px_12px_-10px_rgb(20_42_30_/_0.6)]"
          >
            <RadioGroupItem value={option} />
            {labels?.[option] ?? option}
          </label>
        ))}
      </RadioGroup>
    </div>
  );
}

function DictionaryField({
  label,
  category,
  options,
  selected,
  onChange,
  onCustom,
}: {
  label: string;
  category: DictionaryOption["category"];
  options: DictionaryOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  onCustom: (updater: (previous: DictionaryOption[]) => DictionaryOption[]) => void;
}) {
  const categoryOptions = options.filter((option) => option.category === category);
  const [customValue, setCustomValue] = useState("");

  const addCustom = () => {
    const value = customValue.trim();
    if (!value) return;
    if (categoryOptions.some((option) => option.name.toLowerCase() === value.toLowerCase())) {
      toast.info("该选项已在字典中");
      setCustomValue("");
      return;
    }

    onCustom((previous) => [
      {
        id: `custom-${category}-${value.toLowerCase()}`,
        category,
        name: value,
        sortOrder: categoryOptions.length + 1,
        isEnabled: true,
        isPreset: false,
      },
      ...previous,
    ]);
    onChange([...selected, value]);
    setCustomValue("");
  };

  return (
    <div role="group" aria-label={label} className="flex flex-col gap-2">
      <span className="text-sm leading-none font-medium">{label}</span>
      <div className="flex flex-wrap gap-2">
        {categoryOptions.map((option) => {
          const checked = selected.includes(option.name);
          return (
            <label
              key={option.id}
              className="border-border bg-card/60 has-data-[state=checked]:border-primary/35 has-data-[state=checked]:bg-primary/6 flex min-h-8 cursor-pointer items-center gap-2 rounded-sm border px-2.5 text-xs transition-[background-color,border-color,box-shadow] duration-200"
            >
              <Checkbox
                checked={checked}
                onCheckedChange={() =>
                  onChange(
                    checked
                      ? selected.filter((value) => value !== option.name)
                      : [...selected, option.name],
                  )
                }
              />
              {option.name}
            </label>
          );
        })}
      </div>
      <div className="flex gap-2">
        <Input
          value={customValue}
          onChange={(event) => setCustomValue(event.target.value)}
          placeholder="自定义选项"
          className="h-7 text-xs"
        />
        <Button type="button" variant="outline" size="sm" onClick={addCustom}>
          <Plus data-icon="inline-start" />
          添加
        </Button>
      </div>
    </div>
  );
}

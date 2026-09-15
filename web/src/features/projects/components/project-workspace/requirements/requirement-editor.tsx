import { Check, Copy, FilePlus2, FolderPlus, Loader2, Save } from "lucide-react";
import {
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { MultiSelectCombobox } from "@/components/shared/multi-select-combobox";
import type {
  RequirementPrimaryKind,
  RequirementSection,
  RequirementSource,
  SoftwareRequirement,
} from "@/features/requirements/types";
import {
  getPrimaryKindMeta,
  primaryKindOptions,
  statusMeta,
  suggestChapterNumber,
  type RequirementTreeNode,
} from "./requirement-model";

const tagOptions = [
  "初始化",
  "数据处理",
  "接口",
  "时序",
  "安全",
  "可靠性",
  "故障处理",
  "人机交互",
  "边界值",
  "其他",
].map((value) => ({ value, label: value }));

type EditorMode = "section" | "requirement";

type FormValues = {
  chapterNumber: string;
  externalIdentifier: string;
  name: string;
  description: string;
  primaryKind: RequirementPrimaryKind;
  tags: string[];
};

export function RequirementEditor({
  source,
  sections,
  selectedNode,
  copySource,
  creatingSection,
  creatingRequirement,
  updatingRequirement,
  onCreateSection,
  onCreateRequirement,
  onUpdateRequirement,
  onCopyRequirement,
  onDiscardCopy,
}: {
  source: RequirementSource;
  sections: RequirementSection[];
  selectedNode: RequirementTreeNode | null;
  copySource: SoftwareRequirement | null;
  creatingSection: boolean;
  creatingRequirement: boolean;
  updatingRequirement: boolean;
  onCreateSection: (payload: {
    sourceVersionId: string;
    parentId?: string;
    chapterNumber: string;
    title: string;
  }) => Promise<unknown>;
  onCreateRequirement: (payload: {
    sourceVersionId: string;
    sectionId?: string;
    chapterNumber: string;
    externalIdentifier: string;
    name: string;
    description: string;
    primaryKind: string;
    tags: string[];
  }) => Promise<unknown>;
  onUpdateRequirement: (
    requirementId: string,
    payload: {
      sectionId?: string;
      chapterNumber: string;
      externalIdentifier: string;
      name: string;
      description: string;
      primaryKind: string;
      tags: string[];
    },
  ) => Promise<unknown>;
  onCopyRequirement: (requirement: SoftwareRequirement) => void;
  onDiscardCopy: () => void;
}) {
  const requirement = selectedNode?.requirement;
  const copiedFrom = copySource && !requirement ? copySource : null;
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<EditorMode>("requirement");
  const suggestedChapter = useMemo(
    () => suggestChapterNumber(sections, selectedNode?.section?.chapterNumber ?? ""),
    [sections, selectedNode?.section?.chapterNumber],
  );
  const [sectionValues, setSectionValues] = useState({
    chapterNumber: suggestedChapter,
    title: "",
  });
  const [values, setValues] = useState<FormValues>({
    chapterNumber: copiedFrom
      ? nextSiblingChapter(copiedFrom.chapterNumber)
      : (requirement?.chapterNumber ?? suggestedChapter),
    externalIdentifier: copiedFrom ? "" : (requirement?.externalIdentifier ?? ""),
    name: copiedFrom?.name ?? requirement?.name ?? "",
    description: copiedFrom?.description ?? requirement?.description ?? "",
    primaryKind: copiedFrom?.primaryKind ?? requirement?.primaryKind ?? "functional",
    tags: copiedFrom?.tags ?? requirement?.tags ?? [],
  });

  const parentSection = selectedNode?.section;
  const parentChapter = parentSection?.chapterNumber ?? "";

  const saveUpdate = async () => {
    await onUpdateRequirement(requirement!.id, {
      sectionId: requirement!.sectionId,
      chapterNumber: values.chapterNumber,
      externalIdentifier: values.externalIdentifier,
      name: values.name,
      description: values.description,
      primaryKind: values.primaryKind,
      tags: values.tags,
    });
  };

  const saveSection = async () => {
    await onCreateSection({
      sourceVersionId: source.id,
      parentId: parentSection?.id,
      chapterNumber: sectionValues.chapterNumber,
      title: sectionValues.title,
    });
  };

  const saveRequirement = async () => {
    await onCreateRequirement({
      sourceVersionId: source.id,
      sectionId: parentSection?.id,
      chapterNumber: values.chapterNumber,
      externalIdentifier: values.externalIdentifier,
      name: values.name,
      description: values.description,
      primaryKind: values.primaryKind,
      tags: values.tags,
    });
    setValues((previous) => ({
      chapterNumber: nextSiblingChapter(previous.chapterNumber),
      externalIdentifier: "",
      name: "",
      description: "",
      primaryKind: previous.primaryKind,
      tags: previous.tags,
    }));
    nameInputRef.current?.focus();
  };

  return (
    <section className="requirement-editor" aria-labelledby="requirement-editor-title">
      <header className="requirement-editor-header">
        <div className="min-w-0">
          <p className="requirement-editor-eyebrow">
            {source.objectName} · {source.version}
          </p>
          <h3 id="requirement-editor-title">
            {requirement ? "编辑软件需求" : copiedFrom ? "复制软件需求" : "手动建立需求树"}
          </h3>
          <p className="requirement-editor-description">
            {requirement
              ? `${requirement.chapterNumber} ${requirement.name}`
              : copiedFrom
                ? `复制自 ${copiedFrom.chapterNumber} ${copiedFrom.name}`
                : `当前父章节：${parentChapter || "根目录"}`}
          </p>
        </div>
        {requirement ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => onCopyRequirement(requirement)}
            >
              <Copy data-icon="inline-start" aria-hidden />
              复制新增
            </Button>
            <Badge variant={statusMeta[requirement.status].variant}>
              {statusMeta[requirement.status].label}
            </Badge>
            <Badge variant={getPrimaryKindMeta(requirement.primaryKind).variant}>
              {getPrimaryKindMeta(requirement.primaryKind).label}
            </Badge>
            {requirement.testItemTaskStatus === "pending" ? (
              <Badge variant="info">测试项待创建</Badge>
            ) : null}
          </div>
        ) : copiedFrom ? (
          <Button type="button" variant="outline" size="xs" onClick={onDiscardCopy}>
            取消复制
          </Button>
        ) : (
          <Tabs value={mode} onValueChange={(value) => setMode(value as EditorMode)}>
            <TabsList>
              <TabsTrigger value="requirement">
                <FilePlus2 aria-hidden />
                需求
              </TabsTrigger>
              <TabsTrigger value="section">
                <FolderPlus aria-hidden />
                章节
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}
      </header>

      {requirement ? (
        <form
          className="requirement-form"
          onSubmit={(event) => {
            event.preventDefault();
            void saveUpdate();
          }}
        >
          <RequirementFields values={values} onChange={setValues} nameInputRef={nameInputRef} />
          <div className="requirement-form-actions">
            <Button type="submit" disabled={updatingRequirement}>
              {updatingRequirement ? (
                <Loader2 data-icon="inline-start" className="animate-spin" aria-hidden />
              ) : (
                <Save data-icon="inline-start" aria-hidden />
              )}
              保存修改
            </Button>
          </div>
        </form>
      ) : mode === "section" ? (
        <form
          className="requirement-form"
          onSubmit={(event) => {
            event.preventDefault();
            void saveSection();
          }}
        >
          <FieldGroup className="gap-3">
            <Field>
              <FieldLabel htmlFor="requirement-section-chapter">章节号</FieldLabel>
              <Input
                id="requirement-section-chapter"
                value={sectionValues.chapterNumber}
                onChange={(event) =>
                  setSectionValues((previous) => ({
                    ...previous,
                    chapterNumber: event.target.value,
                  }))
                }
                required
              />
              <FieldDescription>必须与 SRS 实际章节号一致。</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="requirement-section-title">章节标题</FieldLabel>
              <Input
                id="requirement-section-title"
                value={sectionValues.title}
                onChange={(event) =>
                  setSectionValues((previous) => ({ ...previous, title: event.target.value }))
                }
                required
              />
            </Field>
          </FieldGroup>
          <div className="requirement-form-actions">
            <Button type="submit" disabled={creatingSection}>
              {creatingSection ? (
                <Loader2 data-icon="inline-start" className="animate-spin" aria-hidden />
              ) : (
                <FolderPlus data-icon="inline-start" aria-hidden />
              )}
              保存章节
            </Button>
          </div>
        </form>
      ) : (
        <form
          className="requirement-form"
          onSubmit={(event) => {
            event.preventDefault();
            void saveRequirement();
          }}
        >
          <RequirementFields values={values} onChange={setValues} nameInputRef={nameInputRef} />
          <div className="requirement-form-actions">
            <Button type="submit" disabled={creatingRequirement}>
              {creatingRequirement ? (
                <Loader2 data-icon="inline-start" className="animate-spin" aria-hidden />
              ) : (
                <Check data-icon="inline-start" aria-hidden />
              )}
              保存并继续
            </Button>
          </div>
        </form>
      )}

      {requirement?.sourceAnchor ? (
        <footer className="requirement-source-anchor">
          <span>原文锚点</span>
          <strong>{requirement.sourceAnchor}</strong>
        </footer>
      ) : null}
    </section>
  );
}

function nextSiblingChapter(chapter: string): string {
  const parts = chapter.split(".").filter(Boolean);
  if (!parts.length) return "";
  const last = Number(parts.at(-1));
  if (!Number.isFinite(last)) return chapter;
  parts[parts.length - 1] = String(last + 1);
  return parts.join(".");
}

function RequirementFields({
  values,
  onChange,
  nameInputRef,
}: {
  values: FormValues;
  onChange: (values: FormValues) => void;
  nameInputRef: RefObject<HTMLInputElement | null>;
}) {
  const submitOnCtrlEnter = (event: ReactKeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (!event.ctrlKey || event.key !== "Enter") return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  };

  return (
    <FieldGroup className="gap-3">
      <div className="grid gap-3 md:grid-cols-[8rem_minmax(0,1fr)_11rem]">
        <Field>
          <FieldLabel htmlFor="requirement-chapter">章节号</FieldLabel>
          <Input
            id="requirement-chapter"
            onKeyDown={submitOnCtrlEnter}
            value={values.chapterNumber}
            onChange={(event) => onChange({ ...values, chapterNumber: event.target.value })}
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="requirement-name">需求名称</FieldLabel>
          <Input
            id="requirement-name"
            ref={nameInputRef}
            onKeyDown={submitOnCtrlEnter}
            value={values.name}
            onChange={(event) => onChange({ ...values, name: event.target.value })}
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="requirement-external-id">外部标识</FieldLabel>
          <Input
            id="requirement-external-id"
            onKeyDown={submitOnCtrlEnter}
            value={values.externalIdentifier}
            onChange={(event) => onChange({ ...values, externalIdentifier: event.target.value })}
            placeholder="如 A1"
          />
        </Field>
      </div>
      <div className="grid gap-3 md:grid-cols-[11rem_minmax(0,1fr)]">
        <Field>
          <FieldLabel htmlFor="requirement-kind">主需求性质</FieldLabel>
          <Select
            value={values.primaryKind}
            onValueChange={(value) =>
              onChange({ ...values, primaryKind: value as RequirementPrimaryKind })
            }
          >
            <SelectTrigger id="requirement-kind" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {primaryKindOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="requirement-tags">附加标签</FieldLabel>
          <MultiSelectCombobox
            id="requirement-tags"
            ariaLabel="选择附加标签"
            options={tagOptions}
            value={values.tags}
            onChange={(tags) => onChange({ ...values, tags })}
            placeholder="选择或留空"
          />
        </Field>
      </div>
      <Field>
        <FieldLabel htmlFor="requirement-description">需求描述</FieldLabel>
        <Textarea
          id="requirement-description"
          onKeyDown={submitOnCtrlEnter}
          value={values.description}
          onChange={(event) => onChange({ ...values, description: event.target.value })}
          required
          rows={4}
        />
        <FieldDescription>第一版保留换行；富文本、图片和表格将在后续版本接入。</FieldDescription>
      </Field>
    </FieldGroup>
  );
}

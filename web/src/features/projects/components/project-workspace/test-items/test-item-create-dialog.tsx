import { useMemo, useState } from "react";
import { FolderPlus, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CreateTestItemFolderPayload, CreateTestItemPayload } from "@/features/test-items/api";
import type { TestItemFolder, TestItemRecord, TestItemType } from "@/features/test-items/types";
import { TypePicker } from "./test-item-type-picker";
import styles from "./test-item-create-dialog.module.css";

function RequiredMark() {
  return (
    <>
      <span className="text-destructive" aria-hidden>
        *
      </span>
      <span className="sr-only">（必填）</span>
    </>
  );
}

const PRIORITIES = ["高", "中", "低"];
const NO_FOLDER = "__none__";

export function CreateTestItemDialog({
  open,
  types,
  folders,
  usedStaticCodes,
  submitting,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  types: TestItemType[];
  folders: TestItemFolder[];
  /** 本轮已存在的静态类型代号：DC/SA/CR/CW 每轮各一个，已存在的类型不再出现在选项里。 */
  usedStaticCodes: string[];
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: CreateTestItemPayload) => Promise<TestItemRecord>;
}) {
  const usedStatic = useMemo(() => new Set(usedStaticCodes), [usedStaticCodes]);
  const availableTypes = useMemo(
    () => types.filter((type) => !type.isStatic || !usedStatic.has(type.code)),
    [types, usedStatic],
  );
  const hiddenStaticCount = types.length - availableTypes.length;

  const [typeCode, setTypeCode] = useState("");
  const [name, setName] = useState("");
  const [suffix, setSuffix] = useState("");
  const [priority, setPriority] = useState("高");
  const [folderId, setFolderId] = useState(NO_FOLDER);
  const [implicit, setImplicit] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // 默认选中"功能测试"（无功能类类型时取第一个可用类型），优先级默认高。
  const defaultTypeCode = useMemo(() => {
    const preferred =
      availableTypes.find((type) => type.category === "功能验证") ?? availableTypes[0];
    return preferred?.code ?? "";
  }, [availableTypes]);
  const selectedTypeCode = typeCode === "" ? defaultTypeCode : typeCode;

  const folderOptions = useMemo(
    () => folders.filter((folder) => folder.typeCode === selectedTypeCode),
    [folders, selectedTypeCode],
  );
  const errors = {
    typeCode: selectedTypeCode === "" ? "请选择测试项类型" : undefined,
    name: name.trim() === "" ? "测试项名称必填" : undefined,
  };
  const valid = Object.values(errors).every((error) => !error);

  const reset = () => {
    setTypeCode("");
    setName("");
    setSuffix("");
    setPriority("高");
    setFolderId(NO_FOLDER);
    setImplicit(false);
    setSubmitted(false);
  };

  const handleSubmit = async () => {
    setSubmitted(true);
    if (!valid) {
      toast.error(errors.typeCode ?? errors.name ?? "请检查表单");
      return;
    }
    await onSubmit({
      typeCode: selectedTypeCode,
      name: name.trim(),
      suffix: suffix.trim() || undefined,
      priority,
      folderId: folderId === NO_FOLDER ? null : folderId,
      implicitRequirement: implicit,
    });
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className={styles.dialogContent}>
        <DialogHeader>
          <DialogTitle className={styles.dialogTitle}>新增测试项</DialogTitle>
          <DialogDescription>
            选类型与名称即可创建；标识留空按名称拼音自动生成，充分性要求与通过准则按类型预填。
            {hiddenStaticCount > 0
              ? ` 本轮已有 ${hiddenStaticCount} 类静态测试项（DC/SA/CR/CW 各一个），已从选项中收起。`
              : ""}
          </DialogDescription>
        </DialogHeader>
        <form
          className={styles.form}
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void handleSubmit();
          }}
        >
          <div className={styles.grid}>
            <Field data-invalid={submitted && errors.typeCode ? true : undefined}>
              <FieldLabel htmlFor="test-item-type">
                测试项类型
                <RequiredMark />
              </FieldLabel>
              <TypePicker
                id="test-item-type"
                types={availableTypes}
                value={selectedTypeCode}
                invalid={Boolean(submitted && errors.typeCode)}
                onChange={(code) => {
                  setTypeCode(code);
                  setFolderId(NO_FOLDER);
                }}
              />
              <FieldError>{submitted ? errors.typeCode : undefined}</FieldError>
            </Field>

            <Field data-invalid={submitted && errors.name ? true : undefined}>
              <FieldLabel htmlFor="test-item-name">
                测试项名称
                <RequiredMark />
              </FieldLabel>
              <Input
                id="test-item-name"
                value={name}
                aria-invalid={submitted && errors.name ? true : undefined}
                onChange={(event) => setName(event.target.value)}
              />
              <FieldError>{submitted ? errors.name : undefined}</FieldError>
            </Field>

            <Field>
              <FieldLabel htmlFor="test-item-suffix">标识后缀（可留空）</FieldLabel>
              <Input
                id="test-item-suffix"
                value={suffix}
                placeholder="自动生成"
                onChange={(event) => setSuffix(event.target.value.toUpperCase())}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="test-item-priority">优先级</FieldLabel>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger id="test-item-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field className={styles.gridFull}>
              <FieldLabel htmlFor="test-item-folder">所属文件夹（可留空）</FieldLabel>
              <Select
                value={folderId}
                onValueChange={setFolderId}
                disabled={folderOptions.length === 0}
              >
                <SelectTrigger id="test-item-folder">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_FOLDER}>不放入文件夹</SelectItem>
                  {folderOptions.map((folder) => (
                    <SelectItem key={folder.id} value={folder.id}>
                      {folder.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <label className={styles.implicitRow} htmlFor="test-item-implicit">
            <Checkbox
              id="test-item-implicit"
              checked={implicit}
              onCheckedChange={(checked) => setImplicit(checked === true)}
            />
            <span className={styles.implicitIcon} aria-hidden>
              <Sparkles />
            </span>
            <span className={styles.implicitText}>
              <strong>隐含需求</strong>
              <span>
                本项不关联需求，按隐含需求处理（树上带琥珀色标记，完善度的追踪关系按已满足计）
              </span>
            </span>
          </label>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={submitting} className={styles.submitButton}>
              <Plus aria-hidden />
              {submitting ? "创建中…" : "创建测试项"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CreateFolderDialog({
  open,
  types,
  folders,
  submitting,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  types: TestItemType[];
  folders: TestItemFolder[];
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: CreateTestItemFolderPayload) => Promise<TestItemFolder>;
}) {
  const [typeCode, setTypeCode] = useState("");
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState(NO_FOLDER);
  const [submitted, setSubmitted] = useState(false);

  const parentOptions = useMemo(
    () => folders.filter((folder) => folder.typeCode === typeCode),
    [folders, typeCode],
  );
  const errors = {
    typeCode: typeCode === "" ? "请选择文件夹所属类型" : undefined,
    name: name.trim() === "" ? "文件夹名称必填" : undefined,
  };
  const valid = Object.values(errors).every((error) => !error);

  const reset = () => {
    setTypeCode("");
    setName("");
    setParentId(NO_FOLDER);
    setSubmitted(false);
  };

  const handleSubmit = async () => {
    setSubmitted(true);
    if (!valid) {
      toast.error(errors.typeCode ?? errors.name ?? "请检查表单");
      return;
    }
    await onSubmit({
      typeCode,
      name: name.trim(),
      parentId: parentId === NO_FOLDER ? null : parentId,
    });
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>新建文件夹</DialogTitle>
          <DialogDescription>文件夹限装同一类型测试项，用于分组组织测试项。</DialogDescription>
        </DialogHeader>
        <form
          className={styles.form}
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void handleSubmit();
          }}
        >
          <Field data-invalid={submitted && errors.typeCode ? true : undefined}>
            <FieldLabel htmlFor="test-folder-type">
              所属类型
              <RequiredMark />
            </FieldLabel>
            <TypePicker
              id="test-folder-type"
              types={types}
              value={typeCode}
              invalid={Boolean(submitted && errors.typeCode)}
              onChange={(code) => {
                setTypeCode(code);
                setParentId(NO_FOLDER);
              }}
            />
            <FieldError>{submitted ? errors.typeCode : undefined}</FieldError>
          </Field>

          <Field data-invalid={submitted && errors.name ? true : undefined}>
            <FieldLabel htmlFor="test-folder-name">
              文件夹名称
              <RequiredMark />
            </FieldLabel>
            <Input
              id="test-folder-name"
              value={name}
              aria-invalid={submitted && errors.name ? true : undefined}
              onChange={(event) => setName(event.target.value)}
            />
            <FieldError>{submitted ? errors.name : undefined}</FieldError>
          </Field>

          {parentOptions.length > 0 ? (
            <Field>
              <FieldLabel htmlFor="test-folder-parent">上级文件夹（可留空）</FieldLabel>
              <Select value={parentId} onValueChange={setParentId}>
                <SelectTrigger id="test-folder-parent">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_FOLDER}>置于类型根下</SelectItem>
                  {parentOptions.map((folder) => (
                    <SelectItem key={folder.id} value={folder.id}>
                      {folder.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={submitting}>
              <FolderPlus aria-hidden />
              {submitting ? "创建中…" : "创建文件夹"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

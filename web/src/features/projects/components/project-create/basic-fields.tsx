import { Field, FieldDescription, FieldError, FieldLabel, FieldTitle } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BasicProjectValues } from "./form-state";
import type {
  ProjectClassification,
  ProjectNature,
  ProjectPlatform,
  SecurityLevel,
  SoftwareType,
} from "@/features/projects/types";

const natureOptions: ProjectNature[] = ["鉴定测评", "第三方测评", "二方测评"];
const platformOptions: ProjectPlatform[] = ["FPGA", "CPU/非嵌"];
const softwareTypeOptions: SoftwareType[] = ["新研", "改造", "沿用"];
const classificationOptions: ProjectClassification[] = ["公开", "内部", "秘密", "机密", "绝密"];
const securityLevelOptions: SecurityLevel[] = ["A", "B", "C", "D"];
const securityLevelLabels: Record<SecurityLevel, string> = {
  A: "关键A",
  B: "重要B",
  C: "一般C",
  D: "不重要D",
};

export function BasicFields({
  values,
  errors,
  onChange,
  markTouched,
}: {
  values: BasicProjectValues;
  errors: Record<string, string | undefined>;
  onChange: (values: Partial<BasicProjectValues>) => void;
  markTouched: (field: string) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Field className="gap-2" data-invalid={errors.identifier ? true : undefined}>
        <FieldLabel htmlFor="project-identifier">
          项目标识
          <RequiredMark />
        </FieldLabel>
        <div
          data-slot="composite-input"
          data-invalid={errors.identifier ? true : undefined}
          className="input-elevated flex h-8 items-center overflow-hidden rounded-sm border border-input bg-card/80 transition-[border-color,background-color,box-shadow] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] focus-within:border-ring focus-within:bg-card"
        >
          <span className="bg-muted text-muted-foreground flex h-full min-w-9 items-center justify-center border-r border-input px-2 font-mono text-sm">
            R
          </span>
          <Input
            id="project-identifier"
            value={values.identifierSuffix}
            onChange={(event) =>
              onChange({ identifierSuffix: event.target.value.replace(/\D/g, "").slice(0, 5) })
            }
            placeholder="2607"
            inputMode="numeric"
            pattern="\d{4,5}"
            maxLength={5}
            aria-required="true"
            aria-invalid={Boolean(errors.identifier)}
            aria-describedby={errors.identifier ? "project-identifier-error" : undefined}
            onBlur={() => markTouched("identifier")}
            className="h-full rounded-none border-0 bg-transparent px-2 font-mono shadow-none focus-visible:ring-0"
          />
        </div>
        <FieldDescription>输入 4 到 5 位数字，完整标识如 R2607 或 R26070。</FieldDescription>
        {errors.identifier ? (
          <FieldError id="project-identifier-error">{errors.identifier}</FieldError>
        ) : null}
      </Field>

      <TextField
        id="project-name"
        label="项目名称"
        value={values.name}
        placeholder="例：XX03 探测单元鉴定测评"
        error={errors.name}
        onBlur={() => markTouched("name")}
        onChange={(name) => onChange({ name })}
      />

      <RadioField
        label="测评性质"
        value={values.nature}
        options={natureOptions}
        onChange={(nature) => onChange({ nature: nature as ProjectNature })}
      />
      <RadioField
        label="测试平台"
        value={values.platform}
        options={platformOptions}
        onChange={(platform) => onChange({ platform: platform as ProjectPlatform })}
      />
      <RadioField
        label="软件类型"
        value={values.softwareType}
        options={softwareTypeOptions}
        onChange={(softwareType) => onChange({ softwareType: softwareType as SoftwareType })}
      />
      <RadioField
        label="安全等级"
        value={values.securityLevel}
        options={securityLevelOptions}
        labels={securityLevelLabels}
        onChange={(securityLevel) => onChange({ securityLevel: securityLevel as SecurityLevel })}
      />

      <Field className="gap-2">
        <FieldLabel htmlFor="project-classification">
          密级
          <RequiredMark />
        </FieldLabel>
        <Select
          value={values.classification}
          onValueChange={(classification) =>
            onChange({ classification: classification as ProjectClassification })
          }
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
        <FieldDescription>生成 Word 首页时按密级展示。</FieldDescription>
      </Field>
    </div>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  placeholder,
  error,
  onBlur,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  onBlur?: () => void;
}) {
  return (
    <Field className="gap-2" data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={id}>
        {label}
        <RequiredMark />
      </FieldLabel>
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-required="true"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        onBlur={onBlur}
      />
      {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : null}
    </Field>
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
    <Field className="gap-2">
      <FieldTitle>
        {label}
        <RequiredMark />
      </FieldTitle>
      <RadioGroup
        aria-label={`${label}（必选）`}
        aria-required="true"
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
    </Field>
  );
}

export function RequiredMark() {
  return (
    <span aria-hidden="true" className="text-destructive font-semibold">
      *
    </span>
  );
}

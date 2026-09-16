import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldTitle } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MultiSelectCombobox } from "@/components/shared/multi-select-combobox";
import type { DictionaryCategory, DictionaryOption } from "@/features/projects/types";
import { RequiredMark } from "./basic-fields";

const categories: DictionaryCategory[] = [
  "language",
  "runtime_environment",
  "development_environment",
];

const categoryLabels: Record<DictionaryCategory, string> = {
  language: "编程语言",
  runtime_environment: "运行环境",
  development_environment: "开发环境",
};

export interface DictionarySelections {
  language: string[];
  runtime_environment: string[];
  development_environment: string[];
}

export function DictionaryFields({
  options,
  selections,
  errors,
  onChange,
  onCustom,
}: {
  options: DictionaryOption[];
  selections: DictionarySelections;
  errors: Partial<Record<DictionaryCategory, string>>;
  onChange: (category: DictionaryCategory, values: string[]) => void;
  onCustom: (updater: (previous: DictionaryOption[]) => DictionaryOption[]) => void;
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {categories.map((category) => (
        <DictionaryField
          key={category}
          category={category}
          label={categoryLabels[category]}
          options={options.filter((option) => option.category === category)}
          selected={selections[category]}
          error={errors[category]}
          onChange={(values) => onChange(category, values)}
          onCustom={onCustom}
        />
      ))}
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
  error,
}: {
  label: string;
  category: DictionaryCategory;
  options: DictionaryOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  onCustom: (updater: (previous: DictionaryOption[]) => DictionaryOption[]) => void;
  error?: string;
}) {
  const [customValue, setCustomValue] = useState("");

  const addCustom = () => {
    const value = customValue.trim();
    if (!value) return;
    if (options.some((option) => String(option.name ?? "").toLowerCase() === value.toLowerCase())) {
      toast.info("该选项已在字典中");
      setCustomValue("");
      return;
    }

    onCustom((previous) => [
      {
        id: `custom-${category}-${value.toLowerCase()}`,
        category,
        name: value,
        sortOrder: options.length + 1,
        isEnabled: true,
        isPreset: false,
      },
      ...previous,
    ]);
    onChange([...selected, value]);
    setCustomValue("");
  };

  return (
    <Field
      aria-label={`${label}（必选）`}
      aria-required="true"
      aria-invalid={Boolean(error)}
      aria-describedby={error ? `${category}-error` : undefined}
      data-invalid={error ? true : undefined}
      className="gap-2.5"
    >
      <FieldTitle>
        {label}
        <RequiredMark />
        <Badge variant={selected.length > 0 ? "success" : "warning"} className="h-5 text-[11px]">
          {selected.length > 0 ? `已选 ${selected.length}` : "待选择"}
        </Badge>
      </FieldTitle>
      <MultiSelectCombobox
        id={`${category}-select`}
        ariaLabel={`${label}（必选）`}
        options={options.map((option) => ({
          value: option.name,
          label: option.name,
          keywords: [option.isPreset ? "预置" : "自定义"],
        }))}
        value={selected}
        onChange={onChange}
        placeholder={`选择${label}`}
        searchPlaceholder={`搜索${label}`}
        emptyText="没有匹配的字典项"
        invalid={Boolean(error)}
      />
      <FieldError id={`${category}-error`}>{error}</FieldError>
      <div className="flex items-center gap-2">
        <Input
          value={customValue}
          onChange={(event) => setCustomValue(event.target.value)}
          placeholder="自定义选项"
          aria-label={`新增自定义${label}`}
          className="h-8 text-xs"
        />
        <Button type="button" variant="outline" size="sm" onClick={addCustom}>
          <Plus data-icon="inline-start" />
          添加
        </Button>
      </div>
    </Field>
  );
}

import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldTitle } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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
    if (options.some((option) => option.name.toLowerCase() === value.toLowerCase())) {
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
      tabIndex={-1}
      aria-required="true"
      aria-invalid={Boolean(error)}
      aria-describedby={error ? `${category}-error` : undefined}
      data-invalid={error ? true : undefined}
      className="gap-2"
    >
      <FieldTitle>
        {label}
        <RequiredMark />
        <Badge variant={selected.length > 0 ? "success" : "warning"} className="h-5 text-[11px]">
          {selected.length > 0 ? `已选 ${selected.length}` : "待选择"}
        </Badge>
      </FieldTitle>
      <div
        data-invalid-group={Boolean(error)}
        className="grid grid-cols-2 gap-2 rounded-sm border border-transparent p-2"
      >
        {options.map((option) => {
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
      {error ? <FieldError id={`${category}-error`}>{error}</FieldError> : null}
      <div className="flex gap-2">
        <Input
          value={customValue}
          onChange={(event) => setCustomValue(event.target.value)}
          placeholder="自定义选项"
          aria-label={`新增自定义${label}`}
          className="h-7 text-xs"
        />
        <Button type="button" variant="outline" size="sm" onClick={addCustom}>
          <Plus data-icon="inline-start" />
          添加
        </Button>
      </div>
    </Field>
  );
}

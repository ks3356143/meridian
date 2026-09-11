import { Badge } from "@/components/ui/badge";
import { Field, FieldError } from "@/components/ui/field";
import { MultiSelectCombobox } from "@/components/shared/multi-select-combobox";
import type { ReferenceStandard } from "@/features/projects/types";

export function StandardField({
  standards,
  selectedIds,
  error,
  onChange,
}: {
  standards: ReferenceStandard[];
  selectedIds: string[];
  error?: string;
  onChange: (values: string[]) => void;
}) {
  return (
    <Field
      aria-label="依据标准（必选）"
      aria-required="true"
      aria-invalid={Boolean(error)}
      aria-describedby={error ? "reference-standard-error" : undefined}
      data-invalid={error ? true : undefined}
      className="gap-2.5"
    >
      <MultiSelectCombobox
        id="reference-standards"
        ariaLabel="依据标准（必选）"
        options={standards.map((standard) => ({
          value: standard.id,
          label: standard.name,
          description: [standard.code, standard.publishedDate, standard.source]
            .filter(Boolean)
            .join(" · "),
        }))}
        value={selectedIds}
        onChange={onChange}
        placeholder="选择测评依据标准"
        searchPlaceholder="搜索标准、版本或来源"
        emptyText="没有匹配标准"
        invalid={Boolean(error)}
      />
      {error ? <FieldError id="reference-standard-error">{error}</FieldError> : null}
    </Field>
  );
}

export function StandardCountBadge({ count }: { count: number }) {
  return (
    <Badge variant={count > 0 ? "success" : "warning"} className="h-5 text-[11px]">
      {count > 0 ? `已选 ${count}` : "待选择"}
    </Badge>
  );
}

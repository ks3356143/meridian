import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError } from "@/components/ui/field";
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
      tabIndex={-1}
      aria-required="true"
      aria-invalid={Boolean(error)}
      aria-describedby={error ? "reference-standard-error" : undefined}
      data-invalid={error ? true : undefined}
      className="gap-2"
    >
      <div
        data-invalid-group={Boolean(error)}
        className="grid gap-2 rounded-sm border border-transparent p-2 md:grid-cols-2"
      >
        {standards.map((standard) => {
          const checked = selectedIds.includes(standard.id);
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
                  onChange(
                    checked
                      ? selectedIds.filter((id) => id !== standard.id)
                      : [...selectedIds, standard.id],
                  )
                }
                className="mt-0.5"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{standard.name}</span>
                <span className="text-muted-foreground mt-0.5 block text-xs">
                  {[standard.publishedDate, standard.source].filter(Boolean).join(" · ") || "--"}
                </span>
              </span>
            </label>
          );
        })}
      </div>
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

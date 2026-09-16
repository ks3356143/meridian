import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldError } from "@/components/ui/field";
import { MultiSelectCombobox } from "@/components/shared/multi-select-combobox";
import { StandardEditor } from "@/features/projects/components/dictionary-management/standard-editor";
import { projectsApi } from "@/features/projects/api";
import type { ProjectOptions, ReferenceStandard } from "@/features/projects/types";

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
  const queryClient = useQueryClient();
  const standardsQuery = useQuery({
    queryKey: ["projects", "standards"],
    queryFn: projectsApi.listStandards,
  });
  const [quickEntryOpen, setQuickEntryOpen] = useState(false);
  const [editorSession, setEditorSession] = useState(0);
  const nextSortOrder = Math.min(
    9999,
    (standards.length > 0 ? Math.max(...standards.map((standard) => standard.sortOrder)) : 0) + 1,
  );

  const openQuickEntry = () => {
    setEditorSession((session) => session + 1);
    setQuickEntryOpen(true);
  };

  return (
    <Field
      aria-label="依据标准（必选）"
      aria-required="true"
      aria-invalid={Boolean(error)}
      aria-describedby={error ? "reference-standard-error" : undefined}
      data-invalid={error ? true : undefined}
      className="gap-2.5"
    >
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
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
          className="min-w-0"
        />
        <Button
          type="button"
          variant="outline"
          className="h-10 w-full justify-center sm:w-auto"
          onClick={openQuickEntry}
        >
          <Plus data-icon="inline-start" />
          快捷录入
        </Button>
      </div>
      <FieldError id="reference-standard-error">{error}</FieldError>
      <StandardEditor
        key={editorSession}
        open={quickEntryOpen}
        item={null}
        allStandards={standardsQuery.data ?? standards}
        defaultSortOrder={nextSortOrder}
        fixedEnabled
        onCancel={() => setQuickEntryOpen(false)}
        onSaved={async (standard) => {
          setQuickEntryOpen(false);
          queryClient.setQueryData<ProjectOptions>(["projects", "options"], (previous) =>
            previous
              ? {
                  ...previous,
                  standards: [...previous.standards, standard]
                    .filter(
                      (item, index, items) =>
                        items.findIndex((candidate) => candidate.id === item.id) === index,
                    )
                    .sort((left, right) => left.sortOrder - right.sortOrder),
                }
              : previous,
          );
          onChange([...new Set([...selectedIds, standard.id])]);
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["projects", "standards"] }),
            queryClient.invalidateQueries({ queryKey: ["projects", "options"] }),
          ]);
        }}
      />
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

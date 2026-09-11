import { RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  emptyProjectFilters,
  isProjectFilterActive,
  projectPlatformOptions,
  projectStatusOptions,
  securityLevelOptions,
  type ProjectFilterValues,
} from "./project-filter-state";
import type { ProjectPlatform, ProjectStatus, SecurityLevel } from "../types";

const allValue = "__all__";

interface ProjectFiltersProps {
  filters: ProjectFilterValues;
  resultCount: number;
  totalCount: number;
  onChange: (filters: ProjectFilterValues) => void;
}

export function ProjectFilters({
  filters,
  resultCount,
  totalCount,
  onChange,
}: ProjectFiltersProps) {
  const active = isProjectFilterActive(filters);

  return (
    <section
      aria-label="项目筛选"
      className={cn(
        "panel-surface border-border relative flex flex-col gap-3 overflow-hidden rounded-sm border p-3 pl-4 xl:flex-row xl:items-center",
        active ? "border-primary/30" : "hover:border-primary/20",
      )}
    >
      <span className="bg-primary absolute inset-y-0 left-0 w-[4px]" aria-hidden />

      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <span className="border-primary/35 bg-primary/12 text-primary flex size-8 shrink-0 items-center justify-center rounded-sm border">
          <SlidersHorizontal className="size-4" aria-hidden />
        </span>
        <div className="relative min-w-0 flex-1">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
            aria-hidden
          />
          <Input
            value={filters.keyword}
            onChange={(event) => onChange({ ...filters, keyword: event.target.value })}
            placeholder="搜索标识、名称、单位、负责人"
            aria-label="搜索项目"
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:flex xl:w-auto">
        <Select
          value={filters.status || undefined}
          onValueChange={(value) =>
            onChange({
              ...filters,
              status: value === allValue ? "" : (value as ProjectStatus),
            })
          }
        >
          <SelectTrigger aria-label="按状态筛选" className="xl:w-36">
            <SelectValue placeholder="全部状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>状态</SelectLabel>
              <SelectItem value={allValue}>全部状态</SelectItem>
              {projectStatusOptions.map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <Select
          value={filters.level || undefined}
          onValueChange={(value) =>
            onChange({
              ...filters,
              level: value === allValue ? "" : (value as SecurityLevel),
            })
          }
        >
          <SelectTrigger aria-label="按安全等级筛选" className="xl:w-28">
            <SelectValue placeholder="全部等级" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>安全等级</SelectLabel>
              <SelectItem value={allValue}>全部等级</SelectItem>
              {securityLevelOptions.map((level) => (
                <SelectItem key={level} value={level}>
                  {level} 级
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <Select
          value={filters.platform || undefined}
          onValueChange={(value) =>
            onChange({
              ...filters,
              platform: value === allValue ? "" : (value as ProjectPlatform),
            })
          }
        >
          <SelectTrigger aria-label="按平台筛选" className="col-span-2 sm:col-span-1 xl:w-28">
            <SelectValue placeholder="全部平台" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>平台</SelectLabel>
              <SelectItem value={allValue}>全部平台</SelectItem>
              {projectPlatformOptions.map((platform) => (
                <SelectItem key={platform} value={platform}>
                  {platform}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between gap-2 border-border xl:justify-end xl:border-l xl:pl-3">
        <Badge variant={active ? "primary" : "outline"} className="font-mono">
          {resultCount}/{totalCount}
        </Badge>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          disabled={!active}
          onClick={() => onChange(emptyProjectFilters)}
        >
          <RotateCcw data-icon="inline-start" />
          清空
        </Button>
      </div>
    </section>
  );
}

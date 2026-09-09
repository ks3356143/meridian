import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createColumnHelper,
  createCoreRowModel,
  createSortedRowModel,
  flexRender,
  rowSortingFeature,
  sortFn_basic,
  tableFeatures,
  useTable,
  type SortingState,
} from "@tanstack/react-table";
import {
  BookOpen,
  CircleOff,
  CircleCheck,
  LoaderCircle,
  Plus,
  Save,
  SlidersHorizontal,
} from "lucide-react";
import { useMemo, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { projectsApi } from "@/features/projects/api";
import type {
  DictionaryCategory,
  DictionaryOption,
  ReferenceStandard,
} from "@/features/projects/types";
import { gsap, useGSAP } from "@/lib/gsap";

const features = tableFeatures({
  rowSortingFeature,
  coreRowModel: createCoreRowModel(),
  sortedRowModel: createSortedRowModel(),
  sortFns: { basic: sortFn_basic },
});

const dictionaryColumnHelper = createColumnHelper<typeof features, DictionaryOption>();
const standardColumnHelper = createColumnHelper<typeof features, ReferenceStandard>();

const dictionaryCategoryLabels: Record<DictionaryCategory, string> = {
  language: "编程语言",
  runtime_environment: "运行环境",
  development_environment: "开发环境",
};

export function Component() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<"dictionaries" | "standards">("dictionaries");

  useGSAP(
    () => {
      if (!containerRef.current) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      gsap.from(".dictionary-reveal", {
        opacity: 0,
        y: 14,
        duration: 0.4,
        stagger: 0.06,
        ease: "power3.out",
      });
    },
    { scope: containerRef },
  );

  return (
    <div ref={containerRef} className="flex flex-col gap-4">
      <header className="dictionary-reveal flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-sm">
            <SlidersHorizontal className="size-5" aria-hidden />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">字典配置</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              维护项目创建选项与测评大纲依据文件，停用不会影响历史项目。
            </p>
          </div>
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)}>
        <TabsList className="dictionary-reveal grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="dictionaries">技术字典</TabsTrigger>
          <TabsTrigger value="standards">依据标准</TabsTrigger>
        </TabsList>
        <TabsContent value="dictionaries">
          <DictionaryManagementTab />
        </TabsContent>
        <TabsContent value="standards">
          <StandardManagementTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DictionaryManagementTab() {
  const queryClient = useQueryClient();
  const dictionariesQuery = useQuery({
    queryKey: ["projects", "dictionaries"],
    queryFn: projectsApi.listDictionaries,
  });
  const [selected, setSelected] = useState<DictionaryOption | null>(null);
  const [editorMode, setEditorMode] = useState<"idle" | "create" | "edit">("idle");
  const [sorting, setSorting] = useState<SortingState>([
    { id: "category", desc: false },
    { id: "sortOrder", desc: false },
  ]);

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["projects", "dictionaries"] });
    await queryClient.invalidateQueries({ queryKey: ["projects", "options"] });
  };

  const toggleMutation = useMutation({
    mutationFn: (item: DictionaryOption) =>
      projectsApi.updateDictionary(item.id, {
        category: item.category,
        name: item.name,
        sortOrder: item.sortOrder,
        isEnabled: !item.isEnabled,
      }),
    onSuccess: async (item) => {
      await invalidate();
      setSelected(item);
      if (item.isEnabled) toast.success("字典项已启用");
      else toast.warning("字典项已停用");
    },
  });

  const columns = useMemo(
    () =>
      dictionaryColumnHelper.columns([
        dictionaryColumnHelper.accessor("category", {
          header: "字典类型",
          cell: (info) => (
            <Badge variant="outline" className="justify-center">
              {dictionaryCategoryLabels[info.getValue()]}
            </Badge>
          ),
        }),
        dictionaryColumnHelper.accessor("name", {
          header: "展示名",
          cell: (info) => <span className="font-medium">{info.getValue()}</span>,
        }),
        dictionaryColumnHelper.accessor("sortOrder", {
          header: "排序",
          cell: (info) => <span className="font-mono">{info.getValue()}</span>,
        }),
        dictionaryColumnHelper.accessor("isEnabled", {
          header: "状态",
          cell: (info) =>
            info.getValue() ? (
              <Badge variant="success" className="justify-center">
                <CircleCheck aria-hidden />
                启用
              </Badge>
            ) : (
              <Badge variant="outline" className="justify-center">
                <CircleOff aria-hidden />
                停用
              </Badge>
            ),
        }),
        dictionaryColumnHelper.accessor("isPreset", {
          header: "来源",
          cell: (info) => (
            <Badge variant={info.getValue() ? "secondary" : "info"} className="justify-center">
              {info.getValue() ? "预置" : "自定义"}
            </Badge>
          ),
        }),
        dictionaryColumnHelper.display({
          id: "actions",
          header: "操作",
          cell: (info) => {
            const item = info.row.original;
            return (
              <div className="flex justify-center gap-1.5">
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => {
                    setSelected(item);
                    setEditorMode("edit");
                  }}
                >
                  编辑
                </Button>
                <Button
                  variant="ghost"
                  size="xs"
                  disabled={toggleMutation.isPending}
                  onClick={() => toggleMutation.mutate(item)}
                >
                  {item.isEnabled ? "停用" : "启用"}
                </Button>
              </div>
            );
          },
        }),
      ]),
    [toggleMutation],
  );

  const table = useTable({
    features,
    columns,
    data: dictionariesQuery.data ?? [],
    state: { sorting },
    onSortingChange: setSorting,
  });

  if (dictionariesQuery.isPending) return <LoadingCard label="正在加载技术字典" />;
  if (dictionariesQuery.isError) return <ErrorCard onRetry={dictionariesQuery.refetch} />;

  return (
    <div className="dictionary-reveal grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="panel-surface border-border overflow-hidden rounded-sm border">
        <div className="border-border flex items-center justify-between gap-3 border-b px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">技术字典</h2>
            <p className="text-muted-foreground text-xs">
              共 {dictionariesQuery.data.length} 项，启用{" "}
              {dictionariesQuery.data.filter((item) => item.isEnabled).length} 项
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setSelected(null);
              setEditorMode("create");
            }}
          >
            <Plus data-icon="inline-start" />
            新增
          </Button>
        </div>
        <Table className="w-full border-collapse text-left text-[13px]">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                className="bg-muted/60 border-border hover:bg-muted/60"
              >
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="text-muted-foreground border-border h-auto border-r px-3 py-2.5 text-center text-xs last:border-r-0"
                  >
                    {header.column.getCanSort() ? (
                      <Button asChild variant="ghost" size="xs" className="h-auto px-0 text-xs">
                        <button
                          type="button"
                          className="flex w-full items-center justify-center gap-1"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getIsSorted() === "asc" ? " ↑" : null}
                          {header.column.getIsSorted() === "desc" ? " ↓" : null}
                        </button>
                      </Button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                className={`border-border transition-[background-color,box-shadow] hover:bg-primary/5 ${
                  selected?.id === row.original.id ? "bg-primary/8" : ""
                }`}
              >
                {row.getAllCells().map((cell, index) => (
                  <TableCell
                    key={cell.id}
                    className={`border-border border-r px-3 py-2.5 last:border-r-0 ${
                      index === 1 ? "text-left" : "text-center"
                    }`}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      {editorMode === "create" ? (
        <DictionaryEditor
          key="create"
          item={null}
          onCancel={() => setEditorMode("idle")}
          onSaved={async (item) => {
            await invalidate();
            setSelected(item);
            setEditorMode("edit");
          }}
        />
      ) : editorMode === "edit" && selected ? (
        <DictionaryEditor
          key={selected.id}
          item={selected}
          onCancel={() => setEditorMode("idle")}
          onSaved={async (item) => {
            await invalidate();
            setSelected(item);
          }}
        />
      ) : (
        <EditorPlaceholder
          title="选择或新增字典项"
          description="左侧选择一条字典项后可编辑类型、名称、排序和启用状态。"
        />
      )}
    </div>
  );
}

function DictionaryEditor({
  item,
  onSaved,
  onCancel,
}: {
  item: DictionaryOption | null;
  onSaved: (item: DictionaryOption) => Promise<void> | void;
  onCancel: () => void;
}) {
  const [category, setCategory] = useState<DictionaryCategory>(item?.category ?? "language");
  const [name, setName] = useState(item?.name ?? "");
  const [sortOrder, setSortOrder] = useState(String(item?.sortOrder ?? 1));
  const [isEnabled, setIsEnabled] = useState(item?.isEnabled ?? true);
  const mutation = useMutation({
    mutationFn: () =>
      item
        ? projectsApi.updateDictionary(item.id, {
            category,
            name: name.trim(),
            sortOrder: Number(sortOrder) || 0,
            isEnabled,
          })
        : projectsApi.createDictionary({
            category,
            name: name.trim(),
            sortOrder: Number(sortOrder) || 0,
            isEnabled,
          }),
    onSuccess: async (saved) => {
      await onSaved(saved);
      toast.success(item ? "技术字典已保存" : "技术字典已新增");
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) {
      toast.error("请输入字典展示名");
      return;
    }
    mutation.mutate();
  };

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle>{item ? "编辑技术字典" : "新增技术字典"}</CardTitle>
        <CardDescription>停用后不再出现在新建项目选项中。</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="dictionary-category">字典类型</Label>
            <Select
              value={category}
              onValueChange={(value) => setCategory(value as DictionaryCategory)}
            >
              <SelectTrigger id="dictionary-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(dictionaryCategoryLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="dictionary-name">展示名</Label>
            <Input
              id="dictionary-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="例：Rust"
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="dictionary-sort">排序</Label>
            <Input
              id="dictionary-sort"
              type="number"
              min={0}
              max={9999}
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value)}
            />
          </div>
          <label
            htmlFor="dictionary-enabled"
            className="border-border bg-card/60 flex cursor-pointer items-center gap-3 rounded-sm border px-3 py-2"
          >
            <Checkbox
              id="dictionary-enabled"
              checked={isEnabled}
              onCheckedChange={(checked) => setIsEnabled(checked === true)}
            />
            <span className="text-sm">启用</span>
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              取消
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? (
                <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />
              ) : (
                <Save data-icon="inline-start" />
              )}
              保存
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function StandardManagementTab() {
  const queryClient = useQueryClient();
  const standardsQuery = useQuery({
    queryKey: ["projects", "standards"],
    queryFn: projectsApi.listStandards,
  });
  const [selected, setSelected] = useState<ReferenceStandard | null>(null);
  const [editorMode, setEditorMode] = useState<"idle" | "create" | "edit">("idle");
  const [sorting, setSorting] = useState<SortingState>([{ id: "sortOrder", desc: false }]);

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["projects", "standards"] });
    await queryClient.invalidateQueries({ queryKey: ["projects", "options"] });
  };

  const toggleMutation = useMutation({
    mutationFn: (standard: ReferenceStandard) =>
      projectsApi.updateStandard(standard.id, {
        name: standard.name,
        code: standard.code,
        publishedDate: standard.publishedDate,
        source: standard.source,
        sortOrder: standard.sortOrder,
        isEnabled: !standard.isEnabled,
      }),
    onSuccess: async (standard) => {
      await invalidate();
      setSelected(standard);
      if (standard.isEnabled) toast.success("依据标准已启用");
      else toast.warning("依据标准已停用");
    },
  });

  const columns = useMemo(
    () =>
      standardColumnHelper.columns([
        standardColumnHelper.accessor("sortOrder", {
          header: "排序",
          cell: (info) => <span className="font-mono">{info.getValue()}</span>,
        }),
        standardColumnHelper.accessor("name", {
          header: "文档名称",
          cell: (info) => <span className="font-medium">{info.getValue()}</span>,
        }),
        standardColumnHelper.accessor("code", {
          header: "标识/版本",
          cell: (info) => <span className="font-mono text-xs">{info.getValue() || "--"}</span>,
        }),
        standardColumnHelper.accessor("publishedDate", {
          header: "发布日期",
          cell: (info) => <span className="font-mono text-xs">{info.getValue() || "--"}</span>,
        }),
        standardColumnHelper.accessor("source", {
          header: "来源单位",
        }),
        standardColumnHelper.accessor("isEnabled", {
          header: "状态",
          cell: (info) =>
            info.getValue() ? (
              <Badge variant="success" className="justify-center">
                <CircleCheck aria-hidden />
                启用
              </Badge>
            ) : (
              <Badge variant="outline" className="justify-center">
                <CircleOff aria-hidden />
                停用
              </Badge>
            ),
        }),
        standardColumnHelper.display({
          id: "actions",
          header: "操作",
          cell: (info) => {
            const standard = info.row.original;
            return (
              <div className="flex justify-center gap-1.5">
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => {
                    setSelected(standard);
                    setEditorMode("edit");
                  }}
                >
                  编辑
                </Button>
                <Button
                  variant="ghost"
                  size="xs"
                  disabled={toggleMutation.isPending}
                  onClick={() => toggleMutation.mutate(standard)}
                >
                  {standard.isEnabled ? "停用" : "启用"}
                </Button>
              </div>
            );
          },
        }),
      ]),
    [toggleMutation],
  );

  const table = useTable({
    features,
    columns,
    data: standardsQuery.data ?? [],
    state: { sorting },
    onSortingChange: setSorting,
  });

  if (standardsQuery.isPending) return <LoadingCard label="正在加载依据标准" />;
  if (standardsQuery.isError) return <ErrorCard onRetry={standardsQuery.refetch} />;

  return (
    <div className="dictionary-reveal grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <section className="panel-surface border-border overflow-hidden rounded-sm border">
        <div className="border-border flex items-center justify-between gap-3 border-b px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">依据标准</h2>
            <p className="text-muted-foreground text-xs">
              共 {standardsQuery.data.length} 项，启用{" "}
              {standardsQuery.data.filter((item) => item.isEnabled).length} 项
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setSelected(null);
              setEditorMode("create");
            }}
          >
            <Plus data-icon="inline-start" />
            新增
          </Button>
        </div>
        <Table className="w-full border-collapse text-left text-[13px]">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                className="bg-muted/60 border-border hover:bg-muted/60"
              >
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="text-muted-foreground border-border h-auto border-r px-3 py-2.5 text-center text-xs last:border-r-0"
                  >
                    {header.column.getCanSort() ? (
                      <Button asChild variant="ghost" size="xs" className="h-auto px-0 text-xs">
                        <button
                          type="button"
                          className="flex w-full items-center justify-center gap-1"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getIsSorted() === "asc" ? " ↑" : null}
                          {header.column.getIsSorted() === "desc" ? " ↓" : null}
                        </button>
                      </Button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                className={`border-border transition-[background-color,box-shadow] hover:bg-primary/5 ${
                  selected?.id === row.original.id ? "bg-primary/8" : ""
                }`}
              >
                {row.getAllCells().map((cell, index) => (
                  <TableCell
                    key={cell.id}
                    className={`border-border border-r px-3 py-2.5 last:border-r-0 ${
                      index === 1 || index === 4 ? "text-left" : "text-center"
                    }`}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      {editorMode === "create" ? (
        <StandardEditor
          key="create"
          item={null}
          onCancel={() => setEditorMode("idle")}
          onSaved={async (standard) => {
            await invalidate();
            setSelected(standard);
            setEditorMode("edit");
          }}
        />
      ) : editorMode === "edit" && selected ? (
        <StandardEditor
          key={selected.id}
          item={selected}
          onCancel={() => setEditorMode("idle")}
          onSaved={async (standard) => {
            await invalidate();
            setSelected(standard);
          }}
        />
      ) : (
        <EditorPlaceholder
          title="选择或新增依据标准"
          description="依据标准将在测评大纲中按排序渲染。"
        />
      )}
    </div>
  );
}

function StandardEditor({
  item,
  onSaved,
  onCancel,
}: {
  item: ReferenceStandard | null;
  onSaved: (standard: ReferenceStandard) => Promise<void> | void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(item?.name ?? "");
  const [code, setCode] = useState(item?.code ?? "");
  const [publishedDate, setPublishedDate] = useState(item?.publishedDate ?? "");
  const [source, setSource] = useState(item?.source ?? "");
  const [sortOrder, setSortOrder] = useState(String(item?.sortOrder ?? 1));
  const [isEnabled, setIsEnabled] = useState(item?.isEnabled ?? true);
  const mutation = useMutation({
    mutationFn: () =>
      item
        ? projectsApi.updateStandard(item.id, {
            name: name.trim(),
            code: code.trim(),
            publishedDate,
            source: source.trim(),
            sortOrder: Number(sortOrder) || 0,
            isEnabled,
          })
        : projectsApi.createStandard({
            name: name.trim(),
            code: code.trim(),
            publishedDate,
            source: source.trim(),
            sortOrder: Number(sortOrder) || 0,
            isEnabled,
          }),
    onSuccess: async (standard) => {
      await onSaved(standard);
      toast.success(item ? "依据标准已保存" : "依据标准已新增");
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) {
      toast.error("请输入文档名称");
      return;
    }
    mutation.mutate();
  };

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle>{item ? "编辑依据标准" : "新增依据标准"}</CardTitle>
        <CardDescription>文档名称全局唯一，忽略大小写。</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="standard-name">文档名称</Label>
            <Input
              id="standard-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="例：GJB 438C-2021"
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="standard-code">标识/版本</Label>
              <Input
                id="standard-code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="standard-date">发布日期</Label>
              <Input
                id="standard-date"
                type="date"
                value={publishedDate}
                onChange={(event) => setPublishedDate(event.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="standard-source">来源单位</Label>
            <Input
              id="standard-source"
              value={source}
              onChange={(event) => setSource(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="standard-sort">排序</Label>
            <Input
              id="standard-sort"
              type="number"
              min={0}
              max={9999}
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value)}
            />
          </div>
          <label
            htmlFor="standard-enabled"
            className="border-border bg-card/60 flex cursor-pointer items-center gap-3 rounded-sm border px-3 py-2"
          >
            <Checkbox
              id="standard-enabled"
              checked={isEnabled}
              onCheckedChange={(checked) => setIsEnabled(checked === true)}
            />
            <span className="text-sm">启用</span>
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              取消
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? (
                <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />
              ) : (
                <Save data-icon="inline-start" />
              )}
              保存
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function LoadingCard({ label }: { label: string }) {
  return (
    <Card className="dictionary-reveal">
      <CardContent className="text-muted-foreground flex min-h-48 items-center justify-center gap-2 text-sm">
        <LoaderCircle className="size-4 animate-spin" aria-hidden />
        {label}
      </CardContent>
    </Card>
  );
}

function ErrorCard({ onRetry }: { onRetry: () => void }) {
  return (
    <Card className="dictionary-reveal">
      <CardHeader>
        <CardTitle>字典加载失败</CardTitle>
        <CardDescription>请确认后端服务已启动，然后重新加载。</CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={onRetry}>重新加载</Button>
      </CardContent>
    </Card>
  );
}

function EditorPlaceholder({ title, description }: { title: string; description: string }) {
  return (
    <Card className="h-fit">
      <CardContent className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
        <span className="bg-primary/10 text-primary flex size-11 items-center justify-center rounded-sm">
          <BookOpen className="size-5" aria-hidden />
        </span>
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="text-muted-foreground mt-1 text-xs">{description}</p>
        </div>
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <CircleCheck className="size-3.5" aria-hidden />
          可编辑、启停和排序
          <CircleOff className="ml-1 size-3.5" aria-hidden />
          不物理删除
        </p>
      </CardContent>
    </Card>
  );
}

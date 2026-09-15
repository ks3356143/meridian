import {
  createColumnHelper,
  useTable,
  type OnChangeFn,
  type SortingState,
} from "@tanstack/react-table";
import { Pencil, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { DataTable } from "@/components/shared/data-table";
import { TruncatedText } from "@/components/shared/truncated-text";
import { managementTableFeatures } from "@/components/shared/table-features";
import { Button } from "@/components/ui/button";
import type { ManagedUser } from "@/features/users/types";
import { protectedAdminUsername } from "@/features/users/constants";

const features = managementTableFeatures;
const columnHelper = createColumnHelper<typeof features, ManagedUser>();

interface UserManagementTableProps {
  users: ManagedUser[];
  currentUserId?: string;
  sorting: SortingState;
  onSortingChange: OnChangeFn<SortingState>;
  onEdit: (user: ManagedUser) => void;
  onDelete: (user: ManagedUser) => void;
}

export function UserManagementTable({
  users,
  currentUserId,
  sorting,
  onSortingChange,
  onEdit,
  onDelete,
}: UserManagementTableProps) {
  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.accessor("username", {
          header: "用户名",
          cell: (info) => <TruncatedText value={info.getValue()} className="font-mono text-xs" />,
        }),
        columnHelper.accessor("displayName", {
          header: "显示名称",
          cell: (info) => <TruncatedText value={info.getValue()} className="font-medium" />,
        }),
        columnHelper.accessor("createdAt", {
          header: "创建时间",
          cell: (info) =>
            new Date(info.getValue()).toLocaleDateString("zh-CN", { dateStyle: "medium" }),
        }),
        columnHelper.display({
          id: "actions",
          header: "操作",
          cell: ({ row }) => (
            <div className="flex items-center justify-center gap-1">
              <Button variant="outline" size="icon-sm" onClick={() => onEdit(row.original)}>
                <Pencil className="size-3.5" aria-hidden />
                <span className="sr-only">编辑 {row.original.displayName}</span>
              </Button>
              {row.original.username === protectedAdminUsername ? null : (
                <Button
                  variant="outline"
                  size="icon-sm"
                  className="text-destructive hover:border-destructive/40 hover:bg-destructive/8 hover:text-destructive"
                  disabled={row.original.id === currentUserId}
                  onClick={() => onDelete(row.original)}
                >
                  <Trash2 className="size-3.5" aria-hidden />
                  <span className="sr-only">删除 {row.original.displayName}</span>
                </Button>
              )}
            </div>
          ),
        }),
      ]),
    [currentUserId, onDelete, onEdit],
  );

  const table = useTable({
    data: users,
    columns,
    features,
    state: { sorting },
    onSortingChange,
  });

  return <DataTable table={table} emptyContent="暂无用户，点击上方按钮添加。" />;
}

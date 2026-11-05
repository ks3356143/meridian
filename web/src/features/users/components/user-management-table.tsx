import {
  createColumnHelper,
  useTable,
  type OnChangeFn,
  type SortingState,
} from "@tanstack/react-table";
import { Pencil, Trash2 } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { DataTable } from "@/components/shared/data-table";
import { TruncatedText } from "@/components/shared/truncated-text";
import { managementTableFeatures } from "@/components/shared/table-features";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDateMedium } from "@/lib/date";
import type { ManagedUser } from "@/features/users/types";
import { protectedAdminUsername } from "@/features/users/constants";
import styles from "./user-management-table.module.css";

const features = managementTableFeatures;
const columnHelper = createColumnHelper<typeof features, ManagedUser>();

interface UserManagementTableProps {
  users: ManagedUser[];
  currentUserId?: string;
  sorting: SortingState;
  onSortingChange: OnChangeFn<SortingState>;
  onEdit: (user: ManagedUser) => void;
  onDelete: (user: ManagedUser) => void;
  emptyContent?: ReactNode;
}

export function UserManagementTable({
  users,
  currentUserId,
  sorting,
  onSortingChange,
  onEdit,
  onDelete,
  emptyContent,
}: UserManagementTableProps) {
  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.accessor("username", {
          header: "用户名",
          cell: (info) => <TruncatedText value={info.getValue()} className="font-mono text-xs" />,
        }),
        columnHelper.accessor("displayName", {
          header: "显示名",
          cell: (info) => <TruncatedText value={info.getValue()} className="font-medium" />,
        }),
        columnHelper.accessor("createdAt", {
          header: "创建时间",
          meta: { hiddenUntil: "lg" },
          cell: (info) => formatDateMedium(info.getValue()),
        }),
        columnHelper.display({
          id: "actions",
          header: "操作",
          cell: ({ row }) => {
            const isSelf = row.original.id === currentUserId;
            return (
              <div className="flex items-center justify-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon-sm" onClick={() => onEdit(row.original)}>
                      <Pencil className="size-3.5" aria-hidden />
                      <span className="sr-only">编辑 {row.original.displayName}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>编辑用户</TooltipContent>
                </Tooltip>
                {row.original.username === protectedAdminUsername ? null : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex" tabIndex={isSelf ? 0 : undefined}>
                        <Button
                          variant="outline"
                          size="icon-sm"
                          className="text-destructive hover:border-destructive/40 hover:bg-destructive/8 hover:text-destructive"
                          disabled={isSelf}
                          onClick={() => onDelete(row.original)}
                        >
                          <Trash2 className="size-3.5" aria-hidden />
                          <span className="sr-only">
                            {isSelf ? "不能删除当前登录账号" : `删除 ${row.original.displayName}`}
                          </span>
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>{isSelf ? "不能删除当前登录账号" : "删除用户"}</TooltipContent>
                  </Tooltip>
                )}
              </div>
            );
          },
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

  return (
    <div
      className={`${styles.tableShell} panel-surface border-border overflow-hidden rounded-sm border`}
    >
      <DataTable table={table} emptyContent={emptyContent ?? "暂无用户，点击上方按钮添加。"} />
    </div>
  );
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createColumnHelper, useTable, type SortingState } from "@tanstack/react-table";
import { Pencil, Plus, Trash2, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { QueryError, QueryLoading } from "@/components/shared/query-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DataTable } from "@/features/projects/components/data-table";
import { managementTableFeatures } from "@/features/projects/components/dictionary-management/table-features";
import { usersApi } from "@/features/users/api";
import type { ManagedUser } from "@/features/users/types";
import { useAuthStore } from "@/stores/auth-store";

const features = managementTableFeatures;
const columnHelper = createColumnHelper<typeof features, ManagedUser>();

type DialogMode = { kind: "closed" } | { kind: "create" } | { kind: "edit"; user: ManagedUser };

interface FormErrors {
  username?: string;
  displayName?: string;
  password?: string;
}

function RequiredMark() {
  return (
    <>
      <span className="text-destructive" aria-hidden>
        *
      </span>
      <span className="sr-only">（必填）</span>
    </>
  );
}

export function UserManagementPage() {
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((state) => state.user?.id);
  const [dialog, setDialog] = useState<DialogMode>({ kind: "closed" });
  const [deleteTarget, setDeleteTarget] = useState<ManagedUser | null>(null);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [sorting, setSorting] = useState<SortingState>([{ id: "createdAt", desc: false }]);

  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: async () => (await usersApi.list()).users,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["users"] });

  const createMutation = useMutation({
    mutationFn: usersApi.create,
    onSuccess: () => {
      toast.success("用户创建成功");
      void invalidate();
      setDialog({ kind: "closed" });
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: { displayName: string; password: string };
    }) => usersApi.update(id, payload),
    onSuccess: () => {
      toast.success("用户更新成功");
      void invalidate();
      setDialog({ kind: "closed" });
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersApi.remove(id),
    onSuccess: () => {
      toast.success("用户已删除");
      void invalidate();
      setDeleteTarget(null);
    },
  });

  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.accessor("username", {
          header: "用户名",
          cell: (info) => <span className="font-mono text-xs">{info.getValue()}</span>,
        }),
        columnHelper.accessor("displayName", {
          header: "显示名称",
        }),
        columnHelper.accessor("createdAt", {
          header: "创建时间",
          cell: (info) =>
            new Date(info.getValue()).toLocaleDateString("zh-CN", { dateStyle: "medium" }),
        }),
        columnHelper.display({
          id: "actions",
          header: () => null,
          cell: ({ row }) => (
            <div className="flex items-center justify-end gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => {
                  setUsername(row.original.username);
                  setDisplayName(row.original.displayName);
                  setPassword("");
                  setErrors({});
                  setDialog({ kind: "edit", user: row.original });
                }}
              >
                <Pencil className="size-3.5" aria-hidden />
                <span className="sr-only">编辑</span>
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-destructive hover:text-destructive"
                disabled={row.original.id === currentUserId}
                onClick={() => setDeleteTarget(row.original)}
              >
                <Trash2 className="size-3.5" aria-hidden />
                <span className="sr-only">删除</span>
              </Button>
            </div>
          ),
        }),
      ]),
    [currentUserId],
  );

  const table = useTable({
    data: usersQuery.data ?? [],
    columns,
    features,
    state: { sorting },
    onSortingChange: setSorting,
  });

  function resetForm() {
    setUsername("");
    setDisplayName("");
    setPassword("");
    setErrors({});
  }

  function openCreate() {
    resetForm();
    setDialog({ kind: "create" });
  }

  function validate(): FormErrors {
    const next: FormErrors = {};
    const isCreate = dialog.kind === "create";
    if (isCreate && !username.trim()) {
      next.username = "请输入用户名";
    }
    if (!displayName.trim()) {
      next.displayName = "请输入显示名称";
    }
    if (isCreate && !password) {
      next.password = "请输入密码";
    } else if (password && password.length < 8) {
      next.password = "密码至少需要 8 位";
    }
    return next;
  }

  function handleSubmit() {
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    const trimmedUsername = username.trim();
    const trimmedDisplayName = displayName.trim();
    if (dialog.kind === "create") {
      createMutation.mutate({
        username: trimmedUsername,
        displayName: trimmedDisplayName,
        password,
      });
    } else if (dialog.kind === "edit") {
      updateMutation.mutate({
        id: dialog.user.id,
        payload: { displayName: trimmedDisplayName, password },
      });
    }
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  const isCreate = dialog.kind === "create";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Users}
        title="用户管理"
        description="管理团队成员账号，用于项目创建时选择负责人和成员。"
        badge={
          usersQuery.data ? <Badge variant="outline">{usersQuery.data.length}</Badge> : undefined
        }
        actions={
          <Button onClick={openCreate}>
            <Plus data-icon="inline-start" aria-hidden />
            添加用户
          </Button>
        }
      />

      {usersQuery.isPending ? <QueryLoading label="正在加载用户列表" /> : null}
      {usersQuery.isError ? (
        <QueryError title="加载用户列表失败" onRetry={() => usersQuery.refetch()} />
      ) : null}
      {usersQuery.isSuccess ? (
        <DataTable table={table} emptyContent="暂无用户，点击上方按钮添加。" />
      ) : null}

      <Dialog
        open={dialog.kind !== "closed"}
        onOpenChange={(open: boolean) => {
          if (!open) setDialog({ kind: "closed" });
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{isCreate ? "添加用户" : "编辑用户"}</DialogTitle>
            <DialogDescription>
              {isCreate ? "填写用户名、显示名称和密码。" : "修改显示名称，或输入新密码重置。"}
            </DialogDescription>
          </DialogHeader>
          <form
            className="flex flex-col gap-4 py-2"
            onSubmit={(event) => {
              event.preventDefault();
              handleSubmit();
            }}
            noValidate
          >
            <Field data-invalid={errors.username ? true : undefined}>
              <FieldLabel htmlFor="user-username">
                用户名
                {isCreate ? <RequiredMark /> : null}
              </FieldLabel>
              <Input
                id="user-username"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (errors.username) setErrors((prev) => ({ ...prev, username: undefined }));
                }}
                disabled={!isCreate}
                aria-invalid={Boolean(errors.username)}
                placeholder="如 zhangsan"
                autoComplete="off"
              />
              {errors.username ? <FieldError>{errors.username}</FieldError> : null}
            </Field>

            <Field data-invalid={errors.displayName ? true : undefined}>
              <FieldLabel htmlFor="user-display-name">
                显示名称
                <RequiredMark />
              </FieldLabel>
              <Input
                id="user-display-name"
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                  if (errors.displayName)
                    setErrors((prev) => ({ ...prev, displayName: undefined }));
                }}
                aria-invalid={Boolean(errors.displayName)}
                placeholder="如 张三"
              />
              {errors.displayName ? <FieldError>{errors.displayName}</FieldError> : null}
            </Field>

            <Field data-invalid={errors.password ? true : undefined}>
              <FieldLabel htmlFor="user-password">
                {isCreate ? "密码" : "新密码（留空不修改）"}
                {isCreate ? <RequiredMark /> : null}
              </FieldLabel>
              <Input
                id="user-password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
                }}
                aria-invalid={Boolean(errors.password)}
                placeholder={isCreate ? "至少 8 位" : "留空则不修改密码"}
                autoComplete="new-password"
              />
              {errors.password ? <FieldError>{errors.password}</FieldError> : null}
            </Field>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialog({ kind: "closed" })}>
                取消
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isCreate ? "创建" : "保存"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open: boolean) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除用户？</AlertDialogTitle>
            <AlertDialogDescription>
              将删除 <strong>{deleteTarget?.displayName}</strong>（{deleteTarget?.username}
              ），此操作不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function Component() {
  return <UserManagementPage />;
}

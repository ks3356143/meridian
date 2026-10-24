import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SortingState } from "@tanstack/react-table";
import { Plus, Search, Users } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { QueryError, QueryLoading } from "@/components/shared/query-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSubtleReveal } from "@/hooks/use-subtle-reveal";
import { usersApi } from "@/features/users/api";
import { DeleteUserDialog } from "@/features/users/components/delete-user-dialog";
import { UserFormDialog } from "@/features/users/components/user-form-dialog";
import { UserManagementTable } from "@/features/users/components/user-management-table";
import { userPasswordMinLength } from "@/features/users/constants";
import type {
  ManagedUser,
  UserDialogMode,
  UserFormErrors,
  UserFormValues,
} from "@/features/users/types";
import { useAuthStore } from "@/stores/auth-store";

const emptyFormValues: UserFormValues = {
  username: "",
  displayName: "",
  password: "",
};

export function UserManagementPage() {
  const queryClient = useQueryClient();
  const containerRef = useRef<HTMLDivElement>(null);
  const currentUserId = useAuthStore((state) => state.user?.id);
  const [dialog, setDialog] = useState<UserDialogMode>({ kind: "closed" });
  const [deleteTarget, setDeleteTarget] = useState<ManagedUser | null>(null);
  const [formValues, setFormValues] = useState<UserFormValues>(emptyFormValues);
  const [formErrors, setFormErrors] = useState<UserFormErrors>({});
  const [sorting, setSorting] = useState<SortingState>([{ id: "createdAt", desc: false }]);
  const [keyword, setKeyword] = useState("");

  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: async () => (await usersApi.list()).users,
  });
  const filteredUsers = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    if (!query) return usersQuery.data ?? [];
    return (usersQuery.data ?? []).filter((user) =>
      [user.username, user.displayName].some((value) => value.toLowerCase().includes(query)),
    );
  }, [keyword, usersQuery.data]);

  useSubtleReveal(containerRef, ".user-management-reveal", !usersQuery.isPending);

  const invalidateUsers = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["users"] }),
    [queryClient],
  );
  const closeDialog = useCallback(() => setDialog({ kind: "closed" }), []);
  const openCreate = useCallback(() => {
    setFormValues(emptyFormValues);
    setFormErrors({});
    setDialog({ kind: "create" });
  }, []);
  const openEdit = useCallback((user: ManagedUser) => {
    setFormValues({
      username: user.username,
      displayName: user.displayName,
      password: "",
    });
    setFormErrors({});
    setDialog({ kind: "edit", user });
  }, []);
  const handleFieldChange = useCallback((field: keyof UserFormValues, value: string) => {
    setFormValues((previous) => ({ ...previous, [field]: value }));
    setFormErrors((previous) => ({ ...previous, [field]: undefined }));
  }, []);

  const createMutation = useMutation({
    mutationFn: usersApi.create,
    onSuccess: () => {
      toast.success("用户创建成功");
      void invalidateUsers();
      closeDialog();
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
      void invalidateUsers();
      closeDialog();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: usersApi.remove,
    onSuccess: () => {
      toast.success("用户已删除");
      void invalidateUsers();
      setDeleteTarget(null);
    },
  });

  const handleSubmit = useCallback(() => {
    const errors: UserFormErrors = {};
    const isCreate = dialog.kind === "create";
    if (isCreate && !formValues.username.trim()) errors.username = "请输入用户名";
    if (!formValues.displayName.trim()) errors.displayName = "请输入显示名称";
    if (isCreate && !formValues.password) {
      errors.password = "请输入密码";
    } else if (formValues.password && formValues.password.length < userPasswordMinLength) {
      errors.password = `密码至少需要 ${userPasswordMinLength} 位`;
    }

    setFormErrors(errors);
    if (Object.values(errors).some(Boolean)) return;

    if (dialog.kind === "create") {
      createMutation.mutate({
        username: formValues.username.trim(),
        displayName: formValues.displayName.trim(),
        password: formValues.password,
      });
    } else if (dialog.kind === "edit") {
      updateMutation.mutate({
        id: dialog.user.id,
        payload: {
          displayName: formValues.displayName.trim(),
          password: formValues.password,
        },
      });
    }
  }, [createMutation, dialog, formValues, updateMutation]);

  return (
    <div ref={containerRef} className="flex flex-col gap-6">
      <PageHeader
        className="user-management-reveal"
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
      <div className="user-management-reveal">
        {usersQuery.isError ? (
          <QueryError title="加载用户列表失败" onRetry={() => usersQuery.refetch()} />
        ) : null}
        {usersQuery.isSuccess ? (
          <div className="flex flex-col gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-2" role="search">
              <div className="relative min-w-48 flex-1 sm:max-w-sm">
                <Search
                  className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
                  aria-hidden
                />
                <Input
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  aria-label="搜索用户"
                  placeholder="搜索用户名或显示名"
                  className="pl-8"
                />
              </div>
              {keyword ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => setKeyword("")}>
                  清空搜索
                </Button>
              ) : null}
              <span className="text-muted-foreground font-mono text-xs" aria-live="polite">
                {filteredUsers.length}/{usersQuery.data.length}
              </span>
            </div>
            <UserManagementTable
              users={filteredUsers}
              currentUserId={currentUserId}
              sorting={sorting}
              onSortingChange={setSorting}
              onEdit={openEdit}
              onDelete={setDeleteTarget}
              emptyContent={
                keyword ? (
                  <div className="flex flex-col items-center gap-2">
                    <Search className="text-muted-foreground size-5" aria-hidden />
                    <p className="text-muted-foreground text-sm">没有匹配的用户</p>
                    <p className="text-muted-foreground text-xs">清空搜索后可查看全部用户</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setKeyword("")}
                    >
                      清空搜索
                    </Button>
                  </div>
                ) : undefined
              }
            />
          </div>
        ) : null}
      </div>

      <UserFormDialog
        dialog={dialog}
        values={formValues}
        errors={formErrors}
        submitting={createMutation.isPending || updateMutation.isPending}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
        onFieldChange={handleFieldChange}
        onSubmit={handleSubmit}
      />
      <DeleteUserDialog
        user={deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        onConfirm={(user) => deleteMutation.mutate(user.id)}
      />
    </div>
  );
}

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
import { Button } from "@/components/ui/button";
import { protectedAdminUsername } from "@/features/users/constants";
import type { UserDialogMode, UserFormErrors, UserFormValues } from "@/features/users/types";

interface UserFormDialogProps {
  dialog: UserDialogMode;
  values: UserFormValues;
  errors: UserFormErrors;
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onFieldChange: (field: keyof UserFormValues, value: string) => void;
  onSubmit: () => void;
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

export function UserFormDialog({
  dialog,
  values,
  errors,
  submitting,
  onOpenChange,
  onFieldChange,
  onSubmit,
}: UserFormDialogProps) {
  const isCreate = dialog.kind === "create";
  const editingProtectedAdmin =
    dialog.kind === "edit" && dialog.user.username === protectedAdminUsername;

  return (
    <Dialog open={dialog.kind !== "closed"} onOpenChange={onOpenChange}>
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
            onSubmit();
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
              value={values.username}
              onChange={(event) => onFieldChange("username", event.target.value)}
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
              value={values.displayName}
              onChange={(event) => onFieldChange("displayName", event.target.value)}
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
              value={values.password}
              onChange={(event) => onFieldChange("password", event.target.value)}
              aria-invalid={Boolean(errors.password)}
              placeholder={
                isCreate
                  ? "至少 8 位"
                  : editingProtectedAdmin
                    ? "系统管理员密码固定"
                    : "留空则不修改"
              }
              autoComplete="new-password"
              disabled={editingProtectedAdmin}
            />
            {errors.password ? <FieldError>{errors.password}</FieldError> : null}
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={submitting}>
              {isCreate ? "创建" : "保存"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

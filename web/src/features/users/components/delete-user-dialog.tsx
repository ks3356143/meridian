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
import type { ManagedUser } from "@/features/users/types";

interface DeleteUserDialogProps {
  user: ManagedUser | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (user: ManagedUser) => void;
}

export function DeleteUserDialog({ user, onOpenChange, onConfirm }: DeleteUserDialogProps) {
  return (
    <AlertDialog open={user !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>确认删除用户？</AlertDialogTitle>
          <AlertDialogDescription>
            将删除 <strong>{user?.displayName}</strong>（{user?.username}），此操作不可恢复。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => user && onConfirm(user)}
          >
            删除
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

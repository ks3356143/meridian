import { Field, FieldDescription, FieldError, FieldLabel, FieldTitle } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MultiSelectCombobox } from "@/components/shared/multi-select-combobox";
import { Badge } from "@/components/ui/badge";
import type { UserOption } from "@/features/projects/types";
import { RequiredMark } from "./basic-fields";

export function MemberFields({
  users,
  selectedOwnerId,
  memberIds,
  ownerError,
  onOwnerChange,
  onMembersChange,
}: {
  users: UserOption[];
  selectedOwnerId: string;
  memberIds: string[];
  ownerError?: string;
  onOwnerChange: (userId: string) => void;
  onMembersChange: (values: string[]) => void;
}) {
  const memberOptions = users.filter((user) => user.id !== selectedOwnerId);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(260px,340px)_1fr]">
      <Field className="gap-2.5" data-invalid={ownerError ? true : undefined}>
        <FieldLabel htmlFor="project-owner">
          项目负责人
          <RequiredMark />
        </FieldLabel>
        <Select value={selectedOwnerId} onValueChange={onOwnerChange}>
          <SelectTrigger
            id="project-owner"
            className="text-sm"
            aria-required="true"
            aria-invalid={Boolean(ownerError)}
          >
            <SelectValue placeholder="选择负责人" />
          </SelectTrigger>
          <SelectContent>
            {users.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.displayName}（{user.username}）
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldDescription>负责人保存后自动加入项目成员。</FieldDescription>
        <FieldError>{ownerError}</FieldError>
      </Field>

      <Field className="gap-2.5">
        <FieldTitle>
          项目成员
          <Badge
            variant={memberIds.length > 0 ? "primary" : "secondary"}
            className="h-5 text-[11px]"
          >
            {memberIds.length > 0 ? `已选 ${memberIds.length}` : "可选"}
          </Badge>
        </FieldTitle>
        <MultiSelectCombobox
          id="project-members"
          ariaLabel="项目成员（可多选）"
          options={memberOptions.map((user) => ({
            value: user.id,
            label: user.displayName,
            description: user.username,
            keywords: [user.username],
          }))}
          value={memberIds}
          onChange={onMembersChange}
          placeholder="按显示名或用户名搜索成员"
          searchPlaceholder="搜索成员"
          emptyText="没有匹配成员"
        />
        <FieldDescription>
          支持显示名和用户名搜索，负责人不会重复出现在成员选项中。
        </FieldDescription>
      </Field>
    </div>
  );
}

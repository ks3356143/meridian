import { useMemo, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  const [keyword, setKeyword] = useState("");
  const filteredUsers = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    if (!query) return users;
    return users.filter((user) =>
      [user.displayName, user.username].some((field) => field.toLowerCase().includes(query)),
    );
  }, [keyword, users]);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(240px,320px)_1fr]">
      <Field className="gap-2">
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
      </Field>

      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm leading-none font-semibold">项目成员</span>
          <Input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索成员"
            aria-label="搜索项目成员"
            className="h-7 sm:w-48"
          />
        </div>
        <div className="grid max-h-56 gap-2 overflow-y-auto pr-1 md:grid-cols-2">
          {filteredUsers
            .filter((user) => user.id !== selectedOwnerId)
            .map((user) => {
              const checked = memberIds.includes(user.id);
              return (
                <label
                  key={user.id}
                  htmlFor={user.id}
                  className="border-border bg-card/60 has-data-[state=checked]:border-primary/35 has-data-[state=checked]:bg-primary/6 flex cursor-pointer items-center gap-3 rounded-sm border px-3 py-2 transition-[background-color,border-color] duration-200"
                >
                  <Checkbox
                    id={user.id}
                    checked={checked}
                    onCheckedChange={() =>
                      onMembersChange(
                        checked
                          ? memberIds.filter((id) => id !== user.id)
                          : [...memberIds, user.id],
                      )
                    }
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{user.displayName}</span>
                    <span className="text-muted-foreground block font-mono text-xs">
                      {user.username}
                    </span>
                  </span>
                </label>
              );
            })}
        </div>
      </div>
    </div>
  );
}

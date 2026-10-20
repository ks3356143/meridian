import { useMemo, useState } from "react";
import { Check, ChevronDown, UserRound } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { ProjectMember } from "../../../types";
import styles from "./person-picker.module.css";

/** 人员指派选择器（切片 5c）：测试人员 / 监测人员 / 设计人员三处共用。 */
export function PersonPicker({
  id,
  label,
  members,
  onAssign,
}: {
  id: string | null;
  label: string;
  members: ProjectMember[];
  /** 传成员 id 指派；传空字符串清除指派（服务端空值落 NULL）。 */
  onAssign: (memberId: string) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const person = useMemo(
    () => (id ? members.find((member) => member.id === id) : undefined),
    [id, members],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={styles.trigger}
          data-empty={person ? undefined : "true"}
          aria-haspopup="dialog"
          aria-label={`${label}：${person ? person.displayName || person.username : "未指派"}，点击选择`}
        >
          <UserRound className={styles.avatar} aria-hidden />
          <span>{person ? person.displayName || person.username : "未指派"}</span>
          <ChevronDown className={styles.chevron} aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className={styles.popover}>
        <Command>
          <CommandInput placeholder="搜索成员" />
          <CommandList>
            <CommandEmpty>没有匹配成员</CommandEmpty>
            <CommandGroup>
              {members.map((member) => (
                <CommandItem
                  key={member.id}
                  value={`${member.displayName} ${member.username}`}
                  data-active={member.id === id ? "true" : undefined}
                  onSelect={() => {
                    void onAssign(member.id);
                    setOpen(false);
                  }}
                >
                  {member.id === id ? <Check className={styles.check} aria-hidden /> : null}
                  <span className={styles.optionName}>{member.displayName || member.username}</span>
                  <span className={styles.meta}>{member.username}</span>
                </CommandItem>
              ))}
              {person ? (
                <CommandItem
                  value="清除指派"
                  onSelect={() => {
                    void onAssign("");
                    setOpen(false);
                  }}
                >
                  清除指派
                </CommandItem>
              ) : null}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

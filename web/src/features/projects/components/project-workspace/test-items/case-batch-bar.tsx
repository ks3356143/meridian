import { useState } from "react";
import { CalendarDays, Check, Loader2, Sparkles, UsersRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { YearMonthCalendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BatchAssignCasesPayload } from "@/features/test-items/api";
import type { ProjectMember } from "../../../types";
import styles from "./case-batch-bar.module.css";

const KEEP = "__keep__";
const CLEAR = "__clear__";

function formatDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** 用例概况批量指派条：只提交用户实际选择的字段。 */
export function CaseBatchBar({
  selectedCount,
  members,
  pending,
  onApply,
  onClearSelection,
}: {
  selectedCount: number;
  members: ProjectMember[];
  pending: boolean;
  onApply: (payload: Omit<BatchAssignCasesPayload, "caseIds">) => Promise<unknown>;
  onClearSelection: () => void;
}) {
  const [testerChoice, setTesterChoice] = useState(KEEP);
  const [statusChoice, setStatusChoice] = useState(KEEP);
  const [dateChoice, setDateChoice] = useState(KEEP);
  const [execDate, setExecDate] = useState<Date | undefined>();
  const [calendarOpen, setCalendarOpen] = useState(false);

  const resetDraft = () => {
    setTesterChoice(KEEP);
    setStatusChoice(KEEP);
    setDateChoice(KEEP);
    setExecDate(undefined);
    setCalendarOpen(false);
  };

  const hasChange = testerChoice !== KEEP || statusChoice !== KEEP || dateChoice !== KEEP;
  const dateLabel = dateChoice === "set" && execDate ? formatDate(execDate) : "选择日期";

  const apply = async () => {
    const payload: Omit<BatchAssignCasesPayload, "caseIds"> = {};
    if (testerChoice !== KEEP) payload.testerId = testerChoice === CLEAR ? "" : testerChoice;
    if (statusChoice !== KEEP) {
      payload.status = statusChoice as "pending" | "passed" | "failed";
    }
    if (dateChoice !== KEEP) {
      payload.execDate = dateChoice === CLEAR ? "" : execDate ? formatDate(execDate) : "";
    }
    await onApply(payload);
    resetDraft();
  };

  return (
    <div
      className={styles.collapse}
      data-visible={selectedCount > 0 ? "true" : undefined}
      aria-hidden={selectedCount === 0 || undefined}
      inert={selectedCount === 0}
    >
      <div className={styles.bar}>
        <div className={styles.lead}>
          <span className={styles.spark} aria-hidden>
            <Sparkles className={styles.icon} />
          </span>
          <span className={styles.count}>已选 {selectedCount} 条</span>
        </div>
        <div className={styles.controls}>
          <Select value={testerChoice} onValueChange={setTesterChoice}>
            <SelectTrigger size="sm" className={styles.trigger} aria-label="批量测试人员">
              <UsersRound className={styles.icon} aria-hidden />
              <SelectValue>
                {testerChoice === KEEP
                  ? "测试人员：不修改"
                  : testerChoice === CLEAR
                    ? "清除测试人员"
                    : (members.find((member) => member.id === testerChoice)?.displayName ??
                      members.find((member) => member.id === testerChoice)?.username ??
                      "测试人员")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={KEEP}>不修改测试人员</SelectItem>
              {members.map((member) => (
                <SelectItem key={member.id} value={member.id}>
                  {member.displayName || member.username}
                </SelectItem>
              ))}
              <SelectItem value={CLEAR}>清除指派</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusChoice} onValueChange={setStatusChoice}>
            <SelectTrigger size="sm" className={styles.trigger} aria-label="批量执行状态">
              <Check className={styles.icon} aria-hidden />
              <SelectValue>
                {statusChoice === KEEP
                  ? "状态：不修改"
                  : statusChoice === "pending"
                    ? "状态：未执行"
                    : statusChoice === "passed"
                      ? "状态：通过"
                      : "状态：未通过"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={KEEP}>不修改状态</SelectItem>
              <SelectItem value="pending">未执行</SelectItem>
              <SelectItem value="passed">通过</SelectItem>
              <SelectItem value="failed">未通过</SelectItem>
            </SelectContent>
          </Select>

          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button type="button" size="xs" variant="outline" className={styles.dateTrigger}>
                <CalendarDays className={styles.icon} aria-hidden />
                {dateChoice === KEEP
                  ? "日期：不修改"
                  : dateChoice === CLEAR
                    ? "清除执行日期"
                    : dateLabel}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className={styles.calendarPopover}>
              <YearMonthCalendar
                selected={execDate}
                onSelect={(date) => {
                  setExecDate(date);
                  if (date) {
                    setDateChoice("set");
                    setCalendarOpen(false);
                  }
                }}
              />
              <div className={styles.calendarActions}>
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  onClick={() => {
                    setDateChoice(CLEAR);
                    setExecDate(undefined);
                    setCalendarOpen(false);
                  }}
                >
                  清除执行日期
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          <Button
            type="button"
            size="xs"
            disabled={!hasChange || pending}
            onClick={() => void apply()}
          >
            {pending ? <Loader2 className={styles.spin} aria-hidden /> : null}
            应用到所选
          </Button>
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            aria-label="取消选择"
            onClick={onClearSelection}
          >
            <X aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  );
}

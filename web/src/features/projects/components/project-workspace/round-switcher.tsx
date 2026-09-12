import { History } from "lucide-react";
import { useNavigate, useParams } from "react-router";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function RoundSwitcher({
  projectCode,
  compact = false,
}: {
  projectCode: string;
  compact?: boolean;
}) {
  const navigate = useNavigate();
  const { roundId } = useParams();

  if (compact) {
    return (
      <Select
        value={roundId ?? "round-1"}
        onValueChange={(value) => {
          navigate(`/projects/${projectCode}/workspace/rounds/${value}`);
        }}
      >
        <SelectTrigger size="sm" className="w-[164px]" aria-label="全局轮次切换">
          <History data-icon="inline-start" className="size-3.5" aria-hidden />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="round-1">第 1 轮 · 待建模</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    );
  }

  return (
    <div className="min-w-0">
      <p id="workspace-round-label" className="text-muted-foreground text-[11px] font-semibold">
        全局轮次
      </p>
      <Select
        value={roundId ?? "round-1"}
        onValueChange={(value) => {
          navigate(`/projects/${projectCode}/workspace/rounds/${value}`);
        }}
      >
        <SelectTrigger size="sm" className="mt-1 w-full" aria-labelledby="workspace-round-label">
          <History data-icon="inline-start" className="size-3.5" aria-hidden />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="round-1">第 1 轮 · 待建模</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}

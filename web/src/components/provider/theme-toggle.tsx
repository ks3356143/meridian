import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const label = isDark ? "切换到浅色主题" : "切换到深色主题";
  const ThemeIcon = isDark ? Sun : Moon;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          onClick={() => setTheme(isDark ? "light" : "dark")}
          aria-label={label}
        >
          <ThemeIcon
            key={isDark ? "sun" : "moon"}
            className="animate-in fade-in-0 zoom-in-75 duration-150 motion-reduce:animate-none"
          />
        </Button>
      </TooltipTrigger>
      <TooltipContent sideOffset={8}>{label}</TooltipContent>
    </Tooltip>
  );
}

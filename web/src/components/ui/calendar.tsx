"use client";

import * as React from "react";
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { DayPicker, getDefaultClassNames } from "react-day-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "cn";
import { Button, buttonVariants } from "@/components/ui/button";

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "label",
  buttonVariant = "ghost",
  formatters,
  components,
  ...props
}: React.ComponentProps<typeof DayPicker> & {
  buttonVariant?: React.ComponentProps<typeof Button>["variant"];
}) {
  const defaultClassNames = getDefaultClassNames();

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("bg-card group/calendar p-2", className)}
      captionLayout={captionLayout}
      classNames={{
        root: cn("w-fit", defaultClassNames.root),
        months: "relative flex flex-col gap-3 md:flex-row",
        month: "flex w-full flex-col gap-3",
        nav: "absolute inset-x-0 top-0 z-10 flex w-full items-center justify-between gap-1 px-0.5",
        button_previous: cn(
          buttonVariants({ variant: buttonVariant, size: "icon-sm" }),
          "size-7 aria-disabled:pointer-events-none aria-disabled:opacity-50",
        ),
        button_next: cn(
          buttonVariants({ variant: buttonVariant, size: "icon-sm" }),
          "size-7 aria-disabled:pointer-events-none aria-disabled:opacity-50",
        ),
        month_caption: "relative flex h-7 items-center justify-center text-sm font-medium",
        caption_label: "flex items-center gap-1 text-sm select-none font-medium",
        month_grid: "w-full table-fixed border-collapse",
        weekdays: "flex",
        weekday:
          "text-muted-foreground rounded-sm text-center text-[0.8rem] font-normal select-none",
        week: "mt-1.5 flex w-full",
        day: "relative h-7 text-center text-sm select-none",
        day_button: cn(
          buttonVariants({ variant: buttonVariant }),
          "size-7 rounded-sm p-0 font-normal aria-selected:opacity-100",
        ),
        range_end: "rounded-r-sm",
        range_start: "rounded-l-sm",
        selected: cn(
          "bg-primary text-primary-foreground [&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary/90 [&>button]:hover:text-primary-foreground",
        ),
        today: "[&>button]:text-primary [&>button]:font-medium",
        outside: "day-outside text-muted-foreground aria-selected:text-muted-foreground opacity-60",
        disabled: "text-muted-foreground opacity-50",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ className, orientation, ...props }) => {
          if (orientation === "left") {
            return <ChevronLeftIcon className={cn("size-4", className)} {...props} />;
          }
          if (orientation === "right") {
            return <ChevronRightIcon className={cn("size-4", className)} {...props} />;
          }
          return <ChevronDownIcon className={cn("size-4", className)} {...props} />;
        },
        ...components,
      }}
      formatters={{
        formatWeekdayName: (date) => date.toLocaleDateString("zh-CN", { weekday: "short" }),
        ...formatters,
      }}
      {...props}
    />
  );
}

function YearMonthCalendar({
  selected,
  onSelect,
  fromYear = 1990,
  toYear,
  className,
}: {
  selected?: Date;
  onSelect?: (date: Date | undefined) => void;
  fromYear?: number;
  toYear?: number;
  className?: string;
}) {
  const [displayMonth, setDisplayMonth] = React.useState<Date>(selected ?? new Date());
  const lastYear = toYear ?? new Date().getFullYear() + 1;
  const years = React.useMemo(() => {
    const list: number[] = [];
    for (let year = lastYear; year >= fromYear; year -= 1) {
      list.push(year);
    }
    return list;
  }, [fromYear, lastYear]);
  const months = React.useMemo(
    () => Array.from({ length: 12 }, (_, index) => new Date(2024, index, 1)),
    [],
  );
  const move = (delta: number) =>
    setDisplayMonth(new Date(displayMonth.getFullYear(), displayMonth.getMonth() + delta, 1));

  return (
    <div className={cn("flex w-72 flex-col", className)}>
      <div className="flex items-center justify-between pb-1">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="上一月"
          onClick={() => move(-1)}
        >
          <ChevronLeftIcon aria-hidden />
        </Button>
        <div className="flex items-center gap-1.5">
          <Select
            value={String(displayMonth.getMonth())}
            onValueChange={(value) =>
              setDisplayMonth(new Date(displayMonth.getFullYear(), Number(value), 1))
            }
          >
            <SelectTrigger size="sm" className="w-24" aria-label="选择月份">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map((monthDate) => (
                <SelectItem key={monthDate.getMonth()} value={String(monthDate.getMonth())}>
                  {monthDate.toLocaleDateString("zh-CN", { month: "long" })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={String(displayMonth.getFullYear())}
            onValueChange={(value) =>
              setDisplayMonth(new Date(Number(value), displayMonth.getMonth(), 1))
            }
          >
            <SelectTrigger size="sm" className="w-20" aria-label="选择年份">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={String(year)}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="下一月"
          onClick={() => move(1)}
        >
          <ChevronRightIcon aria-hidden />
        </Button>
      </div>
      <Calendar
        mode="single"
        hideNavigation
        month={displayMonth}
        onMonthChange={setDisplayMonth}
        selected={selected}
        onSelect={onSelect}
        classNames={{ month_caption: "hidden" }}
      />
    </div>
  );
}
export { Calendar, YearMonthCalendar };

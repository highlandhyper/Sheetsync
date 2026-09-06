"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn(
        "w-fit rounded-2xl bg-background p-3 sm:p-4",
        className,
      )}
      classNames={{
        months:
          "flex flex-col gap-5 sm:flex-row sm:gap-6",

        month:
          "space-y-4",

        month_caption:
          "relative flex h-11 items-center justify-center",

        caption_label:
          "flex h-8 items-center text-sm font-semibold tracking-tight text-foreground",

        nav:
          "flex items-center",

        button_previous: cn(
          buttonVariants({ variant: "ghost", size: "icon" }),
          "absolute left-0 top-1/2 z-10 h-9 w-9 -translate-y-1/2 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground",
        ),

        button_next: cn(
          buttonVariants({ variant: "ghost", size: "icon" }),
          "absolute right-0 top-1/2 z-10 h-9 w-9 -translate-y-1/2 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground",
        ),

        month_grid:
          "w-full border-collapse",

        weekdays:
          "flex",

        weekday:
          "flex h-8 w-10 items-center justify-center text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70 sm:w-9",

        week:
          "mt-1.5 flex w-full",

        day:
          cn(
            "relative h-10 w-10 p-0 text-center text-sm sm:h-9 sm:w-9",
            "[&:has([aria-selected])]:bg-primary/10",
            "[&:has([aria-selected].day-range-start)]:rounded-l-xl",
            "[&:has([aria-selected].day-range-end)]:rounded-r-xl",
            "[&:has([aria-selected].day-outside)]:bg-primary/5",
            "first:[&:has([aria-selected])]:rounded-l-xl",
            "last:[&:has([aria-selected])]:rounded-r-xl",
            "focus-within:relative focus-within:z-20",
          ),

        day_button: cn(
          buttonVariants({ variant: "ghost", size: "icon" }),
          "h-10 w-10 rounded-xl p-0 text-sm font-medium sm:h-9 sm:w-9",
          "hover:bg-muted",
          "aria-selected:opacity-100",
          "focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-0",
        ),

        range_start:
          "day-range-start",

        range_end:
          "day-range-end",

        selected:
          "bg-primary text-primary-foreground shadow-sm hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",

        today:
          "bg-primary/10 font-bold text-primary [&>button]:font-bold",

        outside:
          "day-outside text-muted-foreground/35 aria-selected:bg-primary/5 aria-selected:text-muted-foreground/60",

        disabled:
          "text-muted-foreground/30 opacity-40",

        range_middle:
          "aria-selected:bg-primary/10 aria-selected:text-foreground [&>button]:rounded-none [&>button]:bg-transparent [&>button]:text-foreground",

        hidden:
          "invisible",

        dropdowns:
          "relative z-10 flex items-center justify-center gap-2",

        dropdown:
          cn(
            "rdp-dropdown inline-flex h-9 items-center rounded-xl border border-border/60 bg-background px-2 text-xs font-semibold text-foreground shadow-sm outline-none",
            "hover:bg-muted/50",
            "focus:border-primary/30 focus:ring-2 focus:ring-primary/15",
          ),

        dropdown_month:
          "rdp-dropdown_month",

        dropdown_year:
          "rdp-dropdown_year",

        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === "left" ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          ),
      }}
      {...props}
    />
  )
}

Calendar.displayName = "Calendar"

export { Calendar }

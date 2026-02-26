"use client"

import { useState } from "react"
import Link from "next/link"
import type { YearGroup, MonthGroup } from "@/lib/weeks"
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  FileText,
  ArrowRight,
} from "lucide-react"

function WeekCard({
  year,
  week,
  displayWeek,
  label,
}: {
  year: number
  week: number
  displayWeek: number
  label: string
}) {
  return (
    <Link
      href={`/report/${year}/w${week}`}
      className="group flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3.5 transition-all hover:border-primary/30 hover:shadow-sm"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary font-semibold text-sm">
          W{displayWeek}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-card-foreground">
            Week {displayWeek}
          </p>
          <p className="text-xs text-muted-foreground truncate">{label}</p>
        </div>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-primary/70 opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  )
}

function MonthSection({ monthGroup, year, defaultOpen }: { monthGroup: MonthGroup; year: number; defaultOpen: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-accent/50"
      >
        <div className="flex items-center gap-2.5">
          <Calendar className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-card-foreground">
            {monthGroup.month}
          </span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {monthGroup.weeks.length} {monthGroup.weeks.length === 1 ? "report" : "reports"}
          </span>
        </div>
        {isOpen ? (
          <ChevronDown className="h-4 w-4 text-primary/70" />
        ) : (
          <ChevronRight className="h-4 w-4 text-primary/70" />
        )}
      </button>
      {isOpen && (
        <div className="border-t border-border px-4 py-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {monthGroup.weeks
              .slice()
              .sort((a, b) => b.monthWeek - a.monthWeek)
              .map((w) => (
                <WeekCard
                  key={w.week}
                  year={year}
                  week={w.week}
                  displayWeek={w.monthWeek}
                  label={w.label}
                />
              ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function ReportIndex({ data }: { data: YearGroup[] }) {
  const [activeYear, setActiveYear] = useState(data[0]?.year ?? new Date().getFullYear())
  const activeData = data.find((y) => y.year === activeYear)
  
  return (
    <div className="flex flex-col gap-6">
      {/* Year tabs */}
      <div className="flex items-center gap-2">
        {data.map((yg) => (
          <button
            key={yg.year}
            type="button"
            onClick={() => setActiveYear(yg.year)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              activeYear === yg.year
                ? "bg-primary text-primary-foreground"
                : "bg-card text-card-foreground border border-border hover:bg-accent/50"
            }`}
          >
            {yg.year}
          </button>
        ))}
      </div>

      {/* Months for active year */}
      {activeData ? (
        <div className="flex flex-col gap-4">
          {activeData.months.map((mg, idx) => (
            <MonthSection
              key={mg.month}
              monthGroup={mg}
              year={activeData.year}
              defaultOpen={idx === 0}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card py-16 text-center">
          <FileText className="h-10 w-10 text-primary/40" />
          <p className="text-sm text-muted-foreground">
            No reports available for this year.
          </p>
        </div>
      )}
    </div>
  )
}

"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
  SheetClose,
  SheetHeader,
  SheetFooter,
  SheetDescription,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { Menu, Timer, Home as HomeIcon, Tags } from "lucide-react"

const STORAGE_KEY = "fp:category-minutes"

type CategoryMinutes = Record<string, number>

type FocusEvent = {
  ts: number
  category: string
  minutes: number
}

function useCategoryMinutes() {
  const [data, setData] = useState<CategoryMinutes>({})

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as unknown
        if (parsed && typeof parsed === "object") {
          setData(parsed as CategoryMinutes)
        }
      }
    } catch {
      // ignore
    }
  }, [])

  return data
}

export default function CategoryPage() {
  const minutesByCategory = useCategoryMinutes()
  const [totalMinutes, setTotalMinutes] = useState(0)
  const [range, setRange] = useState<"daily" | "weekly">("daily")
  const [dayOffset, setDayOffset] = useState(0) // 0: today, -1: yesterday, etc.
  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const raw = window.localStorage.getItem("fp:total-minutes")
      const parsed = raw ? Number(raw) : NaN
      if (Number.isFinite(parsed)) setTotalMinutes(parsed)
    } catch {}
  }, [])

  // Load focus events for breakdown by daily/weekly
  const events = useMemo<FocusEvent[]>(() => {
    if (typeof window === "undefined") return []
    try {
      const raw = window.localStorage.getItem("fp:focus-events")
      if (!raw) return []
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed as FocusEvent[]
      return []
    } catch {
      return []
    }
  }, [])

  // Utility: all categories for stable color mapping
  const allCategories = useMemo(() => {
    const set = new Set<string>()
    Object.keys(minutesByCategory).forEach((k) => set.add(k))
    for (const ev of events) set.add(ev.category)
    return Array.from(set).filter((x) => x.trim().length > 0).sort((a, b) => a.localeCompare(b, "tr"))
  }, [minutesByCategory, events])

  const categoryColor = useMemo(() => {
    const palette = [
      "var(--chart-1)",
      "var(--chart-2)",
      "var(--chart-3)",
      "var(--chart-4)",
      "var(--chart-5)",
    ]
    const map = new Map<string, string>()
    allCategories.forEach((label, idx) => {
      map.set(label, palette[idx % palette.length])
    })
    return (label: string) => map.get(label) ?? palette[0]
  }, [allCategories])

  // Daily aggregates (category -> minutes) for selected dayOffset
  const { dailyTotalsByCategory, dailyLabel } = useMemo(() => {
    const now = new Date()
    const start = new Date(now)
    start.setDate(now.getDate() + dayOffset)
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(start.getDate() + 1)
    const startMs = start.getTime()
    const endMs = end.getTime()
    const totalsByCat = new Map<string, number>()
    for (const ev of events) {
      if (ev.ts >= startMs && ev.ts < endMs) {
        const minutes = Number(ev.minutes) || 0
        const label = ev.category
        totalsByCat.set(label, (totalsByCat.get(label) ?? 0) + minutes)
      }
    }

    const fmt = new Intl.DateTimeFormat("tr-TR", { weekday: "long", day: "2-digit", month: "long" })
    const label = fmt.format(start)
    return {
      dailyTotalsByCategory: totalsByCat,
      dailyLabel: label,
    }
  }, [events, dayOffset])

  // Weekly aggregates (Mon..Sun -> category -> minutes) for current week
  const { weekDays, weeklyTotalsByCategory } = useMemo(() => {
    const now = new Date()
    const day = now.getDay() // 0 Sun..6 Sat
    const diffToMonday = (day + 6) % 7
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - diffToMonday)
    weekStart.setHours(0, 0, 0, 0)
    const days: Array<{ key: string; date: Date; total: number; breakdown: Array<{ label: string; minutes: number }> }> = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart)
      d.setDate(weekStart.getDate() + i)
      days.push({ key: d.toISOString().slice(0, 10), date: d, total: 0, breakdown: [] })
    }
    const startMs = weekStart.getTime()
    const endMs = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000).getTime()
    const totalsByCat = new Map<string, number>()
    for (const ev of events) {
      if (ev.ts >= startMs && ev.ts < endMs) {
        const d = new Date(ev.ts)
        const idx = Math.floor((d.getTime() - startMs) / (24 * 60 * 60 * 1000))
        const dayRow = days[idx]
        if (!dayRow) continue
        const minutes = Number(ev.minutes) || 0
        const label = ev.category
        const existing = dayRow.breakdown.find((b) => b.label === label)
        if (existing) existing.minutes += minutes
        else dayRow.breakdown.push({ label, minutes })
        dayRow.total += minutes
        totalsByCat.set(label, (totalsByCat.get(label) ?? 0) + minutes)
      }
    }
    days.forEach((d) => d.breakdown.sort((a, b) => b.minutes - a.minutes))
    return { weekDays: days, weeklyTotalsByCategory: totalsByCat }
  }, [events])

  const TR_DAYS_SHORT = ["Paz", "Pzt", "Sal", "Çrş", "Per", "Cum", "Cmt"] as const

  function DailyDonut({
    totals,
    getColor,
  }: {
    totals: Map<string, number>
    getColor: (label: string) => string
  }) {
    const entries = useMemo(() => Array.from(totals.entries()).filter(([, v]) => v > 0), [totals])
    const total = useMemo(() => entries.reduce((a, [, v]) => a + v, 0), [entries])
    if (total === 0) {
      return (
        <div className="text-center text-muted-foreground py-10">Seçili günde veri yok</div>
      )
    }
    let acc = 0
    return (
      <div className="mx-auto w-64 h-64 relative">
        <svg viewBox="0 0 100 100" className="w-full h-full">
          <g transform="translate(50,50)">
            {entries.map(([label, value]) => {
              const start = (acc / total) * 2 * Math.PI
              const end = ((acc + value) / total) * 2 * Math.PI
              acc += value
              const rOuter = 45
              const rInner = 26
              const p0 = [Math.cos(start) * rOuter, Math.sin(start) * rOuter]
              const p1 = [Math.cos(end) * rOuter, Math.sin(end) * rOuter]
              const p2 = [Math.cos(end) * rInner, Math.sin(end) * rInner]
              const p3 = [Math.cos(start) * rInner, Math.sin(start) * rInner]
              const largeArc = end - start > Math.PI ? 1 : 0
              const d = [
                `M ${p0[0]} ${p0[1]}`,
                `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${p1[0]} ${p1[1]}`,
                `L ${p2[0]} ${p2[1]}`,
                `A ${rInner} ${rInner} 0 ${largeArc} 0 ${p3[0]} ${p3[1]}`,
                "Z",
              ].join(" ")
              return (
                <path key={label} d={d} fill={getColor(label)}>
                  <title>{`${label}: ${value} dk`}</title>
                </path>
              )
            })}
          </g>
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <div className="text-center leading-tight">
            <div className="text-xs text-muted-foreground">Toplam</div>
            <div className="text-lg font-semibold">{total} dk</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-dvh overflow-hidden flex relative isolate">
      {/* Decorative background (same as home) */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 h-[28rem] w-[56rem] rounded-full blur-3xl opacity-60 [background:radial-gradient(800px_400px_at_center,var(--chart-4),transparent_70%)] dark:opacity-30" />
        <div className="absolute -bottom-32 right-0 h-[26rem] w-[36rem] rounded-full blur-3xl opacity-50 [background:radial-gradient(700px_350px_at_center,var(--chart-2),transparent_70%)] dark:opacity-25" />
      </div>

      {/* Top Bar (same as home) */}
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-4 h-16">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full ring-1 ring-border/50 hover:ring-border" aria-label="Menü">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-80 p-0" aria-label="Menü">
            <SheetHeader className="px-4 pt-6 pb-4">
              <div className="flex items-center gap-3">
                <span className="inline-flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 ring-1 ring-border/60">
                  <Timer className="size-5 text-primary" />
                </span>
                <div className="min-w-0">
                  <SheetTitle className="text-base font-semibold leading-tight">Focus Pomodoro</SheetTitle>
                  <SheetDescription className="text-xs">Hızlı gezinme</SheetDescription>
                </div>
              </div>
            </SheetHeader>

            <div className="px-3">
              <div className="rounded-xl border bg-card/50 shadow-sm">
                <nav className="p-1">
                  <ul className="space-y-1">
                    <li>
                      <SheetClose asChild>
                        <Link
                          href="/"
                          className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                        >
                          <HomeIcon className="size-4 text-muted-foreground group-hover:text-foreground" />
                          <span className="truncate">Ana sayfa</span>
                        </Link>
                      </SheetClose>
                    </li>
                    <li>
                      <SheetClose asChild>
                        <Link
                          href="/category"
                          className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                        >
                          <Tags className="size-4 text-muted-foreground group-hover:text-foreground" />
                          <span className="truncate">Kategori</span>
                        </Link>
                      </SheetClose>
                    </li>
                  </ul>
                </nav>
              </div>
            </div>

            <SheetFooter className="px-4 pb-4">
              <div className="flex w-full items-center justify-between text-xs text-muted-foreground">
                <span>v0.1.0</span>
                <span className="opacity-70">© 2025</span>
              </div>
            </SheetFooter>
          </SheetContent>
        </Sheet>

        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Minutes</span>
          <Badge variant="secondary" className="rounded-full px-2.5 py-0.5">
            {totalMinutes}
          </Badge>
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 overflow-y-hidden px-4 md:px-8">
        <div className="mx-auto max-w-2xl min-h-[calc(100dvh-4rem)] flex flex-col justify-center gap-6 py-8">
          <div className="mb-6 text-center space-y-1">
            <h1 className="text-2xl font-semibold">Kategori İstatistikleri</h1>
            <p className="text-muted-foreground text-sm">
              Tamamlanan focus oturumlarından biriken dakika toplamları
            </p>
          </div>

          <Card className="rounded-3xl shadow-lg">
            <CardContent className="p-6 space-y-5">
              {/* Range toggle */}
              <div className="flex items-center justify-center gap-2">
                <Button
                  variant={range === "daily" ? "default" : "secondary"}
                  size="sm"
                  className="rounded-full"
                  onClick={() => setRange("daily")}
                >
                  Günlük
                </Button>
                <Button
                  variant={range === "weekly" ? "default" : "secondary"}
                  size="sm"
                  className="rounded-full"
                  onClick={() => setRange("weekly")}
                >
                  Haftalık
                </Button>
              </div>

              {/* Legend */}
              {allCategories.length > 0 ? (
                <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
                  {allCategories.map((cat) => (
                    <span key={cat} className="inline-flex items-center gap-2 rounded-full border px-2.5 py-1 bg-secondary/50">
                      <span className="inline-block size-2.5 rounded-full" style={{ background: categoryColor(cat) }} />
                      <span className="truncate max-w-[10rem]">{cat}</span>
                    </span>
                  ))}
                </div>
              ) : null}

              {range === "daily" ? (
                <div className="space-y-5">
                  {/* Day header with navigation */}
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">{dailyLabel}</div>
                    <div className="flex items-center gap-2">
                      <Button variant="secondary" size="sm" className="rounded-full" onClick={() => setDayOffset((d) => d - 1)}>
                        Önceki gün
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="rounded-full"
                        onClick={() => setDayOffset((d) => Math.min(0, d + 1))}
                        disabled={dayOffset >= 0}
                      >
                        Sonraki gün
                      </Button>
                    </div>
                  </div>

                  {/* Daily donut */}
                  <DailyDonut totals={dailyTotalsByCategory} getColor={categoryColor} />

                  {/* Daily totals by category */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2">
                    {Array.from(dailyTotalsByCategory.entries())
                      .sort((a, b) => b[1] - a[1])
                      .map(([label, minutes]) => (
                        <div key={label} className="flex items-center justify-between rounded-lg border px-2.5 py-1.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="inline-block size-2.5 rounded-full" style={{ background: categoryColor(label) }} />
                            <span className="truncate text-sm">{label}</span>
                          </div>
                          <span className="text-xs tabular-nums text-muted-foreground">{minutes} dk</span>
                        </div>
                      ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Weekly stacked columns */}
                  <div className="grid grid-cols-7 gap-3">
                    {weekDays.map((d) => {
                      const label = TR_DAYS_SHORT[d.date.getDay()]
                      return (
                        <div key={d.key} className="flex flex-col items-center gap-2">
                          <div className="h-40 w-8 rounded-full border border-border/70 bg-secondary/60 overflow-hidden flex flex-col-reverse">
                            {d.total > 0 ? (
                              d.breakdown.map((b) => (
                                <div
                                  key={b.label}
                                  style={{
                                    height: `${(b.minutes / Math.max(1, d.total)) * 100}%`,
                                    background: categoryColor(b.label),
                                  }}
                                  title={`${b.label}: ${b.minutes} dk`}
                                />
                              ))
                            ) : null}
                          </div>
                          <div className="text-xs text-muted-foreground text-center">
                            <div>{label}</div>
                            <div className="tabular-nums">{d.total ? `${d.total} dk` : "-"}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Weekly totals by category */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2">
                    {Array.from(weeklyTotalsByCategory.entries())
                      .sort((a, b) => b[1] - a[1])
                      .map(([label, minutes]) => (
                        <div key={label} className="flex items-center justify-between rounded-lg border px-2.5 py-1.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="inline-block size-2.5 rounded-full" style={{ background: categoryColor(label) }} />
                            <span className="truncate text-sm">{label}</span>
                          </div>
                          <span className="text-xs tabular-nums text-muted-foreground">{minutes} dk</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}


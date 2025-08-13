"use client"

import React from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import {
  Book,
  Briefcase,
  Code2,
  Sparkles,
  Search,
  Plus,
  type LucideIcon,
} from "lucide-react"

export type CategoryOption = {
  value: string
  label?: string
  icon?: LucideIcon
  colorClassName?: string
}

export type CategorySelectProps = {
  value: string
  onChange: (value: string) => void
  options: Array<string | CategoryOption>
  placeholder?: string
  className?: string
  onCreateOption?: (value: string) => void
}

const defaultIconByLabel: Record<string, LucideIcon> = {
  Genel: Sparkles,
  "Çalışma": Briefcase,
  "Yazılım": Code2,
  "Okuma": Book,
}

const defaultColorByLabel: Record<string, string> = {
  Genel:
    "text-violet-600 dark:text-violet-400 group-data-[state=open]:text-violet-700",
  "Çalışma":
    "text-emerald-600 dark:text-emerald-400 group-data-[state=open]:text-emerald-700",
  "Yazılım":
    "text-sky-600 dark:text-sky-400 group-data-[state=open]:text-sky-700",
  "Okuma":
    "text-amber-600 dark:text-amber-400 group-data-[state=open]:text-amber-700",
}

function normalizeOptions(
  options: Array<string | CategoryOption>
): CategoryOption[] {
  return options.map((opt) =>
    typeof opt === "string"
      ? {
          value: opt,
          label: opt,
          icon: defaultIconByLabel[opt] ?? Sparkles,
          colorClassName: defaultColorByLabel[opt] ?? "text-muted-foreground",
        }
      : {
          value: opt.value,
          label: opt.label ?? opt.value,
          icon: opt.icon ?? defaultIconByLabel[opt.value] ?? Sparkles,
          colorClassName:
            opt.colorClassName ?? defaultColorByLabel[opt.label ?? opt.value] ?? "text-muted-foreground",
        }
  )
}

export function CategorySelect({
  value,
  onChange,
  options,
  placeholder = "Kategori",
  className,
  onCreateOption,
}: CategorySelectProps) {
  const [query, setQuery] = React.useState("")
  const normalized = React.useMemo(() => normalizeOptions(options), [options])

  const filtered = React.useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr")
    if (!q) return normalized
    return normalized.filter((o) =>
      (o.label ?? o.value).toLocaleLowerCase("tr").includes(q)
    )
  }, [query, normalized])

  const selectedOption = React.useMemo(
    () => normalized.find((o) => o.value === value),
    [normalized, value]
  )
  const SelectedIcon = selectedOption?.icon ?? Sparkles

  const queryTrimmed = query.trim()
  const queryLc = queryTrimmed.toLocaleLowerCase("tr")
  const hasExactMatch = React.useMemo(
    () =>
      normalized.some(
        (o) => (o.label ?? o.value).toLocaleLowerCase("tr") === queryLc
      ),
    [normalized, queryLc]
  )
  const shouldShowCreate = queryTrimmed.length > 0 && !hasExactMatch

  const handleSelectChange = (nextValue: string) => {
    const exists = normalized.some((o) => o.value === nextValue)
    if (!exists) {
      onCreateOption?.(nextValue)
    }
    onChange(nextValue)
  }

  return (
    <Select value={value} onValueChange={handleSelectChange}>
      <SelectTrigger
        aria-label="Kategori seçimi"
        data-state={undefined}
        className={cn(
          "group w-full h-11 rounded-xl px-3 pr-9 bg-gradient-to-b from-secondary to-secondary/70 border border-border/80",
          "shadow-sm hover:shadow-md transition-[box-shadow,transform] duration-200 ease-out",
          "focus-visible:ring-[3px] focus-visible:ring-ring/50",
          className
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              "inline-flex size-6 items-center justify-center rounded-md bg-background/70 ring-1 ring-border/60",
              selectedOption?.colorClassName
            )}
            aria-hidden
          >
            <SelectedIcon className="size-4" />
          </span>
          <span className="truncate leading-none">
            {selectedOption?.label ?? placeholder}
          </span>
        </div>
      </SelectTrigger>
      <SelectContent className="rounded-xl overflow-hidden p-0">
        <div className="sticky top-0 z-10 p-2 border-b bg-popover/80 backdrop-blur">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              className={cn(
                "w-full h-9 pl-9 pr-3 rounded-md text-sm",
                "bg-background border border-input focus-visible:outline-hidden focus-visible:ring-[3px] focus-visible:ring-ring/50"
              )}
              placeholder="Ara veya yeni etiket ekle"
              aria-label="Kategori ara"
            />
          </div>
        </div>

        <div className="max-h-64 overflow-y-auto p-1">
          {shouldShowCreate && (
            <SelectItem
              key={`__create__:${queryTrimmed}`}
              value={queryTrimmed}
              textValue={queryTrimmed}
              className={cn(
                "rounded-lg data-[highlighted]:bg-accent/60 data-[state=checked]:bg-accent/70",
                "transition-colors"
              )}
            >
              <span className="mr-1 text-emerald-600 dark:text-emerald-400" aria-hidden>
                <Plus className="size-4" />
              </span>
              <span className="truncate">Yeni etiket ekle: &quot;{queryTrimmed}&quot;</span>
            </SelectItem>
          )}

          {filtered.length === 0 && !shouldShowCreate ? (
            <div className="px-3 py-6 text-sm text-muted-foreground text-center">
              Sonuç bulunamadı
            </div>
          ) : (
            filtered.map((opt) => {
              const Icon = opt.icon ?? Sparkles
              return (
                <SelectItem
                  key={opt.value}
                  value={opt.value}
                  textValue={opt.label ?? opt.value}
                  className={cn(
                    "rounded-lg data-[highlighted]:bg-accent/60 data-[state=checked]:bg-accent/70",
                    "transition-colors"
                  )}
                >
                  <span className={cn("mr-1", opt.colorClassName)} aria-hidden>
                    <Icon className="size-4" />
                  </span>
                  <span className="truncate">{opt.label ?? opt.value}</span>
                </SelectItem>
              )
            })
          )}
        </div>
      </SelectContent>
    </Select>
  )
}

export default CategorySelect

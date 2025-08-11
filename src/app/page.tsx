"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Menu, Pause, Play, RotateCcw, SkipForward } from "lucide-react";
import dynamic from "next/dynamic";
import CategorySelect from "@/components/category-select";

const LottiePlayer = dynamic(
  () => import("@lottiefiles/react-lottie-player").then((m) => m.Player),
  { ssr: false }
);

type TimerMode = "focus" | "short" | "long";

type Durations = {
  focus: number; // minutes
  short: number; // minutes
  long: number; // minutes
};

const DEFAULT_DURATIONS: Durations = {
  focus: 25,
  short: 5,
  long: 15,
};

const STORAGE_KEYS = {
  durations: "fp:durations",
  category: "fp:category",
  totalMinutes: "fp:total-minutes",
  streakCount: "fp:focus-streak",
} as const;

const CATEGORIES = ["Genel", "Çalışma", "Yazılım", "Okuma"] as const;

function useLocalStorageNumber(key: string, initialValue: number) {
  const [value, setValue] = useState<number>(initialValue);
  const didLoadRef = useRef(false);

  // Load on mount (client-only)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? Number(raw) : NaN;
    if (Number.isFinite(parsed)) {
      setValue(parsed);
    }
    didLoadRef.current = true;
  }, [key]);

  // Persist after we've attempted an initial load
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!didLoadRef.current) return;
    window.localStorage.setItem(key, String(value));
  }, [key, value]);

  return [value, setValue] as const;
}

function secondsToClock(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export default function Home() {
  // durations stored in localStorage (hydrate after mount to avoid SSR mismatch)
  const [durations, setDurations] = useState<Durations>(DEFAULT_DURATIONS);
  const [durationsLoaded, setDurationsLoaded] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEYS.durations);
      const parsed = raw ? (JSON.parse(raw) as Partial<Durations>) : undefined;
      if (parsed && typeof parsed === "object") {
        setDurations((prev) => ({ ...prev, ...parsed }));
      }
    } catch {
      // ignore malformed JSON
    }
    setDurationsLoaded(true);
  }, []);
  useEffect(() => {
    if (!durationsLoaded) return;
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      STORAGE_KEYS.durations,
      JSON.stringify(durations)
    );
  }, [durations, durationsLoaded]);

  const [selectedCategory, setSelectedCategory] = useState<string>(
    CATEGORIES[0]
  );
  const [categoryLoaded, setCategoryLoaded] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(STORAGE_KEYS.category);
    if (stored) setSelectedCategory(stored);
    setCategoryLoaded(true);
  }, []);
  useEffect(() => {
    if (!categoryLoaded) return;
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEYS.category, selectedCategory);
  }, [selectedCategory, categoryLoaded]);

  const [mode, setMode] = useState<TimerMode>("focus");
  const [isRunning, setIsRunning] = useState(false);
  const [completedFocusCount, setCompletedFocusCount] = useLocalStorageNumber(
    STORAGE_KEYS.streakCount,
    0
  );
  const [totalMinutes, setTotalMinutes] = useLocalStorageNumber(
    STORAGE_KEYS.totalMinutes,
    0
  );

  // seconds remaining
  const [remainingSeconds, setRemainingSeconds] = useState<number>(() => durations[mode] * 60);
  useEffect(() => setRemainingSeconds(durations[mode] * 60), [durations, mode]);

  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isRunning) return;
    intervalRef.current = window.setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          window.clearInterval(intervalRef.current ?? undefined);
          intervalRef.current = null;
          setIsRunning(false);
          onFinish();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning]);

  // Update page title while running
  useEffect(() => {
    const titlePrefix = isRunning ? `⏳ ${secondsToClock(remainingSeconds)} ` : "";
    document.title = `${titlePrefix}Focus Pomodoro`;
  }, [isRunning, remainingSeconds]);

  function beep() {
    const AudioContextCtor =
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext || window.AudioContext;
    if (!AudioContextCtor) return;
    const ctx = new AudioContextCtor();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = 880;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.2);
    setTimeout(() => {
      o.stop();
      ctx.close();
    }, 1300);
  }

  function nextMode(current: TimerMode): TimerMode {
    if (current === "focus") {
      // every 4 focus sessions give a long break
      const next = (completedFocusCount + 1) % 4 === 0 ? "long" : "short";
      return next;
    }
    return "focus";
  }

  function onFinish() {
    beep();
    if (mode === "focus") {
      setCompletedFocusCount((c) => c + 1);
      setTotalMinutes((m) => m + durations.focus);
    }
    const nm = nextMode(mode);
    setMode(nm);
    setRemainingSeconds(durations[nm] * 60);
  }

  function handleStartPause() {
    setIsRunning((r) => !r);
  }

  function handleReset() {
    setIsRunning(false);
    setRemainingSeconds(durations[mode] * 60);
  }

  function handleSkip() {
    setIsRunning(false);
    if (mode === "focus") {
      // skip does not count as completed focus
    }
    const nm = nextMode(mode);
    setMode(nm);
    setRemainingSeconds(durations[nm] * 60);
  }

  const modeLabel = mode === "focus" ? "Focus" : "Break";

  return (
    <div className="h-dvh overflow-hidden flex flex-col relative isolate">
      {/* Decorative background */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 h-[28rem] w-[56rem] rounded-full blur-3xl opacity-60 [background:radial-gradient(800px_400px_at_center,var(--chart-4),transparent_70%)] dark:opacity-30" />
        <div className="absolute -bottom-32 right-0 h-[26rem] w-[36rem] rounded-full blur-3xl opacity-50 [background:radial-gradient(700px_350px_at_center,var(--chart-2),transparent_70%)] dark:opacity-25" />
      </div>

      {/* Top Bar (absolute, transparent) */}
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-4 h-16">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full ring-1 ring-border/50 hover:ring-border">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-80" aria-label="Menü">
            <SheetTitle className="sr-only">Menü</SheetTitle>
          </SheetContent>
        </Sheet>

        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Minutes</span>
          <Badge variant="secondary" className="rounded-full px-2.5 py-0.5">
            {totalMinutes}
          </Badge>
        </div>
      </div>

      {/* Center Timer */}
      <main className="grid place-items-center px-4 py-16 min-h-dvh">
        {/* Wrapper to position Lottie relative to the card */}
        <div className="relative">
          {/* Lottie animation from public placed flush to the top-right of the card */}
          <LottiePlayer
            autoplay
            loop
            keepLastFrame
            speed={0.3}
            src="/Le Petit Chat _Cat_ Noir.json"
            className="pointer-events-none absolute -top-28 -right-0 h-28 w-28 z-10"
            aria-hidden
          />
          <Card className="rounded-[32px] w-[310px] sm:w-[360px] shadow-lg shadow-black/5 dark:shadow-black/30">
            <CardContent className="p-8">
              <div className="text-center space-y-3">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">{modeLabel}</div>
                <div className="font-mono text-6xl sm:text-7xl font-semibold leading-none bg-gradient-to-b from-foreground to-foreground/70 bg-clip-text text-transparent">
                  {secondsToClock(remainingSeconds)}
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Kategori</div>
                  <CategorySelect
                    value={selectedCategory}
                    onChange={(v) => setSelectedCategory(v)}
                    options={[...CATEGORIES]}
                    className="w-full"
                  />
                </div>
              </div>

              <div className="mt-8 flex items-center justify-center gap-6">
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-14 w-14 rounded-full shadow-sm"
                  onClick={handleReset}
                  aria-label="Sıfırla"
                >
                  <RotateCcw className="h-6 w-6" />
                </Button>

                <Button
                  size="icon"
                  className="h-16 w-16 rounded-full shadow-md shadow-primary/20"
                  onClick={handleStartPause}
                  aria-label={isRunning ? "Duraklat" : "Başlat"}
                >
                  {isRunning ? (
                    <Pause className="h-7 w-7" />
                  ) : (
                    <Play className="h-7 w-7" />
                  )}
                </Button>

                <Button
                  variant="secondary"
                  size="icon"
                  className="h-14 w-14 rounded-full shadow-sm"
                  onClick={handleSkip}
                  aria-label="Geç"
                >
                  <SkipForward className="h-6 w-6" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Users, CalendarCheck, SearchX, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { StudentTermCard } from "@/components/student-term-card";
import { CreateClassButton } from "@/components/create-class-dialog";
import { ImportTemplateButton } from "@/components/import-template-dialog";
import {
  computeStats,
  getScheduleStatus,
  todayShanghai,
  classifyTerm,
  TERM_DEFS,
} from "@/lib/schedule-utils";
import type {
  StudentTermSchedule,
  ScheduleStats,
  TermType,
  ScheduleStatus,
} from "@/lib/schedule-utils";
import { syncSchedules } from "@/app/actions/schedule";
import type { ScheduleFieldOptions } from "@/app/actions/schedule";

interface Props {
  schedules: StudentTermSchedule[];
  stats: ScheduleStats;
  fieldOptions: ScheduleFieldOptions;
}

// Grade sort order: elementary small → large, then middle school
const GRADE_ORDER = [
  "一年级", "二年级", "三年级", "四年级", "五年级", "六年级",
  "初一", "初二", "初三",
];

// Term pill order: 春 → 暑 → 秋 → 寒
const TERM_OPTIONS: { value: TermType | "all"; label: string }[] = [
  { value: "all",    label: "全部" },
  { value: "spring", label: "春季" },
  { value: "summer", label: "暑季" },
  { value: "autumn", label: "秋季" },
  { value: "winter", label: "寒季" },
];

const STATUS_OPTIONS: { value: ScheduleStatus | "all"; label: string }[] = [
  { value: "all",       label: "全部" },
  { value: "pending",   label: "待授课" },
  { value: "ongoing",   label: "正在授课" },
  { value: "completed", label: "已结课" },
];

// Auto-refresh every 5 s — fetchLongTermSchedules has no cache layer,
// so each refresh always pulls the latest data from Teable.
const AUTO_REFRESH_MS = 5_000;

// ── Current term + date badge ─────────────────────────────────────
const WEEKDAYS_LABEL = ["日", "一", "二", "三", "四", "五", "六"] as const;
const SHANGHAI_MS = 8 * 60 * 60 * 1000;

function CurrentTermDisplay() {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    const now = new Date(Date.now() + SHANGHAI_MS);
    const year    = now.getUTCFullYear();
    const month   = now.getUTCMonth() + 1;
    const day     = now.getUTCDate();
    const weekday = now.getUTCDay();

    let termLabel = "秋季";
    for (const def of Object.values(TERM_DEFS)) {
      if (def.months.includes(month)) { termLabel = def.label; break; }
    }

    setText(`${year}${termLabel}  ·  ${month}月${day}日 周${WEEKDAYS_LABEL[weekday]}`);
  }, []);

  if (!text) return null;
  return (
    <p className="text-xs text-gray-400 mt-0.5 tabular-nums">{text}</p>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-white px-4 py-3 shadow-sm">
      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-gray-100">
        <Icon className="h-4 w-4 text-gray-600" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900 leading-none">{value}</p>
        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

export function ScheduleBoard({ schedules, fieldOptions }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [gradeFilter,      setGradeFilter]      = useState<string>("all");
  const [teacherFilter,    setTeacherFilter]    = useState<string>("all");
  const [termFilter,       setTermFilter]       = useState<TermType | "all">("all");
  const [statusFilter,     setStatusFilter]     = useState<ScheduleStatus | "all">("all");
  const [courseTypeFilter, setCourseTypeFilter] = useState<string>("all");

  // ── Auto-refresh ──────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => { router.refresh(); }, AUTO_REFRESH_MS);
    return () => clearInterval(id);
  }, [router]);

  // ── Optimistic list: new entries shown immediately after creation ──
  const [optimistic, setOptimistic] = useState<StudentTermSchedule[]>([]);

  useEffect(() => {
    if (!optimistic.length) return;
    const serverKeys = new Set(schedules.map((s) => s.key));
    setOptimistic((prev) => prev.filter((s) => !serverKeys.has(s.key)));
  }, [schedules]); // eslint-disable-line react-hooks/exhaustive-deps

  const allSchedules = useMemo(() => {
    const optKeys = new Set(optimistic.map((s) => s.key));
    return [...optimistic, ...schedules.filter((s) => !optKeys.has(s.key))];
  }, [optimistic, schedules]);

  // Current term (e.g. 2026暑季) — used for stats scoping and card sort priority
  const currentTerm = useMemo(() => classifyTerm(todayShanghai()), []);

  // Stats only reflect the current term's classes
  const currentTermSchedules = useMemo(
    () => allSchedules.filter(
      (s) => s.term.type === currentTerm.type && s.term.year === currentTerm.year
    ),
    [allSchedules, currentTerm]
  );
  const displayStats = useMemo(() => computeStats(currentTermSchedules), [currentTermSchedules]);

  // Sort: current term first (by first lesson date asc), other terms keep original order
  const sortedSchedules = useMemo(() => {
    return [...allSchedules].sort((a, b) => {
      const aIsCurr = a.term.type === currentTerm.type && a.term.year === currentTerm.year;
      const bIsCurr = b.term.type === currentTerm.type && b.term.year === currentTerm.year;
      if (aIsCurr && !bIsCurr) return -1;
      if (!aIsCurr && bIsCurr) return 1;
      if (aIsCurr && bIsCurr) {
        const aMin = a.lessons.length
          ? Math.min(...a.lessons.map((l) => new Date(l.date).getTime()))
          : Infinity;
        const bMin = b.lessons.length
          ? Math.min(...b.lessons.map((l) => new Date(l.date).getTime()))
          : Infinity;
        return aMin - bMin;
      }
      return 0;
    });
  }, [allSchedules, currentTerm]);

  function handleCreated(newSchedule: StudentTermSchedule) {
    setOptimistic((prev) => [newSchedule, ...prev]);
    startTransition(async () => {
      await syncSchedules();
      router.refresh();
    });
  }

  // Grades sorted by GRADE_ORDER; unknowns appended alphabetically
  const grades = useMemo(() => {
    const s = new Set<string>();
    allSchedules.forEach((sc) => { if (sc.grade) s.add(sc.grade); });
    return Array.from(s).sort((a, b) => {
      const ai = GRADE_ORDER.indexOf(a);
      const bi = GRADE_ORDER.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b, "zh");
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }, [allSchedules]);

  const teachers = useMemo(() => {
    const s = new Set<string>();
    allSchedules.forEach((sc) => { if (sc.teacher) s.add(sc.teacher); });
    return Array.from(s).sort((a, b) => a.localeCompare(b, "zh"));
  }, [allSchedules]);

  const filtered = useMemo(() => {
    const today = todayShanghai();
    return sortedSchedules.filter((sc) => {
      if (gradeFilter      !== "all" && sc.grade      !== gradeFilter)      return false;
      if (teacherFilter    !== "all" && sc.teacher    !== teacherFilter)    return false;
      if (termFilter       !== "all" && sc.term.type  !== termFilter)       return false;
      if (statusFilter     !== "all" && getScheduleStatus(sc, today)        !== statusFilter) return false;
      if (courseTypeFilter !== "all" && sc.courseType !== courseTypeFilter) return false;
      return true;
    });
  }, [allSchedules, gradeFilter, teacherFilter, termFilter, statusFilter, courseTypeFilter]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 border-b bg-white px-6 py-3 shadow-sm">
        <div className="mx-auto max-w-7xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-900">
              <CalendarCheck className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-gray-900 leading-none">班课管理</h1>
              <CurrentTermDisplay />
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ImportTemplateButton onImported={() => {
              startTransition(async () => {
                await syncSchedules();
                router.refresh();
              });
            }} />
            <CreateClassButton onCreated={handleCreated} fieldOptions={fieldOptions} />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-6 space-y-5">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard icon={Users}         label="当前开班"  value={displayStats.totalGroups} />
          <StatCard icon={BookOpen}      label="正在授课"  value={displayStats.ongoingGroups} />
          <StatCard icon={CalendarCheck} label="已结课"    value={displayStats.completedGroups} />
        </div>

        {/* Filter panel */}
        <div className="rounded-lg border bg-white px-4 py-3 shadow-sm space-y-3">
          {/* Row 1: grade · term · status */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {/* Grade */}
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-xs text-gray-400 mr-0.5">年级</span>
              {["all", ...grades].map((g) => (
                <button
                  key={g}
                  onClick={() => setGradeFilter(g)}
                  className={cn(
                    "px-2 py-0.5 rounded-full text-xs border transition-colors",
                    gradeFilter === g
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                  )}
                >
                  {g === "all" ? "全部" : g}
                </button>
              ))}
            </div>

            {/* Term */}
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-xs text-gray-400 mr-0.5">学期</span>
              {TERM_OPTIONS.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setTermFilter(t.value)}
                  className={cn(
                    "px-2 py-0.5 rounded-full text-xs border transition-colors",
                    termFilter === t.value
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Status */}
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-xs text-gray-400 mr-0.5">状态</span>
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setStatusFilter(s.value)}
                  className={cn(
                    "px-2 py-0.5 rounded-full text-xs border transition-colors",
                    statusFilter === s.value
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Course type */}
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-xs text-gray-400 mr-0.5">班型</span>
              {(["all", "长期班", "短期班"] as const).map((ct) => (
                <button
                  key={ct}
                  onClick={() => setCourseTypeFilter(ct)}
                  className={cn(
                    "px-2 py-0.5 rounded-full text-xs border transition-colors",
                    courseTypeFilter === ct
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                  )}
                >
                  {ct === "all" ? "全部" : ct}
                </button>
              ))}
            </div>
          </div>

          {/* Row 2: teacher */}
          {teachers.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-xs text-gray-400 mr-0.5">老师</span>
              {["all", ...teachers].map((t) => (
                <button
                  key={t}
                  onClick={() => setTeacherFilter(t)}
                  className={cn(
                    "px-2 py-0.5 rounded-full text-xs border transition-colors",
                    teacherFilter === t
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                  )}
                >
                  {t === "all" ? "全部" : t}
                </button>
              ))}
            </div>
          )}

          {filtered.length !== allSchedules.length && (
            <p className="text-xs text-gray-400 pt-0.5">
              筛选结果：<span className="font-medium text-gray-700">{filtered.length}</span>{" "}
              / {allSchedules.length} 组
            </p>
          )}
        </div>

        {/* Card grid */}
        {filtered.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((sc) => (
              <StudentTermCard key={sc.key} schedule={sc} fieldOptions={fieldOptions} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-gray-400">
            <SearchX className="h-10 w-10" />
            {allSchedules.length === 0 ? (
              <>
                <p className="text-sm font-medium text-gray-500">暂无长期班排课数据</p>
                <p className="text-xs text-center max-w-xs">
                  请先在排课台账中为学生添加「课程类型 = 长期班」的排课记录，
                  看板实时同步，5 秒内自动更新。
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-gray-500">没有符合条件的课程</p>
                <p className="text-xs">尝试调整年级、学期、状态或老师筛选条件</p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

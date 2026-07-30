"use client";

import { useState, useTransition, useEffect, useCallback, useRef } from "react";
import {
  Plus, ChevronLeft, ChevronRight, X, Loader2, CheckCircle2,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { importScheduleRecords } from "@/app/actions/schedule";
import type { ScheduleFieldOptions } from "@/app/actions/schedule";
import { TERM_DEFS } from "@/lib/schedule-utils";
import type { TermType, TermInfo, StudentTermSchedule } from "@/lib/schedule-utils";

const TERM_LIST: { value: TermType; label: string; color: string }[] = [
  { value: "spring", label: "春季", color: "bg-emerald-500" },
  { value: "summer", label: "暑季", color: "bg-amber-500" },
  { value: "autumn", label: "秋季", color: "bg-orange-500" },
  { value: "winter", label: "寒季", color: "bg-sky-500" },
];

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];
const MONTH_LABELS   = ["", "1月", "2月", "3月", "4月", "5月", "6月",
                           "7月", "8月", "9月", "10月", "11月", "12月"];

// Mon→Sun displayed in order 一二三四五六日 (JS getDay: 1-6, 0)
const WEEKDAY_OPTIONS = [
  { label: "一", value: 1 },
  { label: "二", value: 2 },
  { label: "三", value: 3 },
  { label: "四", value: 4 },
  { label: "五", value: 5 },
  { label: "六", value: 6 },
  { label: "日", value: 0 },
] as const;

// ── Helpers ──────────────────────────────────────────────────────
function toISO(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
function formatChineseDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const wd = WEEKDAY_LABELS[date.getDay()];
  return `${m}月${d}日 周${wd}`;
}

// ── Multi-date calendar ──────────────────────────────────────────
interface CalendarProps {
  viewYear: number;
  viewMonth: number;
  selected: string[];
  termMonths: number[];
  onToggle: (iso: string) => void;
  /** Called at end of a multi-date drag with the range + whether we're adding or removing */
  onBatchToggle: (dates: string[], adding: boolean) => void;
  onPrev: () => void;
  onNext: () => void;
  expected: number;
  termColor: string; // tailwind bg class for dots
}

function MonthCalendar({
  viewYear, viewMonth, selected, termMonths,
  onToggle, onBatchToggle, onPrev, onNext, expected, termColor,
}: CalendarProps) {
  // Generate grid: pad with nulls before first day
  const firstDow = new Date(viewYear, viewMonth - 1, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
  const monthDates = Array.from({ length: daysInMonth }, (_, i) =>
    toISO(viewYear, viewMonth, i + 1)
  );
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const isInTerm = termMonths.includes(viewMonth);
  const selectedCount = selected.length;

  // ── Drag-select state ────────────────────────────────────────
  const isDragging      = useRef(false);
  const dragStartRef    = useRef<string | null>(null);
  const dragAddingRef   = useRef(true);
  const dragCurrentRef  = useRef<string | null>(null);
  // monthDatesRef always points to the current month's date list (avoids stale closure)
  const monthDatesRef   = useRef<string[]>(monthDates);
  monthDatesRef.current = monthDates;
  // Stable callback refs
  const onToggleRef      = useRef(onToggle);
  const onBatchToggleRef = useRef(onBatchToggle);
  onToggleRef.current      = onToggle;
  onBatchToggleRef.current = onBatchToggle;
  // State only for triggering re-renders during drag
  const [dragCurrent, setDragCurrent] = useState<string | null>(null);

  // Commit drag on mouseup anywhere on the document
  useEffect(() => {
    function handleMouseUp() {
      if (!isDragging.current) return;
      isDragging.current = false;

      const start   = dragStartRef.current;
      const current = dragCurrentRef.current;
      dragStartRef.current   = null;
      dragCurrentRef.current = null;
      setDragCurrent(null);

      if (!start) return;

      if (!current || start === current) {
        // Single click — toggle the one cell
        onToggleRef.current(start);
      } else {
        // Multi-cell drag — collect the range
        const dates = monthDatesRef.current;
        const s = dates.indexOf(start);
        const e = dates.indexOf(current);
        if (s !== -1 && e !== -1) {
          const lo = Math.min(s, e), hi = Math.max(s, e);
          onBatchToggleRef.current(dates.slice(lo, hi + 1), dragAddingRef.current);
        } else {
          onToggleRef.current(start);
        }
      }
    }
    document.addEventListener("mouseup", handleMouseUp);
    return () => document.removeEventListener("mouseup", handleMouseUp);
  }, []); // stable — reads only from refs

  function handleDayMouseDown(iso: string, e: React.MouseEvent) {
    e.preventDefault(); // block text selection
    isDragging.current     = true;
    dragStartRef.current   = iso;
    dragCurrentRef.current = iso;
    dragAddingRef.current  = !selected.includes(iso); // adding if not already selected
    setDragCurrent(iso);
  }

  function handleDayMouseEnter(iso: string) {
    if (!isDragging.current) return;
    dragCurrentRef.current = iso;
    setDragCurrent(iso);
  }

  // Build preview range set
  const dragRangeSet = new Set<string>();
  if (isDragging.current && dragStartRef.current && dragCurrent) {
    const s = monthDates.indexOf(dragStartRef.current);
    const e = monthDates.indexOf(dragCurrent);
    if (s !== -1 && e !== -1) {
      const lo = Math.min(s, e), hi = Math.max(s, e);
      for (let i = lo; i <= hi; i++) dragRangeSet.add(monthDates[i]);
    }
  }
  const isAdding = dragAddingRef.current;

  return (
    <div className="flex flex-col gap-2 select-none">
      {/* Navigation */}
      <div className="flex items-center justify-between px-1">
        <button onClick={onPrev} className="p-1 rounded hover:bg-gray-100 transition-colors">
          <ChevronLeft className="h-4 w-4 text-gray-500" />
        </button>
        <div className="text-center">
          <span className="font-semibold text-gray-800 text-sm">
            {viewYear}年 {MONTH_LABELS[viewMonth]}
          </span>
          {isInTerm && (
            <span className={cn("ml-2 text-xs px-1.5 py-0.5 rounded-full text-white", termColor)}>
              学期月份
            </span>
          )}
        </div>
        <button onClick={onNext} className="p-1 rounded hover:bg-gray-100 transition-colors">
          <ChevronRight className="h-4 w-4 text-gray-500" />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 text-center">
        {WEEKDAY_LABELS.map((d) => (
          <div key={d} className="text-[11px] text-gray-400 py-1">{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, i) => {
          if (day === null) return <div key={i} />;
          const iso = toISO(viewYear, viewMonth, day);
          const sel = selected.includes(iso);
          const inRange = dragRangeSet.has(iso);

          // Determine visual state (preview during drag, committed otherwise)
          let cellCls: string;
          if (inRange) {
            if (isAdding) {
              // Will be added — show preview-selected (slightly transparent)
              cellCls = cn("text-white shadow-sm opacity-75 cursor-grabbing", termColor);
            } else {
              // Will be removed — show preview-removed
              cellCls = "bg-red-100 text-red-400 line-through cursor-grabbing";
            }
          } else if (sel) {
            cellCls = cn("text-white shadow-sm", termColor);
          } else {
            cellCls = cn(
              "hover:bg-gray-100",
              isInTerm ? "text-gray-800" : "text-gray-400"
            );
          }

          return (
            <button
              key={i}
              onMouseDown={(e) => handleDayMouseDown(iso, e)}
              onMouseEnter={() => handleDayMouseEnter(iso)}
              title={formatChineseDate(iso)}
              draggable={false}
              className={cn(
                "aspect-square rounded-lg text-xs flex items-center justify-center font-medium transition-colors",
                cellCls,
              )}
            >
              {sel && !inRange ? <CheckCircle2 className="h-3.5 w-3.5" /> : day}
            </button>
          );
        })}
      </div>

      {/* Counter */}
      <div className="flex items-center justify-between pt-1 border-t px-1">
        <span className="text-xs text-gray-500">
          已选 <span className="font-bold text-gray-800">{selectedCount}</span> 节
          <span className="text-gray-400"> / 计划 {expected} 节</span>
        </span>
        {selectedCount > 0 && (
          <div
            className="h-1.5 rounded-full bg-gray-200 w-24 overflow-hidden"
            title={`${Math.round((selectedCount / expected) * 100)}%`}
          >
            <div
              className={cn("h-full rounded-full transition-all", termColor)}
              style={{ width: `${Math.min(100, (selectedCount / expected) * 100)}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Form fields helper ───────────────────────────────────────────
function Field({ label, required, children }: {
  label: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-medium text-gray-600">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </Label>
      {children}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────
interface Props {
  onCreated: (schedule: StudentTermSchedule) => void;
  fieldOptions: ScheduleFieldOptions;
}

export function CreateClassButton({ onCreated, fieldOptions }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)} className="gap-1.5">
        <Plus className="h-3.5 w-3.5" />
        新增班课
      </Button>
      <CreateClassDialog open={open} onOpenChange={setOpen} onCreated={onCreated} fieldOptions={fieldOptions} />
    </>
  );
}

function CreateClassDialog({
  open, onOpenChange, onCreated, fieldOptions,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (schedule: StudentTermSchedule) => void;
  fieldOptions: ScheduleFieldOptions;
}) {
  const [isPending, startTransition] = useTransition();

  // ── Form state ─────────────────────────────────────────────
  const [year,       setYear]       = useState(2026);
  const [term,       setTerm]       = useState<TermType>("summer");
  const [courseType, setCourseType] = useState("长期班");
  const [topic,      setTopic]      = useState("");
  const [grade,      setGrade]      = useState("");
  const [teacher,    setTeacher]    = useState("");
  const [classroom,  setClassroom]  = useState("");
  const [timeSlot,   setTimeSlot]   = useState("");
  const [flexTime,   setFlexTime]   = useState("");

  // ── Calendar state ─────────────────────────────────────────
  const [viewYear,  setViewYear]  = useState(2026);
  const [viewMonth, setViewMonth] = useState(7);  // default July for summer
  const [selected,  setSelected]  = useState<string[]>([]);

  // ── Batch generator state ───────────────────────────────
  const [genStart,    setGenStart]    = useState("");
  const [genWeekdays, setGenWeekdays] = useState<number[]>([]);
  const [genCount,    setGenCount]    = useState<number | "">(TERM_DEFS["summer"].expectedCount);

  // Jump calendar + reset generator when term/year changes
  useEffect(() => {
    const firstMonth = TERM_DEFS[term].months[0];
    setViewYear(year);
    setViewMonth(firstMonth);
    setSelected([]);
    setGenCount(TERM_DEFS[term].expectedCount);
  }, [term, year]);

  const termDef     = TERM_DEFS[term];
  const termListItem = TERM_LIST.find((t) => t.value === term)!;

  const toggleDate = useCallback((iso: string) => {
    setSelected((prev) =>
      prev.includes(iso) ? prev.filter((d) => d !== iso) : [...prev, iso]
    );
  }, []);

  const handleBatchToggle = useCallback((dates: string[], adding: boolean) => {
    setSelected((prev) => {
      if (adding) {
        const toAdd = dates.filter((d) => !prev.includes(d));
        return [...prev, ...toAdd];
      } else {
        const removeSet = new Set(dates);
        return prev.filter((d) => !removeSet.has(d));
      }
    });
  }, []);

  function prevMonth() {
    if (viewMonth === 1) { setViewYear((y) => y - 1); setViewMonth(12); }
    else setViewMonth((m) => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 12) { setViewYear((y) => y + 1); setViewMonth(1); }
    else setViewMonth((m) => m + 1);
  }

  // ── Batch date generation ────────────────────────────────
  function toggleWeekday(wd: number) {
    setGenWeekdays((prev) =>
      prev.includes(wd) ? prev.filter((d) => d !== wd) : [...prev, wd]
    );
  }

  function handleGenerate() {
    if (!genStart)           { toast.error("请选择起始日期"); return; }
    if (!genWeekdays.length) { toast.error("请至少选择一个上课星期"); return; }
    if (!genCount)           { toast.error("请填写节数"); return; }

    const dates: string[] = [];
    // Parse as local date to avoid timezone shift
    const [sy, sm, sd] = genStart.split("-").map(Number);
    const cursor = new Date(sy, sm - 1, sd);
    const deadline = new Date(sy + 2, sm - 1, sd); // max 2 years

    while (dates.length < Number(genCount) && cursor < deadline) {
      if (genWeekdays.includes(cursor.getDay())) {
        dates.push(toISO(cursor.getFullYear(), cursor.getMonth() + 1, cursor.getDate()));
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    setSelected(dates);
    // Jump calendar to the first generated date
    if (dates.length) {
      const [fy, fm] = dates[0].split("-").map(Number);
      setViewYear(fy); setViewMonth(fm);
    }
  }

  // ── Build optimistic schedule from current form state ────
  // Called right before state is reset so all values are still current.
  function buildOptimisticSchedule(): StudentTermSchedule {
    const studentField = "";
    const def = TERM_DEFS[term];
    const termInfo: TermInfo = {
      type:          term,
      label:         def.label,
      year,
      expectedCount: def.expectedCount,
      colorClass:    def.colorClass,
      bgClass:       def.bgClass,
      barClass:      def.barClass,
    };
    const timeKey = timeSlot || flexTime.trim() || "";
    const key = [topic.trim(), studentField, teacher, term, String(year), timeKey].join("||");
    const now = Date.now();
    return {
      key,
      topic:      topic.trim(),
      student:    studentField,
      grade,
      teacher,
      classroom,
      timeSlot,
      flexTime,
      courseType,
      term: termInfo,
      lessons: [...selected].sort().map((date, i) => ({
        id:         `opt-${now}-${i}`,
        student:    studentField,
        grade,
        teacher,
        date,
        classroom,
        timeSlot,
        notes:      flexTime,
        topic:      topic.trim(),
        courseType,
      })),
    };
  }

  // ── Concurrent class (同期新增) ──────────────────────────
  function handleConcurrentAdd() {
    if (!topic.trim())   { toast.error("请填写课程主题"); return; }
    if (!teacher)        { toast.error("请选择老师"); return; }
    if (!grade)          { toast.error("请选择年级"); return; }
    if (!classroom)      { toast.error("请选择教室"); return; }
    if (!selected.length){ toast.error("请至少选择一节课的日期"); return; }

    startTransition(async () => {
      const sortedDates = [...selected].sort();
      const result = await importScheduleRecords(
        sortedDates.map((date) => ({
          student:    "",
          date,
          grade,
          teacher,
          classroom,
          courseType: courseType || undefined,
          timeSlot:   timeSlot  || undefined,
          flexTime:   flexTime.trim() || undefined,
          topic:      topic.trim()    || undefined,
        }))
      );

      if (result.success) {
        toast.success("已添加，继续填写同期班", {
          description: `${termDef.label}${year} · ${teacher} · ${grade} · ${result.count}节`,
        });
        // Build before state reset so values are still current
        const newSchedule = buildOptimisticSchedule();
        // Keep dates & term/year; reset only class-specific metadata
        setTopic(""); setGrade("");
        setTeacher(""); setClassroom(""); setTimeSlot(""); setFlexTime("");
        onCreated(newSchedule);
      } else {
        toast.error("添加失败", { description: result.error });
      }
    });
  }

  // Reset form when dialog closes
  function handleClose() {
    onOpenChange(false);
  }

  function handleSubmit() {
    if (!topic.trim())   { toast.error("请填写课程主题"); return; }
    if (!teacher)        { toast.error("请选择老师"); return; }
    if (!grade)          { toast.error("请选择年级"); return; }
    if (!classroom)      { toast.error("请选择教室"); return; }
    if (!selected.length){ toast.error("请至少选择一节课的日期"); return; }

    startTransition(async () => {
      const sortedDates = [...selected].sort();
      const result = await importScheduleRecords(
        sortedDates.map((date) => ({
          student:    "",
          date,
          grade,
          teacher,
          classroom,
          courseType: courseType || undefined,
          timeSlot:   timeSlot || undefined,
          flexTime:   flexTime.trim() || undefined,
          topic:      topic.trim() || undefined,
        }))
      );

      if (result.success) {
        toast.success(`已创建 ${result.count} 节课`, {
          description: `${termDef.label}${year} · ${teacher} · ${grade}`,
        });
        // Build before state reset so values are still current
        const newSchedule = buildOptimisticSchedule();
        onOpenChange(false);
        // Reset form for next use
        setTopic(""); setGrade(""); setTeacher("");
        setClassroom(""); setTimeSlot(""); setFlexTime(""); setSelected([]);
        onCreated(newSchedule);
      } else {
        toast.error("导入失败", { description: result.error });
      }
    });
  }

  const sortedSelected = [...selected].sort();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* sm:max-w-[940px] evicts the default sm:max-w-lg so tailwind-merge
          picks the right winner — bare max-w-4xl does NOT override it. */}
      <DialogContent className="sm:max-w-[940px] max-h-[92vh] overflow-y-auto p-0">
        <DialogHeader className="px-7 pt-6 pb-0">
          <DialogTitle className="text-base font-semibold">新增班课</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-[minmax(420px,1fr)_360px] gap-0">
          {/* ── Left: form ──────────────────────────────────── */}
          <div className="px-7 py-5 space-y-5 border-r">

            {/* Year + Term */}
            <div className="flex items-start gap-4">
              <Field label="年份" required>
                <Input
                  type="number"
                  min={2024}
                  max={2030}
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  className="w-24 h-8 text-sm shrink-0"
                />
              </Field>
              <Field label="季度" required>
                <div className="flex gap-2 flex-wrap">
                  {TERM_LIST.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setTerm(t.value)}
                      className={cn(
                        "px-3 py-1 rounded-full text-xs border font-medium transition-all whitespace-nowrap",
                        term === t.value
                          ? cn("text-white border-transparent", t.color)
                          : "text-gray-600 border-gray-200 hover:border-gray-400 bg-white"
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </Field>
            </div>

            {/* 课程类型 */}
            <Field label="课程类型" required>
              <div className="flex gap-2 flex-wrap">
                {(["长期班", "短期班"] as const).map((ct) => (
                  <button
                    key={ct}
                    type="button"
                    onClick={() => setCourseType(ct)}
                    className={cn(
                      "px-3 py-1 rounded-full text-xs border font-medium transition-all whitespace-nowrap",
                      courseType === ct
                        ? "bg-gray-800 text-white border-transparent"
                        : "text-gray-600 border-gray-200 hover:border-gray-400 bg-white"
                    )}
                  >
                    {ct}
                  </button>
                ))}
              </div>
            </Field>

            {/* 课程主题 */}
            <Field label="课程主题" required>
              <Input
                placeholder="例：2026暑假 数学长期班"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="h-8 text-sm"
              />
            </Field>

            {/* 年级 + 老师 */}
            <div className="grid grid-cols-2 gap-4">
              <Field label="年级" required>
                <Select value={grade} onValueChange={setGrade}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="选择年级" />
                  </SelectTrigger>
                  <SelectContent>
                    {fieldOptions.grades.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="老师" required>
                <Select value={teacher} onValueChange={setTeacher}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="选择老师" />
                  </SelectTrigger>
                  <SelectContent>
                    {fieldOptions.teachers.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            {/* 教室 + 时段 */}
            <div className="grid grid-cols-2 gap-4">
              <Field label="教室" required>
                <Select value={classroom} onValueChange={setClassroom}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="选择教室" />
                  </SelectTrigger>
                  <SelectContent>
                    {fieldOptions.classrooms.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="时段">
                <Select value={timeSlot} onValueChange={setTimeSlot}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="选择时段" />
                  </SelectTrigger>
                  <SelectContent>
                    {fieldOptions.timeSlots.map((s) => (
                      <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            {/* 备注 */}
            <Field label="灵活时间 / 备注">
              <Input
                placeholder="选填"
                value={flexTime}
                onChange={(e) => setFlexTime(e.target.value)}
                className="h-8 text-sm"
              />
            </Field>

            {/* 同期新增 */}
            <div className="pt-1 border-t">
              <button
                type="button"
                onClick={handleConcurrentAdd}
                disabled={isPending || !selected.length}
                className={cn(
                  "w-full flex items-center justify-center gap-1.5 rounded-md border border-dashed py-2 text-xs font-medium transition-colors",
                  selected.length
                    ? "border-gray-300 text-gray-500 hover:border-gray-500 hover:text-gray-700 hover:bg-gray-50"
                    : "border-gray-200 text-gray-300 cursor-not-allowed"
                )}
              >
                <Plus className="h-3.5 w-3.5" />
                同期新增
                <span className="text-gray-400 font-normal">（保留日期，新增一个同期长期班）</span>
              </button>
            </div>
          </div>

          {/* ── Right: calendar ─────────────────────────────── */}
          <div className="px-6 py-5 space-y-4">
            <p className="text-xs font-medium text-gray-500">
              选择上课日期
              <span className="ml-1 text-gray-400">（点击或拖选）</span>
            </p>

            <MonthCalendar
              viewYear={viewYear}
              viewMonth={viewMonth}
              selected={selected}
              termMonths={termDef.months}
              onToggle={toggleDate}
              onBatchToggle={handleBatchToggle}
              onPrev={prevMonth}
              onNext={nextMonth}
              expected={termDef.expectedCount}
              termColor={termListItem.color}
            />

            {/* ── Batch date generator ─────────────────────── */}
            <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-2.5 space-y-2">
              <p className="text-[11px] font-medium text-gray-500 tracking-wide">批量生成</p>

              {/* Row 1: start date */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 shrink-0">起始</span>
                <input
                  type="date"
                  value={genStart}
                  onChange={(e) => setGenStart(e.target.value)}
                  className="h-6 rounded border border-gray-200 bg-white px-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-gray-300 flex-1 min-w-0"
                />
              </div>

              {/* Row 2: weekday toggles */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs text-gray-400 shrink-0">每周</span>
                {WEEKDAY_OPTIONS.map((wd) => (
                  <button
                    key={wd.value}
                    type="button"
                    onClick={() => toggleWeekday(wd.value)}
                    className={cn(
                      "h-6 w-6 rounded text-xs font-medium border transition-colors",
                      genWeekdays.includes(wd.value)
                        ? "bg-gray-800 text-white border-gray-800"
                        : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
                    )}
                  >
                    {wd.label}
                  </button>
                ))}
              </div>

              {/* Row 3: count + generate button */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 shrink-0">共</span>
                <input
                  type="number"
                  min={1}
                  max={52}
                  value={genCount}
                  onChange={(e) => setGenCount(e.target.value === "" ? "" : Number(e.target.value))}
                  className="h-6 w-12 rounded border border-gray-200 bg-white px-1.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-gray-300"
                />
                <span className="text-xs text-gray-400">节</span>
                <button
                  type="button"
                  onClick={handleGenerate}
                  className="ml-auto px-2.5 py-1 rounded bg-gray-800 text-white text-xs font-medium hover:bg-gray-700 transition-colors"
                >
                  生成
                </button>
              </div>
            </div>

            {/* Selected date chips */}
            {sortedSelected.length > 0 && (
              <div className="border-t pt-2">
                <p className="text-[11px] text-gray-400 mb-1.5">已选日期</p>
                <div className="flex flex-col gap-1 max-h-36 overflow-y-auto">
                  {sortedSelected.map((iso) => (
                    <div
                      key={iso}
                      className="flex items-center justify-between rounded-md bg-gray-50 px-2 py-1 text-xs text-gray-700"
                    >
                      <span>{formatChineseDate(iso)}</span>
                      <button
                        onClick={() => toggleDate(iso)}
                        className="text-gray-400 hover:text-gray-600 transition-colors ml-2"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 border-t px-7 py-4">
          <p className="text-xs text-gray-400">
            {selected.length > 0
              ? `共 ${selected.length} 节课将写入排课台账并同步到看板`
              : "请在右侧日历选择上课日期"}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleClose} disabled={isPending}>
              取消
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelected([])}
              disabled={isPending || !selected.length}
            >
              清除
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={isPending || !selected.length}
              className="gap-1.5 min-w-[100px]"
            >
              {isPending
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />导入中…</>
                : <><Plus className="h-3.5 w-3.5" />导入 {selected.length} 节</>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

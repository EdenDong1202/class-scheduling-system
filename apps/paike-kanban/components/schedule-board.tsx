"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addDays, format, parseISO, isSameDay, startOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight, CalendarDays, Loader2, Clock, Calendar as CalendarIcon, SlidersHorizontal, X, Search, CalendarPlus, User, Users, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from "@/components/ui/drawer";
import { Calendar } from "@/components/ui/calendar";
import type { ScheduleRecord, SelectOptions, EventRecord } from "@/app/actions";
import CourseDialog from "@/components/course-dialog";
import EventDialog from "@/components/event-dialog";
import PersonalEventDialog from "@/components/personal-event-dialog";
import { TYPE_STYLE, FALLBACK_STYLE, EVENT_STYLE } from "@/lib/schedule-constants";
import AppSwitcher from "@/components/app-switcher";
import OnboardingTour, { type TourStep } from "@/components/onboarding-tour";

/* ─── Constants ──────────────────────────────────────────── */

const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

// Vertical timeline: 08:00 → 20:30
const DAY_START_MIN = 8 * 60;
const DAY_END_MIN   = 20 * 60 + 30;
const DAY_DURATION  = DAY_END_MIN - DAY_START_MIN; // 750 min

// Pixel height of the timeline cell
const PADDING_V  = 14;                          // top & bottom gap so labels don't clip
const CELL_H     = 320;                         // total row height (px)
const TIMELINE_H = CELL_H - PADDING_V * 2;     // drawable height (292 px)
const SCALE      = TIMELINE_H / DAY_DURATION;  // ≈ 0.39 px/min

// Hour ticks shown on the vertical axis — every 2 hours
const HOUR_TICKS = [8, 10, 12, 14, 16, 18, 20];

// Non-overlapping standard periods for click-to-snap (S-periods excluded to avoid ambiguity)
const PERIOD_SNAPS = [
  { label: "A段 08:00-10:00", start:  480, end:  600 },
  { label: "B段 10:20-12:20", start:  620, end:  740 },
  { label: "C段 13:10-15:10", start:  790, end:  910 },
  { label: "D段 15:30-17:30", start:  930, end: 1050 },
  { label: "E段 18:20-20:20", start: 1100, end: 1220 },
];

/* ─── Helpers ─────────────────────────────────────────────── */

function timeToMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

/** Pixel Y offset inside cell → snapped time-period label */
function yToPeriod(y: number): string {
  const clickedMin = Math.round((y - PADDING_V) / SCALE + DAY_START_MIN);
  // Prefer a period that contains the click
  const hit = PERIOD_SNAPS.find(p => clickedMin >= p.start && clickedMin <= p.end);
  if (hit) return hit.label;
  // Otherwise snap to nearest by midpoint distance
  let best = PERIOD_SNAPS[0];
  let bestDist = Infinity;
  for (const p of PERIOD_SNAPS) {
    const dist = Math.abs(clickedMin - (p.start + p.end) / 2);
    if (dist < bestDist) { bestDist = dist; best = p; }
  }
  return best.label;
}

function parsePeriod(p: string): { startMin: number; endMin: number } | null {
  const match = p.match(/(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/);
  if (!match) return null;
  return { startMin: timeToMin(match[1]), endMin: timeToMin(match[2]) };
}

/** 解析灵活时间字段（格式如 "8:20-10:20" 或 "全天"）；无效则返回 null */
function parseFlexTime(s: string | null | undefined): { startMin: number; endMin: number } | null {
  if (!s?.trim()) return null;
  if (s.trim() === "全天") return { startMin: DAY_START_MIN, endMin: DAY_END_MIN };
  return parsePeriod(s);
}

/** Minutes from midnight → pixel offset from top of cell (includes top padding) */
function minToY(min: number): number {
  return PADDING_V + (min - DAY_START_MIN) * SCALE;
}

/** Returns current time in minutes from midnight (client-only). */
function nowMinutes(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

/* ─── Unified lane assignment (courses + events) ──────────── */

type UnifiedLanedBlock =
  | { kind: "course"; record: ScheduleRecord; startMin: number; endMin: number; lane: number; totalLanes: number }
  | { kind: "event";  event: EventRecord;     startMin: number; endMin: number; lane: number; totalLanes: number };

function assignUnifiedLanes(
  records: ScheduleRecord[],
  events: EventRecord[],
): { blocks: UnifiedLanedBlock[]; noTimeCourses: ScheduleRecord[] } {
  type RawItem =
    | { kind: "course"; record: ScheduleRecord; startMin: number; endMin: number }
    | { kind: "event";  event: EventRecord;     startMin: number; endMin: number };

  const timed: RawItem[] = [];
  const noTimeCourses: ScheduleRecord[] = [];

  for (const r of records) {
    // 灵活时间优先
    const flexP = parseFlexTime(r.flexTime);
    if (flexP) { timed.push({ kind: "course", record: r, ...flexP }); continue; }
    if (!r.timePeriod) { noTimeCourses.push(r); continue; }
    const p = parsePeriod(r.timePeriod);
    if (!p) { noTimeCourses.push(r); continue; }
    timed.push({ kind: "course", record: r, ...p });
  }

  for (const ev of events) {
    if (!ev.timePeriod) continue;
    const p = parsePeriod(ev.timePeriod);
    if (!p) continue;
    timed.push({ kind: "event", event: ev, ...p });
  }

  // Sort by start time for deterministic assignment
  timed.sort((a, b) => a.startMin - b.startMin);

  // Sweep-line lane assignment
  const laneEnds: number[] = [];
  const result: (RawItem & { lane: number; totalLanes: number })[] = [];

  for (const item of timed) {
    let lane = 0;
    while (laneEnds[lane] !== undefined && laneEnds[lane] > item.startMin) lane++;
    laneEnds[lane] = item.endMin;
    result.push({ ...item, lane, totalLanes: 0 });
  }

  // Compute totalLanes using connected-components so that all blocks in the same
  // overlap group share the same lane count — prevents visual card crossing.
  // (Per-block count gives different widths when partial overlaps chain together.)
  const n = result.length;
  const parent = Array.from({ length: n }, (_, i) => i);
  function find(x: number): number {
    if (parent[x] !== x) parent[x] = find(parent[x]);
    return parent[x];
  }
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (result[i].startMin < result[j].endMin && result[j].startMin < result[i].endMin) {
        const ri = find(i), rj = find(j);
        if (ri !== rj) parent[ri] = rj;
      }
    }
  }
  // For each component find the max lane used
  const compMax = new Map<number, number>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    compMax.set(root, Math.max(compMax.get(root) ?? 0, result[i].lane));
  }
  // All blocks in the same component get the same totalLanes
  for (let i = 0; i < n; i++) {
    result[i].totalLanes = (compMax.get(find(i)) ?? 0) + 1;
  }

  return { blocks: result as UnifiedLanedBlock[], noTimeCourses };
}

/* ─── ClassroomCell ───────────────────────────────────────── */

function ClassroomCell({
  records,
  events,
  isToday,
  showNow,
  nowY,
  date,
  classroom,
  onEditRecord,
  onCreateRecord,
  onEditEvent,
  demoRecordId,
}: {
  records: ScheduleRecord[];
  events: EventRecord[];
  isToday: boolean;
  showNow: boolean;
  nowY: number;
  date: string;
  classroom: string;
  onEditRecord: (r: ScheduleRecord) => void;
  onCreateRecord: (date: string, classroom: string, timePeriod: string) => void;
  onEditEvent: (ev: EventRecord) => void;
  demoRecordId?: string | null;
}) {
  const { blocks, noTimeCourses } = assignUnifiedLanes(records, events);

  const handleBgClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    onCreateRecord(date, classroom, yToPeriod(y));
  };

  return (
    <div
      className={[
        "relative border-r border-slate-200 select-none cursor-pointer",
        isToday ? "bg-blue-50/30" : "bg-white",
      ].join(" ")}
      style={{ height: CELL_H, minWidth: 160 }}
      onClick={handleBgClick}
    >
      {/* Hour grid lines */}
      {HOUR_TICKS.map(h => (
        <div
          key={h}
          className="absolute left-0 right-0 border-t border-slate-100"
          style={{ top: minToY(h * 60) }}
        />
      ))}

      {/* Current-time indicator — below course cards (no z-index; blocks rendered after override) */}
      {showNow && (
        <div
          className="absolute left-0 right-0 border-t-2 border-dashed border-red-400"
          style={{ top: nowY }}
        />
      )}

      {/* No-time badges — stacked at very top */}
      {noTimeCourses.length > 0 && (
        <div className="absolute top-1 left-1 right-1 flex flex-col gap-0.5 z-20">
          {noTimeCourses.map(r => {
            const s = TYPE_STYLE[r.courseType ?? ""] ?? FALLBACK_STYLE;
            return (
              <TooltipProvider key={r.id} delayDuration={80}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className="rounded px-1 py-0.5 text-[10px] font-medium border truncate cursor-pointer hover:brightness-95 transition-all"
                      style={{ backgroundColor: s.badgeBg, borderColor: s.border, color: s.text }}
                      onClick={(e) => { e.stopPropagation(); onEditRecord(r); }}
                    >
                      {r.teacher || r.student || "课程"}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="text-xs space-y-1 max-w-[200px] bg-white text-gray-800 border border-slate-200 shadow-md">
                    <div className="text-slate-400 text-[10px]">（未设时段）</div>
                    <BlockDetail record={r} />
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </div>
      )}

      {/* Unified timed blocks: courses and events share the lane grid */}
      {blocks.map((block) => {
        const top   = minToY(block.startMin);
        const h     = Math.max((block.endMin - block.startMin) * SCALE - 2, 10);
        const laneW = 100 / block.totalLanes;

        if (block.kind === "event") {
          const ev = block.event;
          return (
            <div
              key={ev.id}
              className="absolute flex flex-col overflow-hidden rounded border cursor-pointer hover:brightness-95 transition-all"
              style={{
                top,
                height: h,
                left:  `${block.lane * laneW}%`,
                width: `${laneW}%`,
                backgroundColor: EVENT_STYLE.bg,
                borderColor:     EVENT_STYLE.border,
                borderLeftColor: EVENT_STYLE.accent,
                borderLeftWidth: 3,
              }}
              onClick={(e) => { e.stopPropagation(); onEditEvent(ev); }}
            >
              <div
                className="flex items-center gap-1 px-1.5 py-0.5 shrink-0 min-w-0"
                style={{ backgroundColor: EVENT_STYLE.badgeBg }}
              >
                <span className="text-[10px] font-semibold leading-none shrink-0" style={{ color: EVENT_STYLE.text }}>
                  全体事项
                </span>
              </div>
              {ev.content && (
                <div className="px-1.5 pt-0.5 min-w-0 overflow-hidden">
                  <span className="text-[11px] font-medium leading-tight line-clamp-3 block" style={{ color: EVENT_STYLE.accent }}>
                    {ev.content}
                  </span>
                </div>
              )}
            </div>
          );
        }

        // kind === "course"
        const record  = block.record;
        const s       = TYPE_STYLE[record.courseType ?? ""] ?? FALLBACK_STYLE;
        const isShort = (block.endMin - block.startMin) < 90; // < 1.5 h → single-line

        return (
          <TooltipProvider key={record.id} delayDuration={80}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className={[
                    "absolute overflow-hidden rounded border cursor-pointer hover:brightness-95 transition-all",
                    isShort ? "flex items-center" : "flex flex-col",
                  ].join(" ")}
                  style={{
                    top,
                    height: h,
                    left:  `${block.lane * laneW}%`,
                    width: `${laneW}%`,
                    // 短课直接用 badgeBg 填满，与长课的色带宽度视觉一致
                    backgroundColor: isShort ? s.badgeBg : s.bg,
                    borderColor:     s.border,
                    borderLeftColor: s.accent,
                    borderLeftWidth: 3,
                  }}
                  onClick={(e) => { e.stopPropagation(); onEditRecord(record); }}
                  data-tour={record.id === demoRecordId ? "demo-card" : undefined}
                >
                  {record.id === demoRecordId && (
                    <span className="absolute top-0 right-0 z-10 bg-blue-500 text-white text-[9px] font-semibold px-1 py-0.5 leading-none rounded-bl">演示</span>
                  )}
                  {isShort ? (
                    /* ── 短课（< 1.5 h）：单行，整卡用 badgeBg 填色，与长课色带一致 ── */
                    <div className="flex items-center gap-1 px-1.5 min-w-0 w-full overflow-hidden">
                      {record.courseType && (
                        <span
                          className="text-[10px] font-semibold leading-none shrink-0"
                          style={{ color: s.text }}
                        >
                          {record.courseType}
                        </span>
                      )}
                      {record.teacher && (
                        <span className="text-xs font-bold text-gray-900 leading-none shrink-0">
                          {record.teacher}
                        </span>
                      )}
                      {record.student && (
                        <span className="text-[11px] text-gray-500 leading-none truncate">
                          {record.student}
                        </span>
                      )}
                    </div>
                  ) : (
                    /* ── 正常课（≥ 1.5 h）：原双行布局 ── */
                    <>
                      {/* Row 1: [课程类型] 老师姓名 */}
                      <div
                        className="flex items-center gap-1 px-1.5 py-0.5 shrink-0 min-w-0"
                        style={{ backgroundColor: s.badgeBg }}
                      >
                        {record.courseType && (
                          <span className="text-[10px] font-semibold leading-none shrink-0" style={{ color: s.text }}>
                            {record.courseType}
                          </span>
                        )}
                        {record.teacher && (
                          <span className="text-xs font-bold text-gray-900 truncate leading-none">
                            {record.teacher}
                          </span>
                        )}
                      </div>
                      {/* Row 2: course theme · student name */}
                      {(record.courseTheme || record.student) && (
                        <div className="px-1.5 pt-0.5 min-w-0 overflow-hidden">
                          <span className="text-[12px] text-gray-600 truncate leading-tight block">
                            {[record.courseTheme, record.student].filter(Boolean).join(" · ")}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs space-y-1 max-w-[220px] bg-white text-gray-800 border border-slate-200 shadow-md">
                <BlockDetail record={record} />
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      })}
    </div>
  );
}

/* ─── BlockDetail (tooltip body) ─────────────────────────── */

function BlockDetail({ record }: { record: ScheduleRecord }) {
  const s = TYPE_STYLE[record.courseType ?? ""] ?? FALLBACK_STYLE;
  const title = [record.courseTheme, record.student].filter(Boolean).join(" · ");
  const shownPeriod = parseFlexTime(record.flexTime)
    ? record.flexTime
    : record.timePeriod;
  return (
    <>
      {/* 标题：课程主题 · 学生，自动换行 */}
      {title && (
        <div className="text-[13px] font-semibold leading-snug break-words whitespace-normal">
          {title}
        </div>
      )}
      {record.courseType && (
        <span
          className="inline-block text-[10px] rounded px-1.5 py-0.5 font-medium"
          style={{ backgroundColor: s.bg, color: s.text }}
        >
          {record.courseType}
        </span>
      )}
      {record.teacher && <div>👨‍🏫 {record.teacher}</div>}
      {record.grade   && <div className="text-muted-foreground">{record.grade}</div>}
      {shownPeriod && (
        <div className="flex items-center gap-1 text-orange-500">
          <Clock className="h-3 w-3 shrink-0" />
          {shownPeriod}
        </div>
      )}
    </>
  );
}

/* ─── CalendarJump ─────────────────────────────────────────── */

function CalendarJump({
  displayStart,
  onJump,
  align = "end",
}: {
  displayStart: Date;
  onJump: (d: Date) => void;
  align?: "start" | "center" | "end";
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="h-7 w-7" aria-label="日历跳转">
          <CalendarIcon className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align={align}>
        <Calendar
          mode="single"
          selected={displayStart}
          defaultMonth={displayStart}
          onSelect={(d) => {
            if (d) { onJump(d); setOpen(false); }
          }}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}

/* ─── FilterDrawer ────────────────────────────────────────── */

interface Filters {
  classrooms: string[];
  teachers:   string[];
  courseTypes: string[];
}

const EMPTY_FILTERS: Filters = { classrooms: [], teachers: [], courseTypes: [] };

function toggle(arr: string[], val: string): string[] {
  return arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val];
}

interface FilterOptions {
  classrooms:  string[];
  teachers:    string[];
  courseTypes: string[];
}

function FilterDrawer({
  open,
  onClose,
  filters,
  onChange,
  options,
}: {
  open: boolean;
  onClose: () => void;
  filters: Filters;
  onChange: (f: Filters) => void;
  options: FilterOptions;
}) {
  const activeCount =
    filters.classrooms.length + filters.teachers.length + filters.courseTypes.length;

  function ChipGroup({
    label,
    options,
    selected,
    onToggle,
    colorFn,
  }: {
    label: string;
    options: string[];
    selected: string[];
    onToggle: (v: string) => void;
    colorFn?: (v: string) => React.CSSProperties;
  }) {
    return (
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <div className="flex flex-wrap gap-1.5">
          {options.map(o => {
            const active = selected.includes(o);
            const extra = colorFn ? colorFn(o) : {};
            return (
              <button
                key={o}
                onClick={() => onToggle(o)}
                className={[
                  "text-xs px-2.5 py-1 rounded-full border transition-all",
                  active
                    ? "border-blue-500 bg-blue-50 text-blue-700 font-medium"
                    : "border-slate-200 bg-white text-slate-600",
                ].join(" ")}
                style={active ? {} : extra}
              >
                {o}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <Drawer open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DrawerContent className="max-h-[85dvh]">
        <DrawerHeader className="flex items-center justify-between pb-2">
          <DrawerTitle className="text-base">筛选</DrawerTitle>
          <div className="flex items-center gap-2">
            {activeCount > 0 && (
              <button
                className="text-xs text-blue-600 underline-offset-2 hover:underline"
                onClick={() => onChange(EMPTY_FILTERS)}
              >
                重置
              </button>
            )}
            <DrawerClose asChild>
              <button className="rounded-full p-1 hover:bg-slate-100">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </DrawerClose>
          </div>
        </DrawerHeader>

        <div className="px-4 pb-8 space-y-5 overflow-y-auto">
          <ChipGroup
            label="教室"
            options={options.classrooms}
            selected={filters.classrooms}
            onToggle={v => onChange({ ...filters, classrooms: toggle(filters.classrooms, v) })}
          />
          <ChipGroup
            label="老师"
            options={options.teachers}
            selected={filters.teachers}
            onToggle={v => onChange({ ...filters, teachers: toggle(filters.teachers, v) })}
          />
          <ChipGroup
            label="课程类型"
            options={options.courseTypes}
            selected={filters.courseTypes}
            onToggle={v => onChange({ ...filters, courseTypes: toggle(filters.courseTypes, v) })}
            colorFn={v => {
              const s = TYPE_STYLE[v];
              return s ? { borderColor: s.border, backgroundColor: s.bg, color: s.text } : {};
            }}
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
}

/* ─── MobileDetailCard ───────────────────────────────────── */

/**
 * Tooltip-style popup that appears near the pressed card.
 * Has pointer-events:none so touches pass through to the card below.
 * Disappears when the parent clears it (on touchEnd).
 */
function MobileDetailCard({
  record,
  anchor,
}: {
  record: ScheduleRecord;
  anchor: DOMRect;
}) {
  const s = TYPE_STYLE[record.courseType ?? ""] ?? FALLBACK_STYLE;
  const shownPeriod = parseFlexTime(record.flexTime) ? record.flexTime : record.timePeriod;

  const POPUP_W  = 196;
  const EST_H    = 160;
  const GAP      = 8;   // gap between card and popup
  const EDGE     = 8;   // min distance from screen edge
  const vpW = typeof window !== "undefined" ? window.innerWidth  : 375;
  const vpH = typeof window !== "undefined" ? window.innerHeight : 812;

  // Horizontal: prefer right of card, fallback left, clamp
  let left: number;
  if (anchor.right + GAP + POPUP_W <= vpW - EDGE) {
    left = anchor.right + GAP;
  } else if (anchor.left - GAP - POPUP_W >= EDGE) {
    left = anchor.left - GAP - POPUP_W;
  } else {
    left = Math.max(EDGE, Math.min(vpW - POPUP_W - EDGE, anchor.left));
  }

  // Vertical: align with card top, clamp so popup stays in viewport
  const top = Math.max(EDGE, Math.min(vpH - EST_H - EDGE, anchor.top));

  return (
    <div
      className="fixed z-50 rounded-xl bg-white border border-slate-200 shadow-xl p-3 pointer-events-none"
      style={{ top, left, width: POPUP_W }}
    >
      {/* Title: courseTheme · student */}
      {(record.courseTheme || record.student) && (
        <div className="text-[13px] font-semibold text-gray-900 leading-snug mb-1.5">
          {[record.courseTheme, record.student].filter(Boolean).join(" · ")}
        </div>
      )}

      {/* Course type badge */}
      {record.courseType && (
        <span
          className="inline-block text-[10px] rounded px-1.5 py-0.5 font-medium mb-1.5"
          style={{ backgroundColor: s.bg, color: s.text }}
        >
          {record.courseType}
        </span>
      )}

      <div className="space-y-1 text-[12px]">
        {record.teacher && (
          <div className="flex items-center gap-1.5 text-gray-700">
            <User className="h-3 w-3 shrink-0" />
            {record.teacher}
          </div>
        )}
        {record.grade && (
          <div className="text-gray-500">{record.grade}</div>
        )}
        {shownPeriod && (
          <div className="flex items-center gap-1.5 text-orange-500">
            <Clock className="h-3 w-3 shrink-0" />
            {shownPeriod}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── MobileTimelineCard ─────────────────────────────────── */

function MobileTimelineCard({
  record, style: pos, isShort, fRoom, fMain, fSub,
  onEdit, onLongPress, onLongPressEnd,
}: {
  record: ScheduleRecord;
  style: React.CSSProperties;
  isShort: boolean;
  fRoom: number; fMain: number; fSub: number;
  onEdit: () => void;
  onLongPress: (anchor: DOMRect) => void;
  onLongPressEnd: () => void;
}) {
  const s        = TYPE_STYLE[record.courseType ?? ""] ?? FALLBACK_STYLE;
  const height   = typeof pos.height === "number" ? pos.height : 26;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firedRef = useRef(false);
  const cardRef  = useRef<HTMLButtonElement>(null);

  const onTouchStart = () => {
    firedRef.current = false;
    timerRef.current = setTimeout(() => {
      firedRef.current = true;
      if (cardRef.current) onLongPress(cardRef.current.getBoundingClientRect());
    }, 500);
  };

  const onTouchMove = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  };

  const onTouchEnd = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    // Hide the popup as soon as the finger lifts
    if (firedRef.current) { onLongPressEnd(); }
  };

  // On touch: fired → long-press already handled, skip click.
  // On mouse (desktop): fired is always false, so click works normally.
  const onClick = () => {
    if (firedRef.current) { firedRef.current = false; return; }
    onEdit();
  };

  return (
    <button
      ref={cardRef}
      className="absolute rounded border text-left overflow-hidden transition-all select-none"
      style={{ ...pos, backgroundColor: isShort ? s.badgeBg : s.bg, borderColor: s.border, borderLeftColor: s.accent }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onClick={onClick}
      onContextMenu={e => e.preventDefault()}
    >
      {isShort ? (
        <div className="font-medium leading-tight truncate" style={{ fontSize: fMain, color: s.text }}>
          {[record.classroom, record.teacher, record.student].filter(Boolean).join(" · ")}
        </div>
      ) : (
        <>
          {record.classroom && (
            <div className="font-bold leading-tight truncate" style={{ fontSize: fRoom, color: s.accent }}>
              {record.classroom}
            </div>
          )}
          {record.teacher && (
            <div className="font-bold leading-tight truncate" style={{ fontSize: fMain, color: "#111827" }}>
              {record.teacher}
            </div>
          )}
          {record.student && height > 65 && (
            <div className="leading-tight truncate" style={{ fontSize: fSub, color: "#6b7280" }}>
              {record.student}
            </div>
          )}
          {record.courseType && height > 85 && (
            <div className="leading-tight truncate" style={{ fontSize: fSub, color: s.text }}>
              {record.courseType}
            </div>
          )}
        </>
      )}
    </button>
  );
}

/* ─── MobileTimeline ─────────────────────────────────────── */

const MOBILE_SCALE  = 1.0;   // px / min  (750 min → 750 px)
const MOBILE_HOUR_W = 44;    // px — hour-label gutter width

function MobileTimeline({
  records,
  events,
  nowMin,
  showNow,
  onEditRecord,
  onEditEvent,
}: {
  records:      ScheduleRecord[];
  events:       EventRecord[];
  nowMin:       number;
  showNow:      boolean;
  onEditRecord: (r: ScheduleRecord) => void;
  onEditEvent:  (ev: EventRecord)   => void;
}) {
  // ── Responsive font base: scales with container width ─────
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState(375);
  const [detailRecord, setDetailRecord] = useState<{ record: ScheduleRecord; anchor: DOMRect } | null>(null);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setContainerW(e.contentRect.width));
    ro.observe(el);
    setContainerW(el.getBoundingClientRect().width || 375);
    return () => ro.disconnect();
  }, []);
  // base font sizes at 375 px; clamped to [0.82, 1.15]
  const wScale = Math.max(0.82, Math.min(containerW / 375, 1.15));
  const BASE_MAIN = Math.round(11 * wScale); // classroom & teacher
  const BASE_SUB  = Math.round(10 * wScale); // student / short-card
  const BASE_HOUR = Math.round(10 * wScale); // hour labels
  const BASE_EVT  = Math.round(11 * wScale); // event label / content
  // ─────────────────────────────────────────────────────────

  // Add 32px bottom buffer so the last card (20:20) never gets clipped
  const TOTAL_H = DAY_DURATION * MOBILE_SCALE + 32;

  const timedEvents   = events.filter(ev => ev.timePeriod && parsePeriod(ev.timePeriod));
  const untimedEvents = events.filter(ev => !ev.timePeriod || !parsePeriod(ev.timePeriod));

  const { blocks: laned } = assignUnifiedLanes(records, timedEvents);
  const nowY = (nowMin - DAY_START_MIN) * MOBILE_SCALE;

  const hourMarks: number[] = [];
  for (let h = 8; h <= 20; h++) hourMarks.push(h);

  return (
    <div ref={containerRef}>
      {/* Full-day event banners */}
      {untimedEvents.map(ev => (
        <button
          key={ev.id}
          className="w-full text-left rounded-lg border overflow-hidden flex mb-2 active:brightness-95 transition-all"
          style={{ borderColor: EVENT_STYLE.border, backgroundColor: EVENT_STYLE.bg }}
          onClick={() => onEditEvent(ev)}
        >
          <div className="w-1 shrink-0" style={{ backgroundColor: EVENT_STYLE.accent }} />
          <div className="flex-1 px-3 py-2 min-w-0">
            <span className="font-medium rounded px-1.5 py-0.5 leading-none"
              style={{ fontSize: BASE_EVT, backgroundColor: EVENT_STYLE.badgeBg, color: EVENT_STYLE.text }}>
              全体事项
            </span>
            {ev.content && (
              <div className="font-semibold mt-1 truncate" style={{ fontSize: BASE_EVT, color: EVENT_STYLE.accent }}>
                {ev.content}
              </div>
            )}
          </div>
        </button>
      ))}

      {/* Timeline */}
      <div className="flex" style={{ height: TOTAL_H }}>
        {/* Hour labels */}
        <div className="relative shrink-0" style={{ width: MOBILE_HOUR_W }}>
          {hourMarks.map(h => (
            <div key={h}
              className="absolute right-1.5 text-gray-400 tabular-nums leading-none"
              style={{ fontSize: BASE_HOUR, top: (h * 60 - DAY_START_MIN) * MOBILE_SCALE - 6 }}>
              {String(h).padStart(2, "0")}:00
            </div>
          ))}
        </div>

        {/* Grid + cards — no overflow-hidden so last cards aren't clipped at bottom */}
        <div className="relative flex-1 border-l border-slate-200">
          {hourMarks.map(h => (
            <div key={h}
              className={`absolute left-0 right-0 border-t ${h % 2 === 0 ? "border-slate-200" : "border-slate-100"}`}
              style={{ top: (h * 60 - DAY_START_MIN) * MOBILE_SCALE }} />
          ))}

          {showNow && nowY >= 0 && nowY <= TOTAL_H && (
            <div className="absolute left-0 right-0 border-t-2 border-dashed border-red-400 pointer-events-none"
              style={{ top: nowY }} />
          )}

          {laned.map(block => {
            const top     = (block.startMin - DAY_START_MIN) * MOBILE_SCALE;
            const height  = Math.max((block.endMin - block.startMin) * MOBILE_SCALE, 26);
            const laneW   = 100 / block.totalLanes;
            const isShort = (block.endMin - block.startMin) < 90;

            // Per-card density scale: ≤6 concurrent → no reduction; >6 → shrink gradually
            const dScale = block.totalLanes <= 6 ? 1.0 : Math.max(0.65, 1 - (block.totalLanes - 6) * 0.08);
            const fRoom = Math.round(BASE_MAIN * dScale * 1.2); // classroom: ~2px larger
            const fMain = Math.round(BASE_MAIN * dScale);
            const fSub  = Math.round(BASE_SUB  * dScale);

            const pos: React.CSSProperties = {
              top, height,
              left:  `calc(${block.lane * laneW}% + 2px)`,
              width: `calc(${laneW}% - 4px)`,
              borderLeftWidth: 3,
              padding: "3px 5px",
            };

            if (block.kind === "event") {
              const ev = block.event;
              return (
                <button key={ev.id}
                  className="absolute rounded border text-left overflow-hidden active:brightness-95 transition-all"
                  style={{ ...pos, backgroundColor: EVENT_STYLE.bg, borderColor: EVENT_STYLE.border, borderLeftColor: EVENT_STYLE.accent }}
                  onClick={() => onEditEvent(ev)}>
                  <div className="font-semibold leading-tight truncate"
                    style={{ fontSize: fMain, color: EVENT_STYLE.text }}>全体事项</div>
                  {ev.content && height > 36 && (
                    <div className="leading-tight truncate"
                      style={{ fontSize: fSub, color: EVENT_STYLE.accent }}>{ev.content}</div>
                  )}
                </button>
              );
            }

            const r = block.record;
            return (
              <MobileTimelineCard
                key={r.id}
                record={r}
                style={pos}
                isShort={isShort}
                fRoom={fRoom}
                fMain={fMain}
                fSub={fSub}
                onEdit={() => onEditRecord(r)}
                onLongPress={(anchor) => setDetailRecord({ record: r, anchor })}
                onLongPressEnd={() => setDetailRecord(null)}
              />
            );
          })}
        </div>
      </div>

      {/* Long-press detail popup — follows the card, disappears on finger release */}
      {detailRecord && (
        <MobileDetailCard
          record={detailRecord.record}
          anchor={detailRecord.anchor}
        />
      )}
    </div>
  );
}

/* ─── MobileView ──────────────────────────────────────────── */

function MobileView({
  dates,
  lookup,
  eventLookup,
  isPending,
  navigate,
  goToday,
  displayStart,
  selectedDayIdx,
  setSelectedDayIdx,
  onEditRecord,
  onCreateRecord,
  onEditEvent,
  onCreateEvent,
  onOpenPicker,
  onJump,
  filterOptions,
  today,
}: {
  dates: Date[];
  lookup: Map<string, Map<string, ScheduleRecord[]>>;
  eventLookup: Map<string, EventRecord[]>;
  isPending: boolean;
  navigate: (delta: number) => void;
  goToday: () => void;
  displayStart: Date;
  selectedDayIdx: number;
  setSelectedDayIdx: (i: number) => void;
  onEditRecord: (r: ScheduleRecord) => void;
  onCreateRecord: (date: string, classroom: string, timePeriod: string) => void;
  onEditEvent: (ev: EventRecord) => void;
  onCreateEvent: (date: string) => void;
  onOpenPicker: (date: string) => void;
  onJump: (d: Date) => void;
  filterOptions: FilterOptions;
  today: Date | null;
}) {
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

  const date       = dates[selectedDayIdx];
  const dateStr    = format(date, "yyyy-MM-dd");
  const byRoom     = lookup.get(dateStr) ?? new Map();
  const dayEvents  = eventLookup.get(dateStr) ?? [];

  const allDayRecords: ScheduleRecord[] = [];
  for (const recs of byRoom.values()) allDayRecords.push(...recs);

  const activeCount =
    filters.classrooms.length + filters.teachers.length + filters.courseTypes.length;

  const dayRecords = allDayRecords.filter(r => {
    if (filters.classrooms.length  && !filters.classrooms.includes(r.classroom))             return false;
    if (filters.teachers.length    && !filters.teachers.includes(r.teacher ?? ""))           return false;
    if (filters.courseTypes.length && !filters.courseTypes.includes(r.courseType ?? ""))     return false;
    return true;
  });

  const isSelectedToday = today !== null && isSameDay(date, today);
  const nowMin = today ? today.getHours() * 60 + today.getMinutes() : 0;

  return (
    <div className="flex flex-col h-dvh overflow-hidden bg-background">
      {/* Topbar */}
      <header className="shrink-0 border-b bg-white px-3 py-2 flex items-center gap-2">
        <AppSwitcher />
        <h1 className="text-sm font-semibold tracking-tight">校区排课</h1>
        <div className="flex items-center gap-1 ml-auto">
          <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={goToday}>
            本周
          </Button>
          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => navigate(-1)}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="text-xs text-muted-foreground tabular-nums flex items-center gap-1 min-w-[72px] justify-center">
            {isPending && <Loader2 className="h-3 w-3 animate-spin text-blue-300 shrink-0" />}
            {format(displayStart, "M/d")}–{format(addDays(displayStart, 6), "M/d")}
          </span>
          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => navigate(1)}>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
          <CalendarJump displayStart={displayStart} onJump={onJump} />
          {/* Filter button */}
          <div className="relative">
            <Button
              variant={activeCount > 0 ? "default" : "outline"}
              size="icon"
              className="h-7 w-7"
              onClick={() => setFilterOpen(true)}
              aria-label="筛选"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
            </Button>
            {activeCount > 0 && (
              <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-blue-500 text-[9px] text-white flex items-center justify-center leading-none font-bold pointer-events-none">
                {activeCount}
              </span>
            )}
          </div>
        </div>
      </header>

      <FilterDrawer
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        filters={filters}
        onChange={setFilters}
        options={filterOptions}
      />

      {/* Day tabs */}
      <div className="shrink-0 flex border-b bg-white">
        {dates.map((d, i) => {
          const isToday = today ? isSameDay(d, today) : false;
          const active  = i === selectedDayIdx;
          const cnt = [...(lookup.get(format(d, "yyyy-MM-dd"))?.values() ?? [])].reduce(
            (s, v) => s + v.length, 0,
          );
          return (
            <button
              key={i}
              className={[
                "flex-1 py-1.5 flex flex-col items-center gap-0.5 transition-colors border-b-2",
                active ? "border-blue-500" : "border-transparent",
              ].join(" ")}
              onClick={() => setSelectedDayIdx(i)}
            >
              <span className={`text-[10px] leading-none ${isToday ? "text-blue-500 font-semibold" : "text-muted-foreground"}`}>
                {WEEKDAYS[d.getDay()]}
              </span>
              <span className={`text-sm font-bold tabular-nums leading-none ${active ? "text-blue-600" : isToday ? "text-blue-400" : "text-foreground"}`}>
                {format(d, "d")}
              </span>
              <span className={`text-[9px] leading-none tabular-nums ${cnt > 0 ? "text-blue-400" : "text-transparent"}`}>
                {cnt > 0 ? String(cnt) : "0"}
              </span>
            </button>
          );
        })}
      </div>

      {/* Timeline scroll area */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-3 pt-2 pb-2">
          <MobileTimeline
            records={dayRecords}
            events={dayEvents}
            nowMin={nowMin}
            showNow={isSelectedToday}
            onEditRecord={onEditRecord}
            onEditEvent={onEditEvent}
          />
        </div>
        <div className="px-3 pt-4 pb-6 space-y-2">
          <Button
            variant="outline"
            className="w-full h-10 text-sm"
            onClick={() => onCreateRecord(dateStr, "", "")}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            添加课程
          </Button>
          <Button
            variant="outline"
            className="w-full h-10 text-sm"
            onClick={() => onOpenPicker(dateStr)}
          >
            <CalendarPlus className="h-4 w-4 mr-1.5" />
            新增事项
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ─── TimeAxis ────────────────────────────────────────────── */

function TimeAxis({ isToday, showNow, nowY }: { isToday: boolean; showNow: boolean; nowY: number }) {
  return (
    <td
      className={[
        "sticky left-[80px] z-10 border-r border-b border-slate-200 align-top p-0",
        isToday ? "bg-blue-50" : "bg-white",
      ].join(" ")}
      style={{ width: 40, minWidth: 40, height: CELL_H }}
    >
      <div className="relative" style={{ height: CELL_H }}>
        {/* Current-time marker */}
        {showNow && (
          <div
            className="absolute left-0 right-0 z-10 border-t-2 border-dashed border-red-400"
            style={{ top: nowY }}
          />
        )}
        {/* Hour labels + tick marks */}
        {HOUR_TICKS.map(h => {
          const y = minToY(h * 60);
          return (
            <div
              key={h}
              className="absolute left-0 right-0 flex items-center"
              style={{ top: y - 6 }}
            >
              <span className="w-full text-right pr-1.5 text-[9px] text-slate-400 leading-none tabular-nums">
                {h}:00
              </span>
            </div>
          );
        })}
      </div>
    </td>
  );
}

/* ─── ScheduleBoard ───────────────────────────────────────── */

interface Props {
  records: ScheduleRecord[];
  startDate: string;
  selectOptions: SelectOptions;
  events: EventRecord[];
}

export default function ScheduleBoard({ records, startDate, selectOptions, events }: Props) {
  const router = useRouter();
  const start  = parseISO(startDate);

  const [isPending, startTransition]  = useTransition();
  const [displayStart, setDisplayStart] = useState(start);
  const [localRecords, setLocalRecords] = useState(records);
  const [nowMin, setNowMin]           = useState<number | null>(null);
  // today is null on the server to avoid SSR/client timezone mismatch
  const [today, setToday]             = useState<Date | null>(null);
  const [editRecord, setEditRecord]   = useState<ScheduleRecord | null>(null);
  const [createData, setCreateData]   = useState<{ date: string; classroom: string; timePeriod: string } | null>(null);
  const [localEvents, setLocalEvents] = useState(events);
  const [editEvent, setEditEvent]     = useState<EventRecord | null>(null);
  const [createEventDate, setCreateEventDate] = useState<string | null>(null);
  // Event-type picker (个人事项 vs 全体事项)
  const [pickerDate, setPickerDate]           = useState<string | null>(null);
  // Personal event (个人事项) creation / editing
  const [createPersonalDate, setCreatePersonalDate] = useState<string | null>(null);
  const [editPersonalRecord, setEditPersonalRecord] = useState<ScheduleRecord | null>(null);
  // Start at 0; the useEffect below corrects this to today's index after hydration
  const [selectedDayIdx, setSelectedDayIdx] = useState(0);
  const todayRef  = useRef<HTMLTableRowElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Desktop filter state
  const [searchQuery,      setSearchQuery]      = useState("");
  const [filterClassroom,  setFilterClassroom]  = useState("");
  const [filterTeacher,    setFilterTeacher]    = useState("");

  // 新手引导
  const [tourStep, setTourStep] = useState<TourStep | null>(null);
  const [demoRecordId, setDemoRecordId] = useState<string | null>(null);
  const [mockCreate, setMockCreate] = useState(false);

  // Keep displayStart in sync after navigation settles
  useEffect(() => { setDisplayStart(parseISO(startDate)); }, [startDate]);

  // Sync local records: merge server data with any locally-added records not yet
  // reflected in the server response (avoids brief disappear after optimistic add).
  useEffect(() => {
    setLocalRecords(prev => {
      const serverIds = new Set(records.map(r => r.id));
      return [...records, ...prev.filter(r => !serverIds.has(r.id))];
    });
  }, [records]); // eslint-disable-line react-hooks/exhaustive-deps

  // Same merge strategy for events
  useEffect(() => {
    setLocalEvents(prev => {
      const serverIds = new Set(events.map(e => e.id));
      return [...events, ...prev.filter(e => !serverIds.has(e.id))];
    });
  }, [events]); // eslint-disable-line react-hooks/exhaustive-deps

  // 实时同步：订阅 SSE，服务端有数据变更时立即刷新；
  // 断连后 3 秒自动重连（网络波动 / 服务重启都能恢复）。
  useEffect(() => {
    let source: EventSource;
    let retryTimer: ReturnType<typeof setTimeout>;

    function connect() {
      source = new EventSource("/api/sync");
      source.onmessage = () => { router.refresh(); };
      source.onerror   = () => {
        source.close();
        retryTimer = setTimeout(connect, 3_000);
      };
    }

    connect();
    return () => { source?.close(); clearTimeout(retryTimer); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update current time every minute
  useEffect(() => {
    setNowMin(nowMinutes());
    const id = setInterval(() => setNowMin(nowMinutes()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Prefetch prev / next week so navigation feels instant
  useEffect(() => {
    router.prefetch(`?startDate=${format(addDays(start, -7), "yyyy-MM-dd")}`);
    router.prefetch(`?startDate=${format(addDays(start,  7), "yyyy-MM-dd")}`);
  }, [startDate]); // eslint-disable-line react-hooks/exhaustive-deps

  // 新手引导：首次进入（未 onboarded）或 ?tour=1 强制时启动；仅桌面自动启动
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const forced = params.get("tour") === "1";
    const onboarded = localStorage.getItem("schedule_board_onboarded");
    const isDesktop = window.matchMedia("(min-width: 768px)").matches;
    if (forced || (!onboarded && isDesktop)) setTourStep("welcome");
  }, []);

  // Scroll on week change:
  //   - current week  → put 17:00 of the previous day at the top (today visible)
  //   - other week    → scroll to top so Monday shows first
  // Must depend on `today` (not `startDate`): `todayRef` is only bound after
  // `setToday` triggers a re-render, by which time `startDate` effects already ran.
  useEffect(() => {
    const el        = todayRef.current;
    const container = scrollRef.current;
    if (!today || !container) return;

    if (!el) {
      // Today is not in this week — show from the top (Monday)
      container.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    // Today is in this week — put 17:00 of the previous day at the viewport top
    const elTop = el.getBoundingClientRect().top
                - container.getBoundingClientRect().top
                + container.scrollTop;
    const offset17h = PADDING_V + (17 * 60 - DAY_START_MIN) * SCALE;
    container.scrollTo({ top: Math.max(0, elTop - CELL_H + offset17h), behavior: "smooth" });
  }, [today]); // eslint-disable-line react-hooks/exhaustive-deps

  // Set today (client-only) and reset mobile day selection when week changes
  useEffect(() => {
    const now = new Date();
    setToday(now);
    const idx = Array.from({ length: 7 }, (_, i) => addDays(parseISO(startDate), i))
      .findIndex(d => isSameDay(d, now));
    setSelectedDayIdx(idx >= 0 ? idx : 0);
  }, [startDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const dates = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  // Build lookup: dateStr → classroom → records[]
  const lookup = new Map<string, Map<string, ScheduleRecord[]>>();
  for (const r of localRecords) {
    if (!lookup.has(r.date)) lookup.set(r.date, new Map());
    const byRoom = lookup.get(r.date)!;
    if (!byRoom.has(r.classroom)) byRoom.set(r.classroom, []);
    byRoom.get(r.classroom)!.push(r);
  }

  // Desktop: apply search / classroom / teacher filters
  const desktopFilteredRecords = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return localRecords.filter(r => {
      if (filterClassroom && r.classroom !== filterClassroom) return false;
      if (filterTeacher   && r.teacher   !== filterTeacher)   return false;
      if (q && ![r.teacher, r.student, r.classroom, r.courseTheme, r.courseType, r.grade]
                .some(v => v?.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [localRecords, searchQuery, filterClassroom, filterTeacher]);

  const desktopLookup = useMemo(() => {
    const lk = new Map<string, Map<string, ScheduleRecord[]>>();
    for (const r of desktopFilteredRecords) {
      if (!lk.has(r.date)) lk.set(r.date, new Map());
      const byRoom = lk.get(r.date)!;
      if (!byRoom.has(r.classroom)) byRoom.set(r.classroom, []);
      byRoom.get(r.classroom)!.push(r);
    }
    return lk;
  }, [desktopFilteredRecords]);

  const desktopFilterActive = !!(searchQuery || filterClassroom || filterTeacher);

  // Build event lookup: dateStr → EventRecord[]
  const eventLookup = useMemo(() => {
    const lk = new Map<string, EventRecord[]>();
    for (const ev of localEvents) {
      if (!ev.date) continue;
      if (!lk.has(ev.date)) lk.set(ev.date, []);
      lk.get(ev.date)!.push(ev);
    }
    return lk;
  }, [localEvents]);

  // Filter options come from field definitions (not records), so options that
  // haven't been scheduled yet still appear in the dropdowns.
  const filterOptions = useMemo<FilterOptions>(() => ({
    classrooms:  selectOptions.classrooms,
    teachers:    selectOptions.teachers,
    courseTypes: selectOptions.courseTypes,
  }), [selectOptions]);

  // Route edit clicks: personal events open PersonalEventDialog, others open CourseDialog
  const handleEditRecord = (r: ScheduleRecord) => {
    if (r.courseType === "个人事项") {
      setEditPersonalRecord(r);
    } else {
      setEditRecord(r);
    }
  };

  /* ─── 新手引导 ─── */
  const advanceTour = (s: TourStep) => setTourStep(s);

  const clearDemoRecord = () => {
    setLocalRecords(prev => (demoRecordId ? prev.filter(p => p.id !== demoRecordId) : prev));
    setDemoRecordId(null);
  };

  // 结束引导：清除演示记录 + 标记已引导 + 关闭
  const finishTour = () => {
    clearDemoRecord();
    localStorage.setItem("schedule_board_onboarded", "1");
    setTourStep(null);
  };
  const skipTour = finishTour;

  // 空格点击：引导步骤 create 时进入 mock 新增（不落库）
  const handleCreateRecord = (date: string, classroom: string, timePeriod: string) => {
    setCreateData({ date, classroom, timePeriod });
    if (tourStep === "create") setMockCreate(true);
  };

  // 引导高亮
  const navRing = tourStep === "nav" ? "ring-2 ring-blue-500 ring-offset-1 z-10" : "";
  const eventRing = tourStep === "new-event" ? "ring-2 ring-blue-500 ring-offset-1 z-10" : "";
  // create 步骤打开新增弹窗时隐藏引导卡片（避免遮挡）；编辑/删除步骤改用聚光灯遮罩
  const suppressCard = tourStep === "create" && !!createData;
  // 编辑/删除步骤是否处于「弹窗已打开」阶段（决定聚光灯镂空目标）
  const dialogOpen = !!editRecord;

  const navigate = (delta: number) => {
    const next = addDays(displayStart, delta * 7);
    setDisplayStart(next);
    startTransition(() => {
      router.push(`?startDate=${format(next, "yyyy-MM-dd")}`);
    });
  };
  const goToday = () => {
    const next = startOfWeek(new Date(), { weekStartsOn: 1 });
    setDisplayStart(next);
    startTransition(() => {
      router.push(`?startDate=${format(next, "yyyy-MM-dd")}`);
    });
  };

  const jumpToDate = (date: Date) => {
    const next = startOfWeek(date, { weekStartsOn: 1 });
    setDisplayStart(next);
    startTransition(() => {
      router.push(`?startDate=${format(next, "yyyy-MM-dd")}`);
    });
  };

  const nowY = nowMin !== null ? minToY(Math.min(Math.max(nowMin, DAY_START_MIN), DAY_END_MIN)) : 0;

  return (
    <>
      {/* ── Mobile ── */}
      <div className="md:hidden">
        <MobileView
          dates={dates}
          lookup={lookup}
          eventLookup={eventLookup}
          isPending={isPending}
          navigate={navigate}
          goToday={goToday}
          displayStart={displayStart}
          selectedDayIdx={selectedDayIdx}
          setSelectedDayIdx={setSelectedDayIdx}
          onEditRecord={handleEditRecord}
          onCreateRecord={handleCreateRecord}
          onEditEvent={setEditEvent}
          onCreateEvent={(d) => setCreateEventDate(d)}
          onOpenPicker={(d) => setPickerDate(d)}
          onJump={jumpToDate}
          filterOptions={filterOptions}
          today={today}
        />
      </div>

      {/* ── Desktop ── */}
      <div className="hidden md:flex flex-col h-screen overflow-hidden bg-background">
      {/* ── Topbar ── */}
      <header className="shrink-0 border-b bg-white px-4 pt-2.5 pb-2 flex flex-col gap-2">
        {/* Row 1: title + navigation + legend */}
        <div className="flex items-center gap-4 flex-wrap">
          <AppSwitcher />
          <h1 className="text-base font-semibold tracking-tight">校区排课看板</h1>

          {/* Week navigation */}
          <div className="flex items-center gap-1.5 ml-auto">
            <Button variant="outline" size="sm" className={`h-7 text-xs ${navRing}`} data-tour="this-week" onClick={goToday}>
              <CalendarDays className="h-3.5 w-3.5 mr-1" />
              本周
            </Button>
            <Button variant="outline" size="icon" className={`h-7 w-7 ${navRing}`} data-tour="week-prev" onClick={() => navigate(-1)}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="text-sm text-muted-foreground w-[190px] text-center tabular-nums flex items-center justify-center gap-1.5">
              {isPending
                ? <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-300 shrink-0" />
                : null}
              {format(displayStart, "yyyy年M月d日")} — {format(addDays(displayStart, 6), "M月d日")}
            </span>
            <Button variant="outline" size="icon" className={`h-7 w-7 ${navRing}`} data-tour="week-next" onClick={() => navigate(1)}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <CalendarJump displayStart={displayStart} onJump={jumpToDate} />
          </div>

          {/* New event button — opens type picker */}
          <Button
            variant="outline"
            size="sm"
            className={`h-7 text-xs shrink-0 ${eventRing}`}
            data-tour="add-event"
            onClick={() => setPickerDate(format(displayStart, "yyyy-MM-dd"))}
          >
            <CalendarPlus className="h-3.5 w-3.5 mr-1" />
            新增事项
          </Button>

          {/* Legend — derived from actual loaded records */}
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            {[...new Set(localRecords.map(r => r.courseType).filter(Boolean) as string[])].map(name => {
              const s = TYPE_STYLE[name] ?? FALLBACK_STYLE;
              return (
                <span key={name} className="flex items-center gap-1">
                  <span className="inline-block w-3 h-3 rounded-sm border" style={{ backgroundColor: s.bg, borderColor: s.border }} />
                  {name}
                </span>
              );
            })}
            <span className="flex items-center gap-1">
              <span className="inline-block w-6 h-0 border-t-2 border-dashed border-red-400" />
              当前时间
            </span>
          </div>
        </div>

        {/* Row 2: search + filters */}
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative w-52">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="搜索学生、老师…"
              className="h-7 pl-8 text-xs"
            />
          </div>

          {/* Classroom filter */}
          <Select value={filterClassroom || "_all"} onValueChange={v => setFilterClassroom(v === "_all" ? "" : v)}>
            <SelectTrigger className="h-7 w-32 text-xs">
              <SelectValue placeholder="全部教室" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all" className="text-xs">全部教室</SelectItem>
              {filterOptions.classrooms.map(c => (
                <SelectItem key={c} value={c} className="text-xs">{c} 教室</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Teacher filter */}
          <Select value={filterTeacher || "_all"} onValueChange={v => setFilterTeacher(v === "_all" ? "" : v)}>
            <SelectTrigger className="h-7 w-32 text-xs">
              <SelectValue placeholder="全部老师" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all" className="text-xs">全部老师</SelectItem>
              {filterOptions.teachers.map(t => (
                <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Clear filters */}
          {desktopFilterActive && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground px-2"
              onClick={() => { setSearchQuery(""); setFilterClassroom(""); setFilterTeacher(""); }}
            >
              <X className="h-3 w-3 mr-1" />
              重置
            </Button>
          )}
        </div>
      </header>

      {/* ── Edit dialog ── */}
      {editRecord && (
        <CourseDialog
          mode="edit"
          mockMode={!!demoRecordId && editRecord.id === demoRecordId}
          initialData={{
            recordId:    editRecord.id,
            date:        editRecord.date,
            classroom:   editRecord.classroom,
            timePeriod:  editRecord.timePeriod  ?? "",
            teacher:     editRecord.teacher     ?? "",
            courseType:  editRecord.courseType  ?? "",
            grade:       editRecord.grade       ?? "",
            student:     editRecord.student     ?? "",
            courseTheme: editRecord.courseTheme ?? "",
            flexTime:    editRecord.flexTime    ?? "",
          }}
          onClose={() => setEditRecord(null)}
          onSaved={(r) => {
            setLocalRecords(prev => prev.map(p => p.id === r.id ? r : p));
            if (demoRecordId && r.id === demoRecordId) setTourStep("delete");
          }}
          onDeleted={(id) => {
            setLocalRecords(prev => prev.filter(p => p.id !== id));
            if (id === demoRecordId) { setDemoRecordId(null); setTourStep("done"); }
          }}
          selectOptions={selectOptions}
        />
      )}

      {/* ── Create dialog ── */}
      {createData && !editRecord && (
        <CourseDialog
          mode="create"
          mockMode={mockCreate}
          initialData={{
            date:       createData.date,
            classroom:  createData.classroom,
            timePeriod: createData.timePeriod,
            ...(mockCreate ? {
              student:     "演示学生",
              teacher:     "演示老师",
              courseType:  selectOptions.courseTypes[0] ?? "",
              grade:       selectOptions.grades[0] ?? "",
              courseTheme: "演示课程主题",
            } : {}),
          }}
          onClose={() => { setCreateData(null); setMockCreate(false); }}
          onSaved={(r) => {
            if (mockCreate) {
              setLocalRecords(prev => prev.some(p => p.id === r.id) ? prev.map(p => p.id === r.id ? r : p) : [...prev, r]);
              setDemoRecordId(r.id);
              setTourStep("created");
            } else {
              setLocalRecords(prev => [...prev, r]);
            }
          }}
          selectOptions={selectOptions}
        />
      )}

      {/* ── Edit event dialog ── */}
      {editEvent && (
        <EventDialog
          mode="edit"
          initialData={{
            recordId:   editEvent.id,
            date:       editEvent.date,
            timePeriod: editEvent.timePeriod ?? "",
            content:    editEvent.content    ?? "",
          }}
          onClose={() => setEditEvent(null)}
          onSaved={(ev) => setLocalEvents(prev => prev.map(e => e.id === ev.id ? ev : e))}
          onDeleted={(id) => setLocalEvents(prev => prev.filter(e => e.id !== id))}
        />
      )}

      {/* ── Create event dialog ── */}
      {createEventDate && !editEvent && (
        <EventDialog
          mode="create"
          initialData={{ date: createEventDate }}
          onClose={() => setCreateEventDate(null)}
          onSaved={(ev) => setLocalEvents(prev => [...prev, ev])}
        />
      )}

      {/* ── Event-type picker ── */}
      {pickerDate && !createEventDate && !createPersonalDate && (
        <Dialog open onOpenChange={open => { if (!open) setPickerDate(null); }}>
          <DialogContent className="max-w-sm bg-white p-0 gap-0 overflow-hidden" onOpenAutoFocus={e => e.preventDefault()}>
            <DialogHeader className="px-5 pt-5 pb-3 border-b">
              <DialogTitle className="text-base">新增事项</DialogTitle>
            </DialogHeader>
            <div className="px-5 py-5 grid grid-cols-2 gap-3">
              {/* 个人事项 */}
              <button
                className="group flex flex-col items-center gap-2.5 rounded-xl border-2 border-slate-200 bg-slate-50 p-4 hover:bg-blue-50 hover:border-blue-400 transition-colors cursor-pointer"
                onClick={() => { setCreatePersonalDate(pickerDate); setPickerDate(null); }}
              >
                <User className="h-7 w-7 text-slate-400 group-hover:text-blue-500 transition-colors" />
                <div className="text-center">
                  <p className="text-sm font-semibold text-slate-600 group-hover:text-blue-700 transition-colors">个人事项</p>
                  <p className="text-[11px] text-slate-400 group-hover:text-blue-400 mt-0.5 leading-snug transition-colors">为特定老师<br/>占用教室时段</p>
                </div>
              </button>
              {/* 全体事项 */}
              <button
                className="group flex flex-col items-center gap-2.5 rounded-xl border-2 border-slate-200 bg-slate-50 p-4 hover:bg-blue-50 hover:border-blue-400 transition-colors cursor-pointer"
                onClick={() => { setCreateEventDate(pickerDate); setPickerDate(null); }}
              >
                <Users className="h-7 w-7 text-slate-400 group-hover:text-blue-500 transition-colors" />
                <div className="text-center">
                  <p className="text-sm font-semibold text-slate-600 group-hover:text-blue-700 transition-colors">全体事项</p>
                  <p className="text-[11px] text-slate-400 group-hover:text-blue-400 mt-0.5 leading-snug transition-colors">标注全体老师<br/>均占用的时段</p>
                </div>
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Create personal event dialog ── */}
      {createPersonalDate && !pickerDate && (
        <PersonalEventDialog
          mode="create"
          initialData={{ date: createPersonalDate }}
          onClose={() => setCreatePersonalDate(null)}
          onSaved={(r) => setLocalRecords(prev => [...prev, r])}
          selectOptions={selectOptions}
        />
      )}

      {/* ── Edit personal event dialog ── */}
      {editPersonalRecord && (
        <PersonalEventDialog
          mode="edit"
          initialData={{
            recordId:   editPersonalRecord.id,
            date:       editPersonalRecord.date,
            timeMode:   editPersonalRecord.flexTime === "全天" ? "allday" : "custom",
            timeCustom: editPersonalRecord.flexTime !== "全天" ? (editPersonalRecord.flexTime ?? "") : "",
            classroom:  editPersonalRecord.classroom,
            teacher:    editPersonalRecord.teacher ?? "",
          }}
          onClose={() => setEditPersonalRecord(null)}
          onSaved={(r) => setLocalRecords(prev => prev.map(p => p.id === r.id ? r : p))}
          onDeleted={(id) => setLocalRecords(prev => prev.filter(p => p.id !== id))}
          selectOptions={selectOptions}
        />
      )}

      {/* ── Grid ── */}
      <div ref={scrollRef} className="flex-1 overflow-auto">
        <table className="border-separate [border-spacing:0]" style={{ tableLayout: "fixed" }}>
          {/* Sticky header row: classroom labels */}
          <thead className="sticky top-0 z-30">
            <tr>
              {/* Date column header */}
              <th
                className="sticky left-0 z-30 bg-slate-700 border border-slate-600 text-sm font-semibold text-white text-left px-2 py-1.5"
                style={{ width: 80, minWidth: 80 }}
              >
                日期
              </th>
              {/* Time axis header */}
              <th
                className="sticky left-[80px] z-30 bg-slate-700 border-t border-r border-b border-slate-600 text-sm font-semibold text-white text-center px-1 py-1.5"
                style={{ width: 40, minWidth: 40 }}
              >
                时间
              </th>
              {/* Classroom headers — driven by field options, not hardcoded */}
              {selectOptions.classrooms.map(room => (
                <th
                  key={room}
                  className="bg-slate-700 border-t border-r border-b border-slate-600 text-sm font-semibold text-white text-center py-1.5"
                  style={{ width: 160, minWidth: 160 }}
                >
                  {room}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {dates.map(date => {
              const dateStr  = format(date, "yyyy-MM-dd");
              const isToday  = today ? isSameDay(date, today) : false;
              const isWeekend = date.getDay() === 0 || date.getDay() === 6;
              const byRoom   = desktopLookup.get(dateStr) ?? new Map();
              const showNow  = isToday && nowMin !== null
                && nowMin >= DAY_START_MIN && nowMin <= DAY_END_MIN;
              const totalCnt = [...byRoom.values()].reduce((s, v) => s + v.length, 0);

              return (
                <tr key={dateStr} ref={isToday ? todayRef : undefined}>
                  {/* Date label cell — sticky left */}
                  <td
                    className={[
                      "sticky left-0 z-10 border-r border-b border-slate-200 align-top px-2 pt-2 pb-1",
                      isToday  ? "bg-blue-50"      :
                      isWeekend ? "bg-amber-50"    : "bg-white",
                    ].join(" ")}
                    style={{ width: 80, minWidth: 80, height: CELL_H }}
                  >
                    <div className={`text-sm font-bold tabular-nums ${isToday ? "text-blue-600" : ""}`}>
                      {format(date, "M/d")}
                    </div>
                    <div className={`text-[11px] ${isToday ? "text-blue-500" : "text-muted-foreground"}`}>
                      {WEEKDAYS[date.getDay()]}
                    </div>
                    {isToday && (
                      <span className="mt-1 inline-block text-[9px] bg-blue-500 text-white rounded px-1 py-0.5 leading-none">
                        今天
                      </span>
                    )}
                    {totalCnt > 0 && (
                      <div className="mt-1 text-[10px] text-muted-foreground">
                        {totalCnt} 节
                      </div>
                    )}
                  </td>

                  {/* Vertical time axis cell — sticky */}
                  <TimeAxis isToday={isToday} showNow={showNow} nowY={nowY} />

                  {/* Classroom cells — driven by field options, not hardcoded */}
                  {selectOptions.classrooms.map(room => (
                    <td
                      key={room}
                      className="border-r border-b border-slate-200 p-0"
                      style={{ height: CELL_H }}
                    >
                      <ClassroomCell
                        records={byRoom.get(room) ?? []}
                        events={eventLookup.get(dateStr) ?? []}
                        isToday={isToday}
                        showNow={showNow}
                        nowY={nowY}
                        date={dateStr}
                        classroom={room}
                        onEditRecord={handleEditRecord}
                        onCreateRecord={handleCreateRecord}
                        demoRecordId={demoRecordId}
                        onEditEvent={setEditEvent}
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      </div>

      <OnboardingTour
        step={tourStep}
        onAdvance={advanceTour}
        onSkip={skipTour}
        onFinish={finishTour}
        suppressCard={suppressCard}
        dialogOpen={dialogOpen}
      />
    </>
  );
}

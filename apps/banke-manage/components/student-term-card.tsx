"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, BookOpen, User, CalendarDays, Pencil, Trash2, Copy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { toShanghaiDate } from "@/lib/schedule-utils";
import type { StudentTermSchedule } from "@/lib/schedule-utils";
import type { ScheduleFieldOptions } from "@/app/actions/schedule";
import { deleteScheduleGroup } from "@/app/actions/schedule";
import { EditClassDialog } from "@/components/edit-class-dialog";
import { CopyClassDialog } from "@/components/copy-class-dialog";

interface Props {
  schedule: StudentTermSchedule;
  fieldOptions: ScheduleFieldOptions;
}

// ── Date helpers (always Shanghai / UTC+8) ───────────────────────
const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"] as const;
const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;

function formatDate(iso: string): string {
  const d = toShanghaiDate(iso);
  return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日 周${WEEKDAYS[d.getUTCDay()]}`;
}

function isSameDay(a: Date, b: Date) {
  return a.getUTCFullYear() === b.getUTCFullYear()
    && a.getUTCMonth() === b.getUTCMonth()
    && a.getUTCDate() === b.getUTCDate();
}

function isToday(iso: string) {
  const d = toShanghaiDate(iso);
  const now = new Date(Date.now() + SHANGHAI_OFFSET_MS);
  return isSameDay(d, now);
}

function isFuture(iso: string) {
  const d = toShanghaiDate(iso);
  const now = new Date(Date.now() + SHANGHAI_OFFSET_MS);
  const lMs = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const tMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return lMs > tMs;
}

/** Lessons that have already happened (date strictly before today) */
function isPast(iso: string) {
  return !isToday(iso) && !isFuture(iso);
}

const PREVIEW = 4;

// ── Status badge ─────────────────────────────────────────────────
interface StatusBadgeProps {
  taughtCount: number;
  totalCount: number;
  /** True if today is one of the scheduled lesson days */
  hasToday: boolean;
}

function StatusBadge({ taughtCount, totalCount, hasToday }: StatusBadgeProps) {
  // 已结课: every lesson is strictly before today (today is NOT a lesson day)
  // Note: taughtCount uses isPast() which excludes today, so if today is the last
  // lesson day, taughtCount < totalCount → correctly shows "授课中".
  if (!hasToday && taughtCount >= totalCount && totalCount > 0) {
    return (
      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">
        已结课
      </span>
    );
  }
  // 授课中: first lesson has arrived (some past) OR today is a lesson day
  if (taughtCount > 0 || hasToday) {
    return (
      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
        授课中
      </span>
    );
  }
  // 待授课: no lesson has started yet, today is not a lesson day
  return (
    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
      待授课
    </span>
  );
}

// ── Card ─────────────────────────────────────────────────────────
export function StudentTermCard({ schedule, fieldOptions }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [expanded,    setExpanded]    = useState(false);
  const [editOpen,    setEditOpen]    = useState(false);
  const [copyOpen,    setCopyOpen]    = useState(false);
  const [deleteOpen,  setDeleteOpen]  = useState(false);

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteScheduleGroup(schedule.lessons.map((l) => l.id));
      if (result.success) {
        toast.success("已删除课程组");
        router.refresh();
      } else {
        toast.error(result.error ?? "删除失败，请重试");
      }
    });
  }

  // Guard Date.now() comparisons — server and client must agree on initial render
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const { topic, student, grade, teacher, term, lessons } = schedule;

  const sorted = [...lessons].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // "已授" = lessons strictly before today; "hasToday" = at least one lesson is today
  const taughtCount    = mounted ? sorted.filter((l) => isPast(l.date)).length : 0;
  const hasToday       = mounted ? sorted.some((l) => isToday(l.date)) : false;
  const totalScheduled = sorted.length;

  const pct = totalScheduled > 0
    ? Math.min(100, Math.round((taughtCount / totalScheduled) * 100))
    : 0;

  const visible = expanded ? sorted : sorted.slice(0, PREVIEW);
  const hasMore = sorted.length > PREVIEW;

  const nextLesson = mounted ? sorted.find((l) => isFuture(l.date) || isToday(l.date)) : null;

  const barColor =
    taughtCount >= totalScheduled && totalScheduled > 0 ? "bg-green-500" :
    pct >= 60  ? term.barClass :
    pct >= 20  ? "bg-yellow-400" :
    term.barClass;

  const displayTitle = topic || student || "（未命名课程）";

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            className={cn(
              "rounded-xl border p-4 flex flex-col gap-3 bg-white shadow-sm",
              "hover:shadow-md transition-shadow group",
              term.bgClass
            )}
          >
        {/* ── Header ──────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {/* Course topic as primary title */}
            <p className="font-semibold text-sm text-gray-900 leading-snug line-clamp-2">
              {displayTitle}
            </p>
            {/* Metadata row */}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {grade && (
                <Badge variant="secondary" className="text-xs h-4 px-1.5">
                  {grade}
                </Badge>
              )}
              {teacher && (
                <span className="flex items-center gap-0.5 text-xs text-gray-500">
                  <User className="h-3 w-3" />{teacher}
                </span>
              )}
              {student && (
                <span className="text-xs text-gray-400">{student}</span>
              )}
            </div>
          </div>

          {/* Right: term badge + course type + action buttons */}
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <div className="flex items-center gap-1">
              <span className={cn(
                "text-xs font-medium px-2 py-0.5 rounded-full border",
                term.colorClass, term.bgClass
              )}>
                {term.year}{term.label}
              </span>
              {schedule.courseType && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full border border-gray-200 bg-white text-gray-500">
                  {schedule.courseType}
                </span>
              )}
            </div>
            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
              <button
                onClick={() => setEditOpen(true)}
                className="p-1 rounded hover:bg-white/60 transition-colors text-gray-400 hover:text-gray-700"
                title="编辑课程"
              >
                <Pencil className="h-3 w-3" />
              </button>
              <button
                onClick={() => setDeleteOpen(true)}
                disabled={isPending}
                className="p-1 rounded hover:bg-white/60 transition-colors text-gray-400 hover:text-red-500"
                title="删除课程组"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>

        {/* ── Progress (已授) ──────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="flex items-center gap-1 text-gray-500">
              <BookOpen className="h-3 w-3" />
              已授
              <span className="font-semibold text-gray-700 mx-0.5" suppressHydrationWarning>
                {taughtCount}
              </span>
              <span className="text-gray-400">/ {totalScheduled} 节</span>
            </span>
            <StatusBadge taughtCount={taughtCount} totalCount={totalScheduled} hasToday={hasToday} />
          </div>
          <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all", barColor)}
              style={{ width: `${pct}%` }}
              suppressHydrationWarning
            />
          </div>
        </div>

        {/* ── Next lesson hint ──────────────────────────────────── */}
        {nextLesson && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <CalendarDays className="h-3 w-3 shrink-0" />
            <span>
              {isToday(nextLesson.date) ? "今天" : "下次"}：{formatDate(nextLesson.date)}
              {nextLesson.topic?.match(/第\d+讲/)
                ? ` · ${nextLesson.topic.match(/第\d+讲/)![0]}`
                : nextLesson.timeSlot ? ` · ${nextLesson.timeSlot.split(" ")[0]}` : ""}
            </span>
          </div>
        )}

        {/* ── Lesson list ───────────────────────────────────────── */}
        {sorted.length > 0 && (
          <div className="flex flex-col gap-0.5">
            {visible.map((lesson, i) => {
              const today  = mounted && isToday(lesson.date);
              const future = mounted && isFuture(lesson.date);
              const past   = mounted && isPast(lesson.date);
              // Extract lecture number from topic "…·第N讲", fall back to position
              const lectureNum = lesson.topic?.match(/第(\d+)讲/)?.[1] ?? String(i + 1);
              return (
                <div
                  key={lesson.id}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-1 text-xs",
                    today  ? "bg-blue-100 text-blue-800 font-medium" :
                    past   ? "text-gray-400" :
                    "text-gray-600"
                  )}
                >
                  <span className={cn(
                    "shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold",
                    today  ? "bg-blue-500 text-white" :
                    past   ? "bg-gray-100 text-gray-400" :
                    "bg-gray-200 text-gray-600"
                  )}>
                    {lectureNum}
                  </span>
                  <span className="flex-1 tabular-nums">{formatDate(lesson.date)}</span>
                  {lesson.classroom && (
                    <span className="shrink-0 px-1 rounded text-[10px] bg-gray-100 text-gray-500">
                      {lesson.classroom}室
                    </span>
                  )}
                  {today && (
                    <span className="shrink-0 text-blue-600 font-semibold text-[10px]">今天</span>
                  )}
                  {past && (
                    <span className="shrink-0 text-gray-300 text-[10px]">✓</span>
                  )}
                </div>
              );
            })}

            {hasMore && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center justify-center gap-1 text-xs text-gray-400 hover:text-gray-600 pt-0.5 transition-colors"
              >
                {expanded
                  ? <><ChevronUp className="h-3 w-3" />收起</>
                  : <><ChevronDown className="h-3 w-3" />还有 {sorted.length - PREVIEW} 节</>}
              </button>
            )}
          </div>
        )}
      </div>

        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={() => setCopyOpen(true)} className="gap-2">
            <Copy className="h-3.5 w-3.5" />
            复制课程
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Edit dialog — lazy mounted */}
      {editOpen && (
        <EditClassDialog
          schedule={schedule}
          open={editOpen}
          onOpenChange={setEditOpen}
          fieldOptions={fieldOptions}
        />
      )}

      {/* Copy dialog — lazy mounted */}
      {copyOpen && (
        <CopyClassDialog
          schedule={schedule}
          open={copyOpen}
          onOpenChange={setCopyOpen}
          fieldOptions={fieldOptions}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除课程组</AlertDialogTitle>
            <AlertDialogDescription>
              将删除「{schedule.topic || schedule.student}」的全部{" "}
              <span className="font-semibold text-gray-900">{schedule.lessons.length} 节</span>{" "}
              课次记录，此操作不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isPending}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {isPending ? "删除中…" : "确认删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

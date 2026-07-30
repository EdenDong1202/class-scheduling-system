"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toShanghaiDate } from "@/lib/schedule-utils";
import type { StudentTermSchedule } from "@/lib/schedule-utils";
import { updateScheduleGroup } from "@/app/actions/schedule";
import type { ScheduleFieldOptions } from "@/app/actions/schedule";

// ── Date helper (always UTC+8 / Shanghai) ────────────────────────
function toDateStr(iso: string): string {
  const d = toShanghaiDate(iso);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

interface Props {
  schedule: StudentTermSchedule;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fieldOptions: ScheduleFieldOptions;
}

export function EditClassDialog({ schedule, open, onOpenChange, fieldOptions }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // ── Metadata fields ───────────────────────────────────────────
  const [topic,     setTopic]     = useState(schedule.topic);
  const [grade,     setGrade]     = useState(schedule.grade);
  const [teacher,   setTeacher]   = useState(schedule.teacher);
  const [classroom, setClassroom] = useState(schedule.classroom);
  const [timeSlot,  setTimeSlot]  = useState(schedule.timeSlot);
  const [flexTime,  setFlexTime]  = useState(schedule.flexTime);

  // ── Lesson management ─────────────────────────────────────────
  const [deleteIds,     setDeleteIds]     = useState<Set<string>>(new Set());
  const [newDates,      setNewDates]      = useState<string[]>([]);
  const [newDateInput,  setNewDateInput]  = useState("");

  const sorted = [...schedule.lessons].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  function toggleDelete(id: string) {
    setDeleteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handleAddDate() {
    if (!newDateInput || newDates.includes(newDateInput)) return;
    setNewDates((d) => [...d, newDateInput].sort());
    setNewDateInput("");
  }

  function handleSave() {
    startTransition(async () => {
      const result = await updateScheduleGroup({
        existingIds: schedule.lessons.map((l) => l.id),
        existingLessons: schedule.lessons.map((l) => ({ id: l.id, date: l.date })),
        meta: { topic, student: schedule.student, grade, teacher, classroom, timeSlot, flexTime },
        newDates,
        deleteIds: Array.from(deleteIds),
      });
      if (result.success) {
        toast.success("保存成功");
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(result.error ?? "保存失败，请重试");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>编辑长期班</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-1">
          {/* ── Metadata ─────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="ec-topic">课程主题</Label>
              <Input
                id="ec-topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="（选填）"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>年级</Label>
              <Select value={grade} onValueChange={setGrade}>
                <SelectTrigger><SelectValue placeholder="选择年级" /></SelectTrigger>
                <SelectContent>
                  {fieldOptions.grades.map((g) => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>老师</Label>
              <Select value={teacher} onValueChange={setTeacher}>
                <SelectTrigger><SelectValue placeholder="选择老师" /></SelectTrigger>
                <SelectContent>
                  {fieldOptions.teachers.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>教室</Label>
              <Select value={classroom} onValueChange={setClassroom}>
                <SelectTrigger><SelectValue placeholder="选择教室" /></SelectTrigger>
                <SelectContent>
                  {fieldOptions.classrooms.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2 flex flex-col gap-1.5">
              <Label>时段</Label>
              <Select value={timeSlot} onValueChange={setTimeSlot}>
                <SelectTrigger><SelectValue placeholder="选择时段" /></SelectTrigger>
                <SelectContent>
                  {fieldOptions.timeSlots.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="ec-flex">灵活时间 / 备注</Label>
              <Input
                id="ec-flex"
                value={flexTime}
                onChange={(e) => setFlexTime(e.target.value)}
                placeholder="（选填）"
              />
            </div>
          </div>

          {/* ── Existing lesson list ──────────────────────────── */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1.5">
              课次安排
              <span className="text-gray-400 font-normal ml-1">({sorted.length} 节)</span>
            </p>
            <div className="flex flex-col gap-0.5 max-h-44 overflow-y-auto rounded-md border p-2">
              {sorted.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-3">暂无课次</p>
              )}
              {sorted.map((lesson) => (
                <div
                  key={lesson.id}
                  className={cn(
                    "flex items-center justify-between rounded px-2 py-1 text-sm transition-colors",
                    deleteIds.has(lesson.id)
                      ? "line-through opacity-40 bg-red-50"
                      : "hover:bg-gray-50"
                  )}
                >
                  <span className="tabular-nums">{toDateStr(lesson.date)}</span>
                  <button
                    type="button"
                    aria-label={deleteIds.has(lesson.id) ? "撤销删除" : "删除"}
                    onClick={() => toggleDelete(lesson.id)}
                    className={cn(
                      "rounded p-1 transition-colors",
                      deleteIds.has(lesson.id)
                        ? "text-red-500 hover:text-red-700"
                        : "text-gray-300 hover:text-red-500"
                    )}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
            {deleteIds.size > 0 && (
              <p className="mt-1 text-xs text-red-500">将删除 {deleteIds.size} 节课，保存后不可恢复</p>
            )}
          </div>

          {/* ── Add new dates ─────────────────────────────────── */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1.5">添加新课次</p>
            <div className="flex gap-2">
              <Input
                type="date"
                value={newDateInput}
                onChange={(e) => setNewDateInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddDate()}
                className="flex-1"
                aria-label="新课次日期"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleAddDate}
                aria-label="添加"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {newDates.length > 0 && (
              <div className="flex flex-col gap-0.5 mt-2">
                {newDates.map((date) => (
                  <div
                    key={date}
                    className="flex items-center justify-between rounded px-2 py-1 text-sm bg-green-50"
                  >
                    <span className="tabular-nums text-green-700">{date}</span>
                    <button
                      type="button"
                      aria-label="移除"
                      onClick={() => setNewDates((d) => d.filter((x) => x !== date))}
                      className="rounded p-1 text-green-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            取消
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? "保存中…" : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toShanghaiDate } from "@/lib/schedule-utils";
import type { StudentTermSchedule } from "@/lib/schedule-utils";
import { importScheduleRecords } from "@/app/actions/schedule";
import type { ScheduleFieldOptions } from "@/app/actions/schedule";

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
  onCreated?: () => void;
}

export function CopyClassDialog({ schedule, open, onOpenChange, fieldOptions, onCreated }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [topic,      setTopic]      = useState(schedule.topic);
  const [grade,      setGrade]      = useState(schedule.grade);
  const [teacher,    setTeacher]    = useState(schedule.teacher);
  const [classroom,  setClassroom]  = useState(schedule.classroom);
  const [timeSlot,   setTimeSlot]   = useState(schedule.timeSlot);
  const [flexTime,   setFlexTime]   = useState(schedule.flexTime);
  const [courseType, setCourseType] = useState(schedule.courseType || "长期班");

  // Pre-fill all dates from the original schedule
  const [dates, setDates] = useState<string[]>(
    [...schedule.lessons]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((l) => toDateStr(l.date))
  );

  function removeDate(date: string) {
    setDates((prev) => prev.filter((d) => d !== date));
  }

  function handleSave() {
    if (!teacher)        { toast.error("请选择老师"); return; }
    if (!grade)          { toast.error("请选择年级"); return; }
    if (!classroom)      { toast.error("请选择教室"); return; }
    if (!dates.length)   { toast.error("请至少保留一节课"); return; }

    startTransition(async () => {
      const result = await importScheduleRecords(
        dates.map((date) => ({
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
        toast.success(`已新增 ${result.count} 节课`);
        onOpenChange(false);
        onCreated?.();
        router.refresh();
      } else {
        toast.error(result.error ?? "新增失败，请重试");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>复制课程</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-1">
          {/* 课程类型 */}
          <div className="flex flex-col gap-1.5">
            <Label>课程类型</Label>
            <div className="flex gap-2">
              {(["长期班", "短期班"] as const).map((ct) => (
                <button
                  key={ct}
                  type="button"
                  onClick={() => setCourseType(ct)}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs border font-medium transition-all",
                    courseType === ct
                      ? "bg-gray-800 text-white border-transparent"
                      : "text-gray-600 border-gray-200 hover:border-gray-400 bg-white"
                  )}
                >
                  {ct}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* 课程主题 */}
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="cp-topic">课程主题</Label>
              <Input
                id="cp-topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="（选填）"
              />
            </div>

            {/* 年级 */}
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

            {/* 老师 */}
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

            {/* 教室 */}
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

            {/* 时段 */}
            <div className="flex flex-col gap-1.5">
              <Label>时段</Label>
              <Select value={timeSlot} onValueChange={setTimeSlot}>
                <SelectTrigger><SelectValue placeholder="选择时段" /></SelectTrigger>
                <SelectContent>
                  {fieldOptions.timeSlots.map((s) => (
                    <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 灵活时间 */}
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="cp-flex">灵活时间 / 备注</Label>
              <Input
                id="cp-flex"
                value={flexTime}
                onChange={(e) => setFlexTime(e.target.value)}
                placeholder="（选填）"
              />
            </div>
          </div>

          {/* 课次列表 */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1.5">
              课次安排
              <span className="text-gray-400 font-normal ml-1">（{dates.length} 节，可删减）</span>
            </p>
            <div className="flex flex-col gap-0.5 max-h-44 overflow-y-auto rounded-md border p-2">
              {dates.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-3">暂无课次</p>
              )}
              {dates.map((date) => (
                <div
                  key={date}
                  className="flex items-center justify-between rounded px-2 py-1 text-sm hover:bg-gray-50"
                >
                  <span className="tabular-nums text-gray-700">{date}</span>
                  <button
                    type="button"
                    onClick={() => removeDate(date)}
                    className="rounded p-1 text-gray-300 hover:text-red-500 transition-colors"
                    aria-label="移除"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={isPending || !dates.length}>
            {isPending ? "新增中…" : `新增 ${dates.length} 节`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

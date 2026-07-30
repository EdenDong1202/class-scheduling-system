"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
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
import {
  savePersonalEvent,
  deleteCourse,
  type ScheduleRecord,
  type SelectOptions,
  type PersonalEventFormData,
} from "@/app/actions";

function isValidTimeRange(s: string): boolean {
  return /^\d{1,2}:\d{2}\s*[-–]\s*\d{1,2}:\d{2}$/.test(s.trim());
}

interface Props {
  mode: "create" | "edit";
  initialData: Partial<PersonalEventFormData> & { recordId?: string };
  onClose: () => void;
  onSaved?: (record: ScheduleRecord) => void;
  onDeleted?: (id: string) => void;
  selectOptions: SelectOptions;
}

export default function PersonalEventDialog({
  mode,
  initialData,
  onClose,
  onSaved,
  onDeleted,
  selectOptions,
}: Props) {
  const [saving,   startSave]   = useTransition();
  const [deleting, startDelete] = useTransition();

  const [form, setForm] = useState<PersonalEventFormData>({
    date:       initialData.date       ?? "",
    timeMode:   initialData.timeMode   ?? "allday",
    timeCustom: initialData.timeCustom ?? "",
    classroom:  initialData.classroom  ?? "",
    teacher:    initialData.teacher    ?? "",
  });

  const set = <K extends keyof PersonalEventFormData>(
    key: K,
    value: PersonalEventFormData[K],
  ) => setForm(f => ({ ...f, [key]: value }));

  const handleSave = () => {
    if (!form.date)      { toast.error("请选择日期");   return; }
    if (!form.classroom) { toast.error("请选择教室");   return; }
    if (!form.teacher)   { toast.error("请选择教师");   return; }
    if (form.timeMode === "custom") {
      if (!form.timeCustom.trim())          { toast.error("请填写时间段，如：8:00-10:00"); return; }
      if (!isValidTimeRange(form.timeCustom)) { toast.error("时间格式不正确，请输入如：8:00-10:00"); return; }
    }

    startSave(async () => {
      const res = await savePersonalEvent(initialData.recordId ?? null, form);
      if (res.success && res.recordId) {
        toast.success(mode === "create" ? "个人事项已新增" : "个人事项已更新");
        onSaved?.({
          id:          res.recordId,
          date:        form.date,
          classroom:   form.classroom,
          timePeriod:  null,
          teacher:     form.teacher,
          student:     null,
          courseTheme: null,
          courseType:  "个人事项",
          grade:       null,
          flexTime:    form.timeMode === "allday" ? "全天" : (form.timeCustom || null),
        });
        onClose();
      } else {
        toast.error(res.error ?? "操作失败，请重试");
      }
    });
  };

  const handleDelete = () => {
    if (!initialData.recordId) return;
    startDelete(async () => {
      const res = await deleteCourse(initialData.recordId!);
      if (res.success) {
        toast.success("个人事项已删除");
        onDeleted?.(initialData.recordId!);
        onClose();
      } else {
        toast.error(res.error ?? "删除失败，请重试");
      }
    });
  };

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-sm bg-white p-0 gap-0 overflow-hidden" onOpenAutoFocus={e => e.preventDefault()}>
        <DialogHeader className="px-5 pt-5 pb-3 border-b">
          <DialogTitle className="text-base">
            {mode === "create" ? "新增个人事项" : "编辑个人事项"}
          </DialogTitle>
        </DialogHeader>

        <div className="px-5 py-4 space-y-3">
          {/* Date */}
          <div className="space-y-1">
            <Label className="text-xs text-gray-500">日期 *</Label>
            <Input
              type="date"
              value={form.date}
              onChange={e => set("date", e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          {/* Time mode */}
          <div className="space-y-1">
            <Label className="text-xs text-gray-500">时间 *</Label>
            <div className="flex gap-2">
              {(["allday", "custom"] as const).map(m => (
                <button
                  key={m}
                  type="button"
                  className={[
                    "flex-1 h-8 text-sm rounded border transition-colors",
                    form.timeMode === m
                      ? "border-blue-500 bg-blue-50 text-blue-700 font-medium"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50",
                  ].join(" ")}
                  onClick={() => set("timeMode", m)}
                >
                  {m === "allday" ? "全天" : "其他"}
                </button>
              ))}
            </div>
            {form.timeMode === "custom" && (
              <div className="mt-1">
                <Input
                  value={form.timeCustom}
                  onChange={e => set("timeCustom", e.target.value)}
                  placeholder="如：8:00-10:00"
                  className={[
                    "h-8 text-sm",
                    form.timeCustom && !isValidTimeRange(form.timeCustom)
                      ? "border-red-400 focus-visible:ring-red-300"
                      : "",
                  ].join(" ")}
                  autoFocus
                />
                {form.timeCustom && !isValidTimeRange(form.timeCustom) && (
                  <p className="text-[11px] text-red-500 mt-0.5 leading-none">格式：8:00-10:00</p>
                )}
              </div>
            )}
          </div>

          {/* Teacher — first */}
          <div className="space-y-1">
            <Label className="text-xs text-gray-500">教师 *</Label>
            <Select
              value={form.teacher || ""}
              onValueChange={v => set("teacher", v)}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="选择教师" />
              </SelectTrigger>
              <SelectContent>
                {selectOptions.teachers.map(t => (
                  <SelectItem key={t} value={t} className="text-sm">{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Classroom — second */}
          <div className="space-y-1">
            <Label className="text-xs text-gray-500">教室 *</Label>
            <Select
              value={form.classroom || ""}
              onValueChange={v => set("classroom", v)}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="选择教室" />
              </SelectTrigger>
              <SelectContent>
                {selectOptions.classrooms.map(c => (
                  <SelectItem key={c} value={c} className="text-sm">{c} 教室</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="px-5 py-3 border-t flex items-center justify-between gap-2">
          <div>
            {mode === "edit" && initialData.recordId && (
              <Button
                variant="ghost"
                size="sm"
                className="text-red-500 hover:text-red-600 hover:bg-red-50"
                disabled={deleting || saving}
                onClick={handleDelete}
              >
                {deleting ? "删除中…" : "删除事项"}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={saving || deleting}>
              取消
            </Button>
            <Button size="sm" disabled={saving || deleting} onClick={handleSave}>
              {saving ? "保存中…" : "保存"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

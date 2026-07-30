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
import { saveEvent, deleteCourse, type EventRecord, type EventFormData } from "@/app/actions";

/** 校验时间段输入是否可解析，如 "8:00-10:00" */
function isValidTimeRange(s: string): boolean {
  return /^\d{1,2}:\d{2}\s*[-–]\s*\d{1,2}:\d{2}$/.test(s.trim());
}

/* ─── Props ──────────────────────────────────────────────────── */

interface Props {
  mode: "create" | "edit";
  initialData: Partial<EventFormData> & { recordId?: string };
  onClose: () => void;
  onSaved?: (record: EventRecord) => void;
  onDeleted?: (id: string) => void;
}

/* ─── EventDialog ────────────────────────────────────────────── */

export default function EventDialog({ mode, initialData, onClose, onSaved, onDeleted }: Props) {
  const [saving,   startSave]   = useTransition();
  const [deleting, startDelete] = useTransition();

  const [form, setForm] = useState<EventFormData>({
    date:       initialData.date       ?? "",
    timePeriod: initialData.timePeriod ?? "",
    content:    initialData.content    ?? "",
  });

  const set = (key: keyof EventFormData) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSave = () => {
    if (!form.date) {
      toast.error("请选择日期");
      return;
    }
    if (!form.timePeriod.trim()) {
      toast.error("请输入时间段，如：8:00-10:00");
      return;
    }
    if (!isValidTimeRange(form.timePeriod)) {
      toast.error("时间格式不正确，请输入如：8:00-10:00");
      return;
    }
    if (!form.content.trim()) {
      toast.error("请填写事项内容");
      return;
    }
    startSave(async () => {
      const res = await saveEvent(initialData.recordId ?? null, form);
      if (res.success && res.recordId) {
        toast.success(mode === "create" ? "事项已新增" : "事项已更新");
        onSaved?.({
          id:         res.recordId,
          date:       form.date,
          timePeriod: form.timePeriod || null,
          content:    form.content   || null,
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
        toast.success("事项已删除");
        onDeleted?.(initialData.recordId!);
        onClose();
      } else {
        toast.error(res.error ?? "删除失败，请重试");
      }
    });
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-sm bg-white p-0 gap-0 overflow-hidden" onOpenAutoFocus={e => e.preventDefault()}>
        <DialogHeader className="px-5 pt-5 pb-3 border-b">
          <DialogTitle className="text-base">
            {mode === "create" ? "新增全体事项" : "编辑全体事项"}
          </DialogTitle>
        </DialogHeader>

        <div className="px-5 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">日期 *</Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => set("date")(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">时段 *</Label>
              <Input
                value={form.timePeriod}
                onChange={(e) => set("timePeriod")(e.target.value)}
                placeholder="如：8:00-10:00"
                className={[
                  "h-8 text-sm",
                  form.timePeriod && !isValidTimeRange(form.timePeriod)
                    ? "border-red-400 focus-visible:ring-red-300"
                    : "",
                ].join(" ")}
              />
              {form.timePeriod && !isValidTimeRange(form.timePeriod) && (
                <p className="text-[11px] text-red-500 leading-none">格式：8:00-10:00</p>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-gray-500">事项内容 *</Label>
            <Input
              value={form.content}
              onChange={(e) => set("content")(e.target.value)}
              placeholder="如：全体老师培训、校区活动…"
              className="h-8 text-sm"
              autoFocus
            />
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

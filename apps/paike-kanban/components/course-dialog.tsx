"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, ChevronsUpDown } from "lucide-react";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { TYPE_STYLE, FALLBACK_STYLE } from "@/lib/schedule-constants";
import {
  saveCourse,
  deleteCourse,
  type CourseFormData,
  type ScheduleRecord,
  type SelectOptions,
} from "@/app/actions";

/* ─── Props ──────────────────────────────────────────────────── */

export interface DialogInitialData extends Partial<CourseFormData> {
  recordId?: string;
}

interface Props {
  mode: "create" | "edit";
  initialData: DialogInitialData;
  onClose: () => void;
  onSaved?: (record: ScheduleRecord) => void;
  onDeleted?: (id: string) => void;
  selectOptions: SelectOptions;
  /** 演示模式：保存时不写数据库，仅回调 onSaved（用于新手引导） */
  mockMode?: boolean;
}

/* ─── Helpers ────────────────────────────────────────────────── */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-gray-500">{label}</Label>
      {children}
    </div>
  );
}

function PickSelect({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: string[];
}) {
  return (
    <Select value={value || ""} onValueChange={onChange}>
      <SelectTrigger className="h-8 text-sm">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Course-type select — shows colour swatch from schedule board. Options from DB. */
function CourseTypeSelect({
  value,
  onChange,
  courseTypes,
}: {
  value: string;
  onChange: (v: string) => void;
  courseTypes: string[];
}) {
  return (
    <Select value={value || ""} onValueChange={onChange}>
      <SelectTrigger className="h-8 text-sm">
        <SelectValue placeholder="选择类型" />
      </SelectTrigger>
      <SelectContent>
        {courseTypes.map((o) => {
          const s = TYPE_STYLE[o] ?? FALLBACK_STYLE;
          return (
            <SelectItem key={o} value={o}>
              <span className="flex items-center gap-1.5">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-sm border shrink-0"
                  style={{ backgroundColor: s.badgeBg, borderColor: s.border }}
                />
                <span style={{ color: s.text }}>{o}</span>
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

/** Teacher combobox — searchable. Options from DB. */
function TeacherCombobox({
  value,
  onChange,
  teachers,
}: {
  value: string;
  onChange: (v: string) => void;
  teachers: string[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-8 w-full text-sm justify-between font-normal px-3"
        >
          {value ? (
            <span className="truncate">{value}</span>
          ) : (
            <span className="text-muted-foreground">选择老师</span>
          )}
          <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="搜索老师…" className="h-8 text-sm" />
          <CommandList>
            <CommandEmpty className="py-4 text-xs text-center text-muted-foreground">
              无匹配老师
            </CommandEmpty>
            <CommandGroup>
              {teachers.map((t) => (
                <CommandItem
                  key={t}
                  value={t}
                  onSelect={(v) => {
                    onChange(v === value ? "" : v);
                    setOpen(false);
                  }}
                  className="text-sm"
                >
                  <Check
                    className={cn("mr-2 h-3.5 w-3.5 shrink-0", value === t ? "opacity-100" : "opacity-0")}
                  />
                  {t}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/* ─── CourseDialog ───────────────────────────────────────────── */

function toRecord(id: string, f: CourseFormData): ScheduleRecord {
  return {
    id,
    date:        f.date,
    classroom:   f.classroom,
    timePeriod:  f.timePeriod  || null,
    teacher:     f.teacher     || null,
    student:     f.student     || null,
    courseTheme: f.courseTheme || null,
    courseType:  f.courseType  || null,
    grade:       f.grade       || null,
    flexTime:    f.flexTime    || null,
  };
}

export default function CourseDialog({
  mode,
  initialData,
  onClose,
  onSaved,
  onDeleted,
  selectOptions,
  mockMode,
}: Props) {
  const [saving,   startSave]   = useTransition();
  const [deleting, startDelete] = useTransition();

  const [form, setForm] = useState<CourseFormData>({
    date:        initialData.date        ?? "",
    classroom:   initialData.classroom   ?? "",
    timePeriod:  initialData.timePeriod  ?? "",
    teacher:     initialData.teacher     ?? "",
    courseType:  initialData.courseType  ?? "",
    grade:       initialData.grade       ?? "",
    student:     initialData.student     ?? "",
    courseTheme: initialData.courseTheme ?? "",
    flexTime:    initialData.flexTime    ?? "",
  });

  const set = (key: keyof CourseFormData) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSave = () => {
    if (!form.date || !form.classroom) {
      toast.error("日期和教室为必填项");
      return;
    }
    // 演示模式（新手引导）：不写数据库，直接回调 onSaved 并关闭
    if (mockMode) {
      const rec = toRecord(initialData.recordId ?? crypto.randomUUID(), form);
      onSaved?.(rec);
      onClose();
      return;
    }
    startSave(async () => {
      const res = await saveCourse(initialData.recordId ?? null, form);
      if (res.success && res.recordId) {
        toast.success(mode === "create" ? "课程已新增" : "课程已更新");
        onSaved?.(toRecord(res.recordId, form));
        onClose();
      } else {
        toast.error(res.error ?? "操作失败，请重试");
      }
    });
  };

  const handleDelete = () => {
    if (!initialData.recordId) return;
    // 演示模式（新手引导）：不写数据库，直接回调 onDeleted 并关闭
    if (mockMode) {
      onDeleted?.(initialData.recordId);
      onClose();
      return;
    }
    startDelete(async () => {
      const res = await deleteCourse(initialData.recordId!);
      if (res.success) {
        toast.success("课程已删除");
        onDeleted?.(initialData.recordId!);
        onClose();
      } else {
        toast.error(res.error ?? "删除失败，请重试");
      }
    });
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md bg-white p-0 gap-0 overflow-hidden" onOpenAutoFocus={e => e.preventDefault()}>
        <DialogHeader className="px-5 pt-5 pb-3 border-b">
          <DialogTitle className="text-base">
            {mode === "create" ? "新增课程" : "编辑课程"}
          </DialogTitle>
        </DialogHeader>

        <div className="px-5 py-4 grid grid-cols-2 gap-x-4 gap-y-3">
          <Field label="日期 *">
            <Input
              type="date"
              value={form.date}
              onChange={(e) => set("date")(e.target.value)}
              className="h-8 text-sm"
            />
          </Field>
          <Field label="教室 *">
            <PickSelect
              value={form.classroom}
              onChange={set("classroom")}
              placeholder="选择教室"
              options={selectOptions.classrooms}
            />
          </Field>

          {/* 时段 + 灵活时间: side-by-side on desktop, stacked on mobile */}
          <div className="col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
            <Field label="时段">
              <PickSelect
                value={form.timePeriod}
                onChange={set("timePeriod")}
                placeholder="选择时段"
                options={selectOptions.timePeriods}
              />
            </Field>
            <Field label="灵活时间">
              <Input
                value={form.flexTime}
                onChange={(e) => set("flexTime")(e.target.value)}
                placeholder="如：8:20-10:20"
                className="h-8 text-sm"
              />
            </Field>
          </div>

          <Field label="老师">
            <TeacherCombobox
              value={form.teacher}
              onChange={set("teacher")}
              teachers={selectOptions.teachers}
            />
          </Field>
          <Field label="课程类型">
            <CourseTypeSelect
              value={form.courseType}
              onChange={set("courseType")}
              courseTypes={selectOptions.courseTypes}
            />
          </Field>

          <Field label="年级">
            <PickSelect
              value={form.grade}
              onChange={set("grade")}
              placeholder="选择年级"
              options={selectOptions.grades}
            />
          </Field>
          <Field label="学员">
            <Input
              value={form.student}
              onChange={(e) => set("student")(e.target.value)}
              placeholder="学员姓名"
              className="h-8 text-sm"
            />
          </Field>

          <div className="col-span-2">
            <Field label="课程主题">
              <Input
                value={form.courseTheme}
                onChange={(e) => set("courseTheme")(e.target.value)}
                placeholder="课程主题"
                className="h-8 text-sm"
              />
            </Field>
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
                data-tour="dialog-delete"
              >
                {deleting ? "删除中…" : "删除课程"}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={saving || deleting}>
              取消
            </Button>
            <Button size="sm" disabled={saving || deleting} onClick={handleSave} data-tour="dialog-save">
              {saving ? "保存中…" : "保存"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

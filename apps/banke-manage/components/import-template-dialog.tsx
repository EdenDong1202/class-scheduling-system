"use client";

import { useState, useTransition, useRef } from "react";
import {
  Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle,
  RotateCcw, Download,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { importScheduleRecords } from "@/app/actions/schedule";
import type { ParseResponse, ParsedClassGroup } from "@/app/api/parse-class-template/route";

type Step = "upload" | "preview" | "done";

// ── Entry button ──────────────────────────────────────────────────
interface ImportTemplateButtonProps {
  onImported?: () => void;
}

export function ImportTemplateButton({ onImported }: ImportTemplateButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-1.5">
        <FileSpreadsheet className="h-3.5 w-3.5" />
        导入长期班
      </Button>
      <ImportTemplateDialog open={open} onOpenChange={setOpen} onImported={onImported} />
    </>
  );
}

// ── Dialog ────────────────────────────────────────────────────────
function ImportTemplateDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onImported?: () => void;
}) {
  const [step, setStep]               = useState<Step>("upload");
  const [isDragging, setIsDragging]   = useState(false);
  const [isParsing, setIsParsing]     = useState(false);
  const [isPending, startTransition]  = useTransition();
  const [result, setResult]           = useState<ParseResponse | null>(null);
  const [fileName, setFileName]       = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function resetToUpload() {
    setStep("upload");
    setResult(null);
    setFileName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleClose() {
    onOpenChange(false);
    setTimeout(resetToUpload, 250);
  }

  async function processFile(file: File) {
    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      toast.error("请上传 Excel 文件（.xlsx 或 .xls）");
      return;
    }
    setFileName(file.name);
    setIsParsing(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/parse-class-template", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "解析失败");
      setResult(data as ParseResponse);
      setStep("preview");
      if ((data as ParseResponse).errors.length > 0) {
        toast.warning(`解析完成，${(data as ParseResponse).errors.length} 条提示`, {
          description: (data as ParseResponse).errors[0],
        });
      }
    } catch (err) {
      toast.error("文件解析失败", {
        description: err instanceof Error ? err.message : "请检查文件格式是否正确",
      });
    } finally {
      setIsParsing(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }

  function handleConfirmImport() {
    if (!result?.records.length) return;
    startTransition(async () => {
      const res = await importScheduleRecords(result.records);
      if (res.success) {
        toast.success(`已导入 ${res.count} 条排课记录`, {
          description: `共 ${result.classes.length} 个班级，${result.totalRecords} 节课次`,
        });
        setStep("done");
        onImported?.();
      } else {
        toast.error("导入失败", { description: res.error });
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-5 pb-4 border-b shrink-0">
          <DialogTitle className="text-base font-semibold">导入长期班模板</DialogTitle>
        </DialogHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 min-h-0">
          {/* ── Step 1: Upload ─────────────────────────────────── */}
          {step === "upload" && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                上传长期班排课 Excel 文件，系统将自动识别小季度班，拆分为两个独立的长期班，并生成标准课程标题。
              </p>

              {/* Drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => !isParsing && fileInputRef.current?.click()}
                className={cn(
                  "border-2 border-dashed rounded-xl p-12 flex flex-col items-center gap-3 transition-colors",
                  isParsing ? "cursor-not-allowed opacity-70" : "cursor-pointer",
                  isDragging
                    ? "border-gray-400 bg-gray-50"
                    : "border-gray-200 hover:border-gray-300 hover:bg-gray-50/60"
                )}
              >
                {isParsing ? (
                  <>
                    <Loader2 className="h-10 w-10 text-gray-400 animate-spin" />
                    <p className="text-sm text-gray-500">正在解析文件…</p>
                  </>
                ) : (
                  <>
                    <Upload className="h-10 w-10 text-gray-300" />
                    <div className="text-center">
                      <p className="text-sm font-medium text-gray-700">点击上传或拖拽文件到此处</p>
                      <p className="text-xs text-gray-400 mt-1">支持 .xlsx、.xls 格式</p>
                    </div>
                  </>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
              />

              {/* Format reminder + download */}
              <div className="rounded-lg bg-gray-50 border px-4 py-3 text-xs text-gray-500 space-y-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <p className="font-medium text-gray-600">模板列顺序（与示例文件保持一致）</p>
                    <p>① 学季（暑季 / 寒季）&nbsp;&nbsp;② 年级 &nbsp;&nbsp;③ 班次级别（培优A+ / 培优S+ 等）</p>
                    <p>④ 主讲老师系统姓名 &nbsp;&nbsp;⑤ 上课时间预览</p>
                    <p>⑥ 上课日期（逗号分隔）&nbsp;&nbsp;⑦ 上课时间（逗号分隔，与日期一一对应）&nbsp;&nbsp;⑧ 教室 &nbsp;&nbsp;⑨ 缴费人数（填整数）</p>
                    <p className="text-gray-400 pt-0.5">
                      暑假班标题：暑假四年级A+二期&nbsp;·&nbsp;秋上班标题：秋上四年级A+
                    </p>
                  </div>
                  <a
                    href="/api/download-template"
                    download
                    onClick={(e) => e.stopPropagation()}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-300 bg-white text-gray-600 hover:border-gray-400 hover:text-gray-800 transition-colors text-xs font-medium"
                  >
                    <Download className="h-3.5 w-3.5" />
                    下载模板
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* ── Step 2: Preview ──────────────────────────────────── */}
          {step === "preview" && result && (
            <div className="space-y-4">
              {/* Summary bar */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    解析完成：
                    <span className="font-bold text-gray-900"> {result.classes.length} </span>
                    个班级，共
                    <span className="font-bold text-gray-900"> {result.totalRecords} </span>
                    条课次记录
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                    <FileSpreadsheet className="h-3 w-3" />
                    {fileName}
                  </p>
                </div>
                <button
                  onClick={resetToUpload}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  重新选择
                </button>
              </div>

              {/* Class table */}
              <div className="rounded-lg border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[620px]">
                    <thead>
                      <tr className="bg-gray-50 border-b">
                        <th className="text-left px-3 py-2.5 font-medium text-gray-500 w-[20%]">班级信息</th>
                        <th className="text-left px-3 py-2.5 font-medium text-amber-600 w-[26%]">暑假班 / 寒假班</th>
                        <th className="text-left px-3 py-2.5 font-medium text-orange-600 w-[26%]">秋上班 / 春上班</th>
                        <th className="text-left px-3 py-2.5 font-medium text-gray-500 w-[12%]">老师</th>
                        <th className="text-left px-3 py-2.5 font-medium text-gray-500 w-[8%]">教室</th>
                        <th className="text-right px-3 py-2.5 font-medium text-gray-500 w-[8%]">人数</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.classes.map((cls, i) => (
                        <ClassRow key={i} cls={cls} striped={i % 2 !== 0} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Warnings */}
              {result.errors.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    {result.errors.length} 条提示（不影响导入）
                  </div>
                  <ul className="space-y-0.5 list-disc list-inside">
                    {result.errors.map((e, i) => (
                      <li key={i} className="text-xs text-amber-600">{e}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* ── Step 3: Done ─────────────────────────────────────── */}
          {step === "done" && result && (
            <div className="flex flex-col items-center justify-center py-14 gap-3">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <p className="text-base font-semibold text-gray-800">导入成功</p>
              <p className="text-sm text-gray-500 text-center">
                已写入 <span className="font-bold text-gray-900">{result.totalRecords}</span> 条排课记录
                <br />
                共 <span className="font-bold text-gray-900">{result.classes.length}</span> 个班级，同步到排班看板
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t px-6 py-4 shrink-0">
          {(step === "upload" || step === "preview") && (
            <Button variant="outline" size="sm" onClick={handleClose} disabled={isParsing || isPending}>
              取消
            </Button>
          )}
          {step === "preview" && result && (
            <Button
              size="sm"
              onClick={handleConfirmImport}
              disabled={isPending || !result.records.length}
              className="gap-1.5 min-w-[140px]"
            >
              {isPending ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" />导入中…</>
              ) : (
                `确认导入 ${result.totalRecords} 条`
              )}
            </Button>
          )}
          {step === "done" && (
            <Button size="sm" onClick={handleClose}>
              完成
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Class row sub-component ───────────────────────────────────────
function ClassRow({ cls, striped }: { cls: ParsedClassGroup; striped: boolean }) {
  return (
    <tr className={cn("border-b last:border-0", striped ? "bg-gray-50/40" : "bg-white")}>
      {/* Original name */}
      <td className="px-3 py-2.5 text-gray-600 max-w-0">
        <span className="block truncate font-medium" title={cls.originalName}>{cls.originalName}</span>
        <span className="text-gray-400">{cls.grade}</span>
      </td>

      {/* Summer / Winter */}
      <td className="px-3 py-2.5">
        {cls.summer ? (
          <div>
            <p className="font-medium text-gray-800">{cls.summer.topic}</p>
            <p className="text-gray-400 mt-0.5">
              {cls.summer.dates.length} 节 · {cls.summer.timePreview}
            </p>
          </div>
        ) : (
          <span className="text-gray-300">—</span>
        )}
      </td>

      {/* Autumn / Spring */}
      <td className="px-3 py-2.5">
        {cls.autumn ? (
          <div>
            <p className="font-medium text-gray-800">{cls.autumn.topic}</p>
            <p className="text-gray-400 mt-0.5">
              {cls.autumn.dates.length} 节 · {cls.autumn.timePreview}
            </p>
          </div>
        ) : (
          <span className="text-gray-300">—</span>
        )}
      </td>

      <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap">{cls.teacher}</td>
      <td className="px-3 py-2.5 text-gray-700">{cls.classroom}</td>
      <td className="px-3 py-2.5 text-right text-gray-700 whitespace-nowrap">
        {cls.enrollment || <span className="text-gray-300">—</span>}
      </td>
    </tr>
  );
}

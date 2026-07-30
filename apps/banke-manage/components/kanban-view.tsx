"use client";

import { useEffect, useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { RefreshCw, BookOpen, Users, Clock, School } from "lucide-react";

interface ClassRow {
  topic: string;
  grade: string;
  teacher: string;
  classroom: string;
  time_slot: string | null;
  flex_time: string | null;
  students: string;
  session_count: string;
  start_date: string | null;
  end_date: string | null;
  record_count: string;
}

const GRADE_ORDER = ["新三", "新四", "新五", "新六", "新初一"];

function formatDate(d: string | null) {
  if (!d) return "—";
  return d.slice(0, 10);
}

function ClassCard({ row }: { row: ClassRow }) {
  const timeLabel = row.time_slot || row.flex_time || "时间待定";
  const studentList = row.students ? row.students.split("、").filter(Boolean) : [];
  const sessions = parseInt(row.session_count) || 0;
  const startStr = formatDate(row.start_date);
  const endStr = formatDate(row.end_date);

  return (
    <Card className="border border-border bg-card hover:shadow-md transition-shadow">
      <CardContent className="p-4 space-y-2.5">
        {/* Title + classroom */}
        <div className="flex items-start justify-between gap-2">
          <span className="font-semibold text-sm text-foreground leading-tight">
            {row.topic || "（未命名课程）"}
          </span>
          <Badge variant="outline" className="shrink-0 text-xs font-normal">
            {row.classroom}
          </Badge>
        </div>

        {/* Time slot */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="size-3.5 shrink-0" />
          <span className="truncate">{timeLabel}</span>
        </div>

        {/* Date range + sessions */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <BookOpen className="size-3.5 shrink-0" />
          <span>
            {startStr !== "—" ? `${startStr} ~ ${endStr}` : "日期未排"}
            {sessions > 0 && (
              <span className="ml-1 text-foreground font-medium">（{sessions} 节）</span>
            )}
          </span>
        </div>

        {/* Students */}
        {studentList.length > 0 && (
          <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Users className="size-3.5 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{studentList.join("、")}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function KanbanView() {
  const [rows, setRows] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gradeFilter, setGradeFilter] = useState("all");
  const [teacherFilter, setTeacherFilter] = useState("all");

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/kanban", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "加载失败");
      setRows(json.rows || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // All unique teachers and grades
  const allTeachers = useMemo(
    () => [...new Set(rows.map((r) => r.teacher).filter(Boolean))].sort(),
    [rows]
  );

  // Filtered rows
  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (gradeFilter !== "all" && r.grade !== gradeFilter) return false;
      if (teacherFilter !== "all" && r.teacher !== teacherFilter) return false;
      return true;
    });
  }, [rows, gradeFilter, teacherFilter]);

  // Group: grade → teacher → classes
  const grouped = useMemo(() => {
    const gradeMap = new Map<string, Map<string, ClassRow[]>>();

    // Preserve grade order
    const grades = GRADE_ORDER.filter((g) =>
      filtered.some((r) => r.grade === g)
    );
    // Add any grade not in GRADE_ORDER
    filtered.forEach((r) => {
      if (r.grade && !grades.includes(r.grade)) grades.push(r.grade);
    });

    grades.forEach((g) => gradeMap.set(g, new Map()));

    filtered.forEach((row) => {
      if (!row.grade) return;
      if (!gradeMap.has(row.grade)) gradeMap.set(row.grade, new Map());
      const teacherMap = gradeMap.get(row.grade)!;
      const t = row.teacher || "未分配";
      if (!teacherMap.has(t)) teacherMap.set(t, []);
      teacherMap.get(t)!.push(row);
    });

    return gradeMap;
  }, [filtered]);

  const totalClasses = filtered.length;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-3">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-28" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
        <p className="text-sm">加载失败：{error}</p>
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="mr-1.5 size-3.5" /> 重试
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={gradeFilter} onValueChange={setGradeFilter}>
          <SelectTrigger className="w-32 h-8 text-sm">
            <SelectValue placeholder="年级" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部年级</SelectItem>
            {GRADE_ORDER.filter((g) => rows.some((r) => r.grade === g)).map((g) => (
              <SelectItem key={g} value={g}>{g}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={teacherFilter} onValueChange={setTeacherFilter}>
          <SelectTrigger className="w-32 h-8 text-sm">
            <SelectValue placeholder="老师" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部老师</SelectItem>
            {allTeachers.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="text-xs text-muted-foreground ml-auto">
          共 {totalClasses} 个班级
        </span>

        <Button variant="ghost" size="sm" className="h-8 px-2" onClick={fetchData}>
          <RefreshCw className="size-3.5" />
        </Button>
      </div>

      {/* Empty state */}
      {totalClasses === 0 && (
        <div className="flex flex-col items-center gap-2 py-20 text-muted-foreground">
          <School className="size-10 opacity-30" />
          <p className="text-sm">暂无长期班数据，请先在「排班导入」中添加课程</p>
        </div>
      )}

      {/* Grouped content */}
      {Array.from(grouped.entries()).map(([grade, teacherMap]) => (
        <section key={grade} className="space-y-4">
          {/* Grade header */}
          <div className="flex items-center gap-2">
            <div className="h-5 w-1 rounded-full bg-primary" />
            <h2 className="text-base font-bold text-foreground">{grade}</h2>
            <span className="text-xs text-muted-foreground">
              {Array.from(teacherMap.values()).flat().length} 个班
            </span>
          </div>

          {Array.from(teacherMap.entries()).map(([teacher, classes]) => (
            <div key={teacher} className="pl-3 space-y-2">
              {/* Teacher sub-header */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">{teacher}</span>
                <span className="text-xs text-muted-foreground">{classes.length} 班</span>
              </div>
              {/* Class cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {classes.map((row, idx) => (
                  <ClassCard key={`${grade}-${teacher}-${idx}`} row={row} />
                ))}
              </div>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

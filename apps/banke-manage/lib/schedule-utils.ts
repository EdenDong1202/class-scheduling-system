// Pure utility types and helpers for long-term class scheduling
// No "use server" — can be imported anywhere

// ── Timezone helpers ─────────────────────────────────────────────
// Teable stores date-only fields as UTC midnight of the LOCAL (Asia/Shanghai)
// date, e.g.  2025-03-01 00:00 CST  →  2025-02-28T16:00:00.000Z
// Using local JS Date methods on these timestamps gives the wrong UTC date.
// Fix: always shift by +8h so getUTC* methods return the Shanghai date parts.
const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000; // UTC+8, no DST

/** Return a Date whose UTC fields represent the Asia/Shanghai local time. */
export function toShanghaiDate(iso: string): Date {
  return new Date(new Date(iso).getTime() + SHANGHAI_OFFSET_MS);
}

export type TermType = "winter" | "spring" | "summer" | "autumn";

export interface LessonRecord {
  id: string;
  student: string;
  grade: string;
  teacher: string;
  date: string;
  classroom: string;
  timeSlot: string;
  notes: string;
  topic: string;
  courseType: string;
}

export interface TermInfo {
  type: TermType;
  label: string;
  year: number;
  expectedCount: number;
  colorClass: string;
  bgClass: string;
  barClass: string;
}

export interface StudentTermSchedule {
  key: string;
  topic: string;      // 课程主题 — used as card title
  student: string;    // enrollment info, e.g. "12人"
  grade: string;
  teacher: string;
  classroom: string;
  timeSlot: string;
  flexTime: string;
  courseType: string; // 长期班 | 短期班
  term: TermInfo;
  lessons: LessonRecord[];
}

export interface ScheduleStats {
  /** 当前所有长期班课程组数量 */
  totalGroups: number;
  /** 已开课但尚未结课的课程组数量（有课次已过去，且仍有未来/今日课次） */
  ongoingGroups: number;
  /** 当期在读人数合计（解析各组 student 字段的数字部分求和） */
  activeStudentCount: number;
  uniqueTeachers: number;
  /** 所有课次日期均已过去（全部上完）的课程组数量 */
  completedGroups: number;
}

export const TERM_DEFS: Record<TermType, {
  label: string; months: number[]; expectedCount: number;
  colorClass: string; bgClass: string; barClass: string;
}> = {
  winter: {
    label: "寒季", months: [1, 2], expectedCount: 7,
    colorClass: "text-sky-700",
    bgClass: "bg-sky-50 border-sky-200",
    barClass: "bg-sky-400",
  },
  spring: {
    label: "春季", months: [3, 4, 5, 6], expectedCount: 15,
    colorClass: "text-emerald-700",
    bgClass: "bg-emerald-50 border-emerald-200",
    barClass: "bg-emerald-400",
  },
  summer: {
    label: "暑季", months: [7, 8], expectedCount: 10,
    colorClass: "text-amber-700",
    bgClass: "bg-amber-50 border-amber-200",
    barClass: "bg-amber-400",
  },
  autumn: {
    label: "秋季", months: [9, 10, 11, 12], expectedCount: 15,
    colorClass: "text-orange-700",
    bgClass: "bg-orange-50 border-orange-200",
    barClass: "bg-orange-400",
  },
};

export function classifyTerm(isoDate: string): TermInfo {
  // Use Shanghai date parts — NOT local/UTC — to get the correct month & year
  const d = toShanghaiDate(isoDate);
  const month = d.getUTCMonth() + 1;
  const year = d.getUTCFullYear();
  for (const [k, def] of Object.entries(TERM_DEFS) as [TermType, typeof TERM_DEFS[TermType]][]) {
    if (def.months.includes(month)) {
      return { type: k, label: def.label, year, expectedCount: def.expectedCount, colorClass: def.colorClass, bgClass: def.bgClass, barClass: def.barClass };
    }
  }
  const def = TERM_DEFS.autumn;
  return { type: "autumn", label: def.label, year, expectedCount: def.expectedCount, colorClass: def.colorClass, bgClass: def.bgClass, barClass: def.barClass };
}

/**
 * Strip the per-lesson lecture suffix added by the naming convention
 * (e.g. "五年级A一期·第3讲" → "五年级A一期") so records from the same
 * class are grouped together even though each record has a unique topic.
 */
function baseGroupTopic(topic: string): string {
  return topic.replace(/·第\d+讲$/, "").trim();
}

export function buildScheduleGroups(rows: Record<string, unknown>[]): StudentTermSchedule[] {
  const groupMap = new Map<string, StudentTermSchedule>();

  for (const row of rows) {
    const lesson: LessonRecord = {
      id:         (row["id"] as string) ?? "",
      student:    (row["student"] as string) ?? "",
      grade:      (row["grade"] as string) ?? "",
      teacher:    (row["teacher"] as string) ?? "",
      date:       (row["date"] as string) ?? "",
      classroom:  (row["classroom"] as string) ?? "",
      timeSlot:   (row["timeSlot"] as string) ?? "",
      notes:      (row["notes"] as string) ?? "",
      topic:      (row["topic"] as string) ?? "",
      courseType: (row["courseType"] as string) ?? "",
    };

    if (!lesson.date) continue;

    // Use the base name (without ·第N讲) for grouping so all lessons of the
    // same class land in one card regardless of their individual lecture numbers.
    const baseTopic = baseGroupTopic(lesson.topic);

    const term = classifyTerm(lesson.date);
    // Group key: a "class" is uniquely identified by its base topic + student(enrollment) +
    // teacher + term + time-slot. Using "||" as separator to minimise collision risk.
    const timeKey = lesson.timeSlot || lesson.notes || "";
    const key = [baseTopic, lesson.student, lesson.teacher, term.type, term.year, timeKey].join("||");

    if (!groupMap.has(key)) {
      groupMap.set(key, {
        key,
        topic:      baseTopic,        // card title = base name without ·第N讲
        student:    lesson.student,
        grade:      lesson.grade,
        teacher:    lesson.teacher,
        classroom:  lesson.classroom,
        timeSlot:   lesson.timeSlot,
        flexTime:   lesson.notes,
        courseType: lesson.courseType,
        term,
        lessons: [],
      });
    }

    const schedule = groupMap.get(key)!;
    schedule.lessons.push(lesson);
    // Keep first non-empty value for each metadata field
    if (!schedule.topic     && baseTopic)        schedule.topic     = baseTopic;
    if (!schedule.grade     && lesson.grade)     schedule.grade     = lesson.grade;
    if (!schedule.teacher   && lesson.teacher)   schedule.teacher   = lesson.teacher;
    if (!schedule.classroom && lesson.classroom) schedule.classroom = lesson.classroom;
    if (!schedule.timeSlot  && lesson.timeSlot)  schedule.timeSlot  = lesson.timeSlot;
    if (!schedule.flexTime  && lesson.notes)     schedule.flexTime  = lesson.notes;
  }

  const termOrder: Record<TermType, number> = { autumn: 0, summer: 1, winter: 2, spring: 3 };
  return Array.from(groupMap.values()).sort((a, b) => {
    if (b.term.year !== a.term.year) return b.term.year - a.term.year;
    const td = termOrder[a.term.type] - termOrder[b.term.type];
    if (td !== 0) return td;
    return a.student.localeCompare(b.student, "zh");
  });
}

/** ISO date string (YYYY-MM-DD) for today in Asia/Shanghai (UTC+8). */
export function todayShanghai(): string {
  const now = new Date(Date.now() + SHANGHAI_OFFSET_MS);
  return [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    String(now.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

/** Convert a Teable ISO datetime to a YYYY-MM-DD date string in Shanghai. */
export function lessonDateStr(isoDate: string): string {
  const d = toShanghaiDate(isoDate);
  return [
    d.getUTCFullYear(),
    String(d.getUTCMonth() + 1).padStart(2, "0"),
    String(d.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

export type ScheduleStatus = "pending" | "ongoing" | "completed";

/** Derive the teaching status for a schedule group based on today's date. */
export function getScheduleStatus(
  schedule: StudentTermSchedule,
  today: string
): ScheduleStatus {
  const dates = schedule.lessons
    .map((l) => lessonDateStr(l.date))
    .filter(Boolean)
    .sort();
  if (!dates.length) return "pending";
  const firstDate = dates[0];
  const lastDate  = dates[dates.length - 1];
  if (lastDate  <  today) return "completed";
  if (firstDate <= today) return "ongoing";
  return "pending";
}

export function computeStats(schedules: StudentTermSchedule[]): ScheduleStats {
  const teachers = new Set<string>();
  let ongoingGroups = 0;
  let completedGroups = 0;
  let activeStudentCount = 0;

  const today = todayShanghai();

  for (const s of schedules) {
    if (s.teacher) teachers.add(s.teacher);

    if (s.lessons.length > 0) {
      // Sort all lesson dates to find first / last
      const dates = s.lessons
        .map((l) => lessonDateStr(l.date))
        .filter(Boolean)
        .sort();

      const firstDate = dates[0];
      const lastDate  = dates[dates.length - 1];

      // 已结课: last lesson is strictly before today (当天算正在授课)
      // 正在授课: first lesson has arrived (≤ today) AND last lesson is today or future
      const isCompleted = lastDate  <  today;
      const hasStarted  = firstDate <= today;

      if (isCompleted) {
        completedGroups++;
      } else if (hasStarted) {
        // First lesson started (today or earlier), last lesson not yet past
        ongoingGroups++;
      }
      // else: 全部在未来，尚未开课 → 不计入
    }

    // 在读人数：直接解析数字字段并累加
    const n = parseInt(s.student, 10);
    if (!isNaN(n)) activeStudentCount += n;
  }

  return {
    totalGroups: schedules.length,
    ongoingGroups,
    activeStudentCount,
    uniqueTeachers: teachers.size,
    completedGroups,
  };
}

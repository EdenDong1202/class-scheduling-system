"use server";

import { unstable_cache, revalidateTag } from "next/cache";
import { sqlQuery, createRecord, updateRecord, deleteRecord } from "@/lib/teable";
import { request } from "@/lib/request";
import { broadcast } from "@/lib/sync-clients";

/* ─── Teable resource IDs (override via .env for your own base) ─ */
const BASE_ID  = process.env.TEABLE_BASE_ID  ?? "YOUR_TEABLE_BASE_ID";
const TABLE_ID = process.env.TEABLE_TABLE_ID ?? "YOUR_TEABLE_TABLE_ID";

/* ─── Retry helper ────────────────────────────────────────── */

async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 500,
): Promise<T> {
  let lastError: Error = new Error("unknown");
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      const isTransient =
        lastError.message.includes("transaction") ||
        lastError.message.includes("read only check") ||
        lastError.message.includes("snapshot");
      if (!isTransient || attempt === maxAttempts - 1) throw lastError;
      await new Promise((r) => setTimeout(r, baseDelayMs * (attempt + 1)));
    }
  }
  throw lastError;
}

/* ─── Timezone helpers (Asia/Shanghai = UTC+8) ───────────── */

/** UTC ISO string → YYYY-MM-DD in Asia/Shanghai */
function utcToShanghaiDate(utcStr: string): string {
  const ms = new Date(utcStr).getTime() + 8 * 60 * 60 * 1000;
  return new Date(ms).toISOString().split("T")[0];
}

/** YYYY-MM-DD (Shanghai) → UTC ISO string (midnight Shanghai = T16:00:00.000Z prev day) */
function shanghaiDateToUtc(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00+08:00`).toISOString();
}

/* ─── Schedule records ────────────────────────────────────── */

export interface ScheduleRecord {
  id: string;
  date: string;
  classroom: string;
  timePeriod: string | null;
  teacher: string | null;
  student: string | null;
  courseTheme: string | null;
  courseType: string | null;
  grade: string | null;
  flexTime: string | null;
}

const fetchScheduleCached = unstable_cache(
  async (startDate: string, endDateExclusive: string): Promise<ScheduleRecord[]> => {
    const { rows } = await withRetry(() =>
      sqlQuery(
        BASE_ID,
        `SELECT "__id", "Ri_Qi", "Jiao_Shi", "Shi_Duan", "Lao_Shi", "Xue_Sheng",
                "Ke_Cheng_Zhu_Ti", "Ke_Cheng_Lei_Xing", "Nian_Ji", "Bei_Zhu"
         FROM "${BASE_ID}"."Sheet1"
         WHERE "Ri_Qi" >= '${shanghaiDateToUtc(startDate)}'
           AND "Ri_Qi" < '${shanghaiDateToUtc(endDateExclusive)}'
           AND "Jiao_Shi" IS NOT NULL
           AND "Jiao_Shi" != '不存在'
           AND "Ri_Qi" IS NOT NULL
           AND ("Ke_Cheng_Lei_Xing" IS NULL OR "Ke_Cheng_Lei_Xing" != '希望杯冲刺课')
         ORDER BY "Ri_Qi", "Jiao_Shi", "Shi_Duan"
         LIMIT 2000`,
      ),
    );

    return (rows as Record<string, unknown>[])
      .map((r) => ({
        id:          r.__id as string,
        date:        r.Ri_Qi ? utcToShanghaiDate(r.Ri_Qi as string) : "",
        classroom:   (r.Jiao_Shi as string) || "",
        timePeriod:  (r.Shi_Duan as string | null) || null,
        teacher:     (r.Lao_Shi as string | null) || null,
        student:     (r.Xue_Sheng as string | null) || null,
        courseTheme: (r.Ke_Cheng_Zhu_Ti as string | null) || null,
        courseType:  (r.Ke_Cheng_Lei_Xing as string | null) || null,
        grade:       (r.Nian_Ji as string | null) || null,
        flexTime:    (r.Bei_Zhu as string | null) || null,
      }))
      .filter((r) => r.date && r.classroom);
  },
  ["schedule"],
  { tags: ["schedule"], revalidate: 5 },
);

export async function fetchSchedule(
  startDate: string,
  endDateExclusive: string,
): Promise<ScheduleRecord[]> {
  return fetchScheduleCached(startDate, endDateExclusive);
}

/* ─── Field IDs ───────────────────────────────────────────── */

const F = {
  student:     "fldPyAe0vkAnPS90WVk",
  grade:       "fldob9JTgLMq4YOUnrL",
  courseType:  "fldwo6WlpeYx1xRkBH4",
  teacher:     "fldcxFb6o3ImFmOoZwR",
  date:        "fldoXA1f70MlokbiNEg",
  flexTime:    "fldBp7vbc7C6657mZjM",
  classroom:   "fldiUQuvtzRjCRQKWMp",
  timePeriod:  "fldtOTWeGoeizRxF6nz",
  courseTheme: "fldycyssuHvhmbl09QP",
} as const;

/* ─── Dynamic select options (from field definitions) ────── */

export interface SelectOptions {
  teachers:    string[];
  courseTypes: string[];
  grades:      string[];
  classrooms:  string[];
  timePeriods: string[];
}

interface FieldDef {
  id: string;
  type: string;
  options?: { choices?: { name: string }[] };
}

const fetchSelectOptionsCached = unstable_cache(
  async (): Promise<SelectOptions> => {
    // Fetch field definitions — choices are the canonical option list,
    // independent of whether any record currently uses them.
    const fields = await withRetry(() =>
      request<FieldDef[]>(`/table/${TABLE_ID}/field`),
    );

    const choices = (fieldId: string): string[] =>
      fields.find(f => f.id === fieldId)?.options?.choices?.map(c => c.name) ?? [];

    return {
      teachers:    choices(F.teacher),
      // 全体事项 and 个人事项 are event types, not schedulable courses — exclude from course dropdowns
      courseTypes: choices(F.courseType).filter(c => c !== "全体事项" && c !== "个人事项"),
      grades:      choices(F.grade),
      classrooms:  choices(F.classroom).filter(c => c !== "不存在"),
      timePeriods: choices(F.timePeriod),
    };
  },
  ["select-options"],
  { tags: ["schedule"], revalidate: 5 },
);

export async function fetchSelectOptions(): Promise<SelectOptions> {
  return fetchSelectOptionsCached();
}

/* ─── Event records (课程类型 = "全体事项") ─────────────────── */

export interface EventRecord {
  id: string;
  date: string;
  timePeriod: string | null;
  content: string | null; // 课程主题
}

const fetchEventsCached = unstable_cache(
  async (startDate: string, endDateExclusive: string): Promise<EventRecord[]> => {
    const { rows } = await withRetry(() =>
      sqlQuery(
        BASE_ID,
        `SELECT "__id", "Ri_Qi", "Bei_Zhu", "Ke_Cheng_Zhu_Ti"
         FROM "${BASE_ID}"."Sheet1"
         WHERE "Ke_Cheng_Lei_Xing" = '全体事项'
           AND "Ri_Qi" >= '${shanghaiDateToUtc(startDate)}'
           AND "Ri_Qi" < '${shanghaiDateToUtc(endDateExclusive)}'
           AND "Ri_Qi" IS NOT NULL
         ORDER BY "Ri_Qi"`,
      ),
    );
    return (rows as Record<string, unknown>[])
      .map((r) => ({
        id:         r.__id as string,
        date:       r.Ri_Qi ? utcToShanghaiDate(r.Ri_Qi as string) : "",
        timePeriod: (r.Bei_Zhu as string | null) || null,
        content:    (r.Ke_Cheng_Zhu_Ti as string | null) || null,
      }))
      .filter((r) => r.date);
  },
  ["events"],
  { tags: ["schedule"], revalidate: 5 },
);

export async function fetchEvents(
  startDate: string,
  endDateExclusive: string,
): Promise<EventRecord[]> {
  return fetchEventsCached(startDate, endDateExclusive);
}

/* ─── Write helpers ──────────────────────────────────────── */

/** 使 Next.js 缓存失效，并立刻通知所有在线客户端刷新。 */
function revalidateAndBroadcast() {
  revalidateTag("schedule");
  broadcast();
}

/* ─── Write ───────────────────────────────────────────────── */

export interface CourseFormData {
  date:        string;
  classroom:   string;
  timePeriod:  string;
  teacher:     string;
  courseType:  string;
  grade:       string;
  student:     string;
  courseTheme: string;
  flexTime:    string;
}

function orNull(v: string): string | null {
  return v.trim() || null;
}

export async function saveCourse(
  recordId: string | null,
  data: CourseFormData,
): Promise<{ success: boolean; recordId?: string; error?: string }> {
  try {
    const fields = {
      [F.date]:        data.date ? shanghaiDateToUtc(data.date) : null,
      [F.classroom]:   orNull(data.classroom),
      [F.timePeriod]:  orNull(data.timePeriod),
      [F.teacher]:     orNull(data.teacher),
      [F.courseType]:  orNull(data.courseType),
      [F.grade]:       orNull(data.grade),
      [F.student]:     orNull(data.student),
      [F.courseTheme]: orNull(data.courseTheme),
      [F.flexTime]:    orNull(data.flexTime),
    };
    if (recordId) {
      await withRetry(() => updateRecord(TABLE_ID, recordId, fields));
    } else {
      const record = await withRetry(() => createRecord(TABLE_ID, fields));
      revalidateAndBroadcast();
      return { success: true, recordId: record.id };
    }
    revalidateAndBroadcast();
    return { success: true, recordId };
  } catch (e) {
    console.error("saveCourse error", e);
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export interface EventFormData {
  date:       string;
  timePeriod: string;
  content:    string;
}

export async function saveEvent(
  recordId: string | null,
  data: EventFormData,
): Promise<{ success: boolean; recordId?: string; error?: string }> {
  try {
    const fields = {
      [F.date]:        data.date ? shanghaiDateToUtc(data.date) : null,
      [F.flexTime]:    orNull(data.timePeriod), // free-text time → 灵活时间 (plain text, not singleSelect)
      [F.timePeriod]:  null,                    // clear 时段 singleSelect so it stays clean
      [F.courseTheme]: orNull(data.content),
      [F.courseType]:  "全体事项",
    };
    if (recordId) {
      await withRetry(() => updateRecord(TABLE_ID, recordId, fields));
    } else {
      const record = await withRetry(() => createRecord(TABLE_ID, fields));
      revalidateAndBroadcast();
      return { success: true, recordId: record.id };
    }
    revalidateAndBroadcast();
    return { success: true, recordId: recordId ?? undefined };
  } catch (e) {
    console.error("saveEvent error", e);
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export interface PersonalEventFormData {
  date:       string;
  timeMode:   "allday" | "custom";
  timeCustom: string;
  classroom:  string;
  teacher:    string;
}

export async function savePersonalEvent(
  recordId: string | null,
  data: PersonalEventFormData,
): Promise<{ success: boolean; recordId?: string; error?: string }> {
  try {
    const flexTimeValue = data.timeMode === "allday" ? "全天" : orNull(data.timeCustom);
    const fields = {
      [F.date]:        data.date ? shanghaiDateToUtc(data.date) : null,
      [F.classroom]:   orNull(data.classroom),
      [F.teacher]:     orNull(data.teacher),
      [F.courseType]:  "个人事项",
      [F.flexTime]:    flexTimeValue,
      [F.timePeriod]:  null,
      [F.student]:     null,
      [F.grade]:       null,
      [F.courseTheme]: null,
    };
    if (recordId) {
      await withRetry(() => updateRecord(TABLE_ID, recordId, fields));
    } else {
      const record = await withRetry(() => createRecord(TABLE_ID, fields));
      revalidateAndBroadcast();
      return { success: true, recordId: record.id };
    }
    revalidateAndBroadcast();
    return { success: true, recordId: recordId ?? undefined };
  } catch (e) {
    console.error("savePersonalEvent error", e);
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function deleteCourse(
  recordId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await withRetry(() => deleteRecord(TABLE_ID, recordId));
    revalidateAndBroadcast();
    return { success: true };
  } catch (e) {
    console.error("deleteCourse error", e);
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

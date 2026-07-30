"use server";

import { unstable_cache, revalidatePath, revalidateTag } from "next/cache";
import { sqlQuery, getFields, createRecords, updateRecords, deleteRecords } from "@/lib/teable";
import { buildScheduleGroups } from "@/lib/schedule-utils";
import type { StudentTermSchedule } from "@/lib/schedule-utils";

export type { StudentTermSchedule, LessonRecord, TermInfo, TermType, ScheduleStats } from "@/lib/schedule-utils";

const TABLE_ID = process.env.TEABLE_TABLE_ID ?? "YOUR_TEABLE_TABLE_ID";
const BASE_ID  = process.env.TEABLE_BASE_ID ?? "YOUR_TEABLE_BASE_ID";
const DB_TABLE = `"${BASE_ID}"."Sheet1"`;

// Cache tag — used by revalidateTag() to purge schedule data
const SCHEDULES_TAG = "long-term-schedules";

const FIELD_IDS = {
  topic:      "fldycyssuHvhmbl09QP",
  student:    "fldPyAe0vkAnPS90WVk",
  date:       "fldoXA1f70MlokbiNEg",
  grade:      "fldob9JTgLMq4YOUnrL",
  courseType: "fldwo6WlpeYx1xRkBH4",
  teacher:    "fldcxFb6o3ImFmOoZwR",
  classroom:  "fldiUQuvtzRjCRQKWMp",
  timeSlot:   "fldtOTWeGoeizRxF6nz",
  flexTime:   "fldBp7vbc7C6657mZjM",
};

// ── Read: fetch all 长期班 records and group by student+term ──────
// No caching layer — always queries Teable directly so that router.refresh()
// from the client-side auto-poll always returns the latest data.
export async function fetchLongTermSchedules(): Promise<StudentTermSchedule[]> {
  const { rows } = await sqlQuery(
    BASE_ID,
    `SELECT
      "__id"                AS id,
      "Xue_Sheng"           AS student,
      "Nian_Ji"             AS grade,
      "Lao_Shi"             AS teacher,
      "Ri_Qi"               AS date,
      "Jiao_Shi"            AS classroom,
      "Shi_Duan"            AS "timeSlot",
      "Bei_Zhu"             AS notes,
      "Ke_Cheng_Zhu_Ti"     AS topic,
      "Ke_Cheng_Lei_Xing"   AS "courseType"
    FROM ${DB_TABLE}
    WHERE "Ke_Cheng_Lei_Xing" IN ('长期班', '短期班')
    ORDER BY "Xue_Sheng" ASC, "Ri_Qi" ASC
    LIMIT 2000`
  );

  return buildScheduleGroups(rows);
}

// ── Sync: invalidate the schedule cache so the next request re-fetches ──
export async function syncSchedules(): Promise<void> {
  revalidateTag(SCHEDULES_TAG, { expire: 0 });
  revalidatePath("/", "page");
}

// ── Field options: read singleSelect choices from the table schema ──
export interface ScheduleFieldOptions {
  grades:      string[];
  teachers:    string[];
  classrooms:  string[];
  timeSlots:   string[];
  courseTypes: string[];
}

export const fetchScheduleFieldOptions = unstable_cache(
  async (): Promise<ScheduleFieldOptions> => {
    const fields = await getFields(TABLE_ID);
    const choices = (fieldId: string) =>
      fields.find((f) => f.id === fieldId)?.options?.choices?.map((c) => c.name) ?? [];
    return {
      grades:      choices(FIELD_IDS.grade),
      teachers:    choices(FIELD_IDS.teacher),
      classrooms:  choices(FIELD_IDS.classroom),
      timeSlots:   choices(FIELD_IDS.timeSlot),
      courseTypes: choices(FIELD_IDS.courseType),
    };
  },
  ["schedule-field-options"],
  { revalidate: 3600 } // field schema rarely changes — cache for 1 hour
);

// ── Write: import new schedule records into 排课总台账 ────────────
export interface ImportRecordInput {
  student: string;
  date: string;       // YYYY-MM-DD
  grade: string;
  teacher: string;
  classroom: string;
  timeSlot?: string;
  flexTime?: string;
  topic?: string;
  courseType?: string;
}

export async function importScheduleRecords(
  records: ImportRecordInput[]
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    if (!records.length) throw new Error("没有可导入的记录");

    // Sort by date and assign per-topic-group lecture numbers (·第N讲)
    const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
    const lectCounters = new Map<string, number>();
    const numbered = sorted.map((r) => {
      const base = r.topic ?? "";
      const n = (lectCounters.get(base) ?? 0) + 1;
      lectCounters.set(base, n);
      return { ...r, topic: base ? `${base}·第${n}讲` : "" };
    });

    const BATCH = 200;
    let totalCreated = 0;

    for (let i = 0; i < numbered.length; i += BATCH) {
      const batch = numbered.slice(i, i + BATCH);
      const result = await createRecords(
        TABLE_ID,
        batch.map((r) => ({
          fields: {
            [FIELD_IDS.student]:    r.student,
            [FIELD_IDS.date]:       r.date,
            [FIELD_IDS.grade]:      r.grade,
            [FIELD_IDS.courseType]: r.courseType ?? "长期班",
            [FIELD_IDS.teacher]:    r.teacher,
            [FIELD_IDS.classroom]:  r.classroom,
            ...(r.timeSlot ? { [FIELD_IDS.timeSlot]: r.timeSlot } : {}),
            ...(r.flexTime ? { [FIELD_IDS.flexTime]: r.flexTime } : {}),
            ...(r.topic    ? { [FIELD_IDS.topic]:    r.topic    } : {}),
          },
        }))
      );
      totalCreated += result.records.length;
    }

    revalidateTag(SCHEDULES_TAG, { expire: 0 });
    revalidatePath("/", "page");
    return { success: true, count: totalCreated };
  } catch (err) {
    return { success: false, count: 0, error: err instanceof Error ? err.message : "导入失败，请重试" };
  }
}

// ── Update: edit an existing group (metadata + add/remove dates) ─
export interface GroupMeta {
  topic: string;
  student: string;
  grade: string;
  teacher: string;
  classroom: string;
  timeSlot: string;
  flexTime: string;
}

export async function updateScheduleGroup(params: {
  /** IDs of all existing lesson records before any edits */
  existingIds: string[];
  /** Dates for each existing lesson (used for renumbering) */
  existingLessons: { id: string; date: string }[];
  meta: GroupMeta;
  /** New date strings (YYYY-MM-DD) to create as fresh records */
  newDates: string[];
  /** Record IDs to delete */
  deleteIds: string[];
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { existingIds, existingLessons, meta, newDates, deleteIds } = params;
    const baseTopic = meta.topic; // already the base name (no ·第N讲)

    // 1. Remove deleted lessons
    if (deleteIds.length) {
      await deleteRecords(TABLE_ID, deleteIds);
    }

    // 2. Build a fully-sorted timeline: remaining existing lessons + new dates
    const deleteSet = new Set(deleteIds);
    const keepLessons = existingLessons
      .filter((l) => !deleteSet.has(l.id))
      .map((l) => ({ kind: "existing" as const, id: l.id, date: l.date }));
    const newEntries = newDates.map((date) => ({ kind: "new" as const, id: "", date }));

    const timeline = [...keepLessons, ...newEntries].sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    // 3. Assign sequential ·第N讲 numbers across the full sorted timeline
    const nonTopicFields = {
      ...(meta.student   ? { [FIELD_IDS.student]:   meta.student   } : {}),
      ...(meta.grade     ? { [FIELD_IDS.grade]:     meta.grade     } : {}),
      ...(meta.teacher   ? { [FIELD_IDS.teacher]:   meta.teacher   } : {}),
      ...(meta.classroom ? { [FIELD_IDS.classroom]: meta.classroom } : {}),
      ...(meta.timeSlot  ? { [FIELD_IDS.timeSlot]:  meta.timeSlot  } : {}),
      ...(meta.flexTime  ? { [FIELD_IDS.flexTime]:  meta.flexTime  } : {}),
    };

    const existingUpdates: { id: string; fields: Record<string, string> }[] = [];
    const newCreates: { date: string; topic: string }[] = [];

    timeline.forEach((entry, idx) => {
      const topic = baseTopic ? `${baseTopic}·第${idx + 1}讲` : "";
      if (entry.kind === "existing") {
        existingUpdates.push({
          id: entry.id,
          fields: { ...(topic ? { [FIELD_IDS.topic]: topic } : {}), ...nonTopicFields },
        });
      } else {
        newCreates.push({ date: entry.date, topic });
      }
    });

    // 4. Batch-update existing records (topic renumbered + other metadata)
    const BATCH = 200;
    for (let i = 0; i < existingUpdates.length; i += BATCH) {
      await updateRecords(TABLE_ID, existingUpdates.slice(i, i + BATCH));
    }

    // 5. Create new lesson records with correct ·第N讲 numbers
    for (let i = 0; i < newCreates.length; i += BATCH) {
      await createRecords(
        TABLE_ID,
        newCreates.slice(i, i + BATCH).map(({ date, topic }) => ({
          fields: {
            [FIELD_IDS.courseType]: "长期班",
            [FIELD_IDS.date]:       date,
            ...(topic ? { [FIELD_IDS.topic]: topic } : {}),
            ...nonTopicFields,
          },
        }))
      );
    }

    revalidateTag(SCHEDULES_TAG, { expire: 0 });
    revalidatePath("/", "page");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "保存失败，请重试" };
  }
}

// ── Delete: remove all lesson records for a schedule group ────────
export async function deleteScheduleGroup(
  lessonIds: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!lessonIds.length) throw new Error("没有可删除的记录");
    await deleteRecords(TABLE_ID, lessonIds);
    revalidateTag(SCHEDULES_TAG, { expire: 0 });
    revalidatePath("/", "page");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "删除失败，请重试" };
  }
}

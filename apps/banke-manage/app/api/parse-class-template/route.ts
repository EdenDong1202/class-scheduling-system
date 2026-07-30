import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";

// ── System reference data ─────────────────────────────────────────
const SYSTEM_TEACHERS = [
  "杨洋", "王佳旭", "亚森", "程奕力", "何先骐", "赵钦", "董昊琦", "黄培权",
];

// Raw time string → timeSlot option value (must match schema exactly)
const TIME_SLOT_MAP: Record<string, string> = {
  "08:00-10:00": "A段 08:00-10:00",
  "10:20-12:20": "B段 10:20-12:20",
  "13:10-15:10": "C段 13:10-15:10",
  "15:30-17:30": "D段 15:30-17:30",
  "18:20-20:20": "E段 18:20-20:20",
  "9:30-12:00":  "S-A段 9:30-12:00",
  "09:30-12:00": "S-A段 9:30-12:00",
  "12:30-15:00": "S-B段 12:30-15:00",
  "15:20-17:50": "S-C段 15:20-17:50",
  "18:00-20:30": "S-D段 18:00-20:30",
};

// ── Helpers ───────────────────────────────────────────────────────

function mapTeacher(excelName: string): string {
  if (!excelName) return "";
  if (SYSTEM_TEACHERS.includes(excelName)) return excelName;
  // Strip trailing digits/ASCII (e.g. "杨洋389171" → "杨洋")
  const stripped = excelName.replace(/[0-9a-zA-Z]+/g, "").trim();
  if (SYSTEM_TEACHERS.includes(stripped)) return stripped;
  // Substring match (e.g. "亚库普亚森" contains "亚森")
  const found = SYSTEM_TEACHERS.find((n) => excelName.includes(n));
  return found ?? excelName;
}

function mapClassroom(raw: string): string {
  if (!raw) return "";
  // "英联201" → "201"
  const m = raw.match(/\d+/);
  return m ? m[0] : raw;
}

/** "培优A+" → "A+", "培优S+" → "S+", "培优A" → "A" */
function extractLevel(raw: string): string {
  if (!raw) return "";
  // Remove common Chinese prefixes
  return raw.replace(/^(培优|提高|基础|尖子)/g, "").trim();
}

/** Extract period indicator (一期/二期/三期) from time-preview string */
function parsePeriod(preview: string): string {
  const m = preview.match(/^([一二三四五六七八九十]+期)/);
  return m?.[1] ?? "";
}

/** "2026-07-13" → "26" */
function twoDigitYear(dateStr: string): string {
  return String(dateStr).substring(2, 4);
}

/** Month number of a YYYY-MM-DD string */
function getMonth(dateStr: string): number {
  return parseInt(String(dateStr).substring(5, 7), 10);
}

/** 暑季: 7/8月 = 暑假, 9月以后 = 秋上 */
function isSummerDate(dateStr: string): boolean {
  const m = getMonth(dateStr);
  return m === 7 || m === 8;
}

/** 寒季: 1/2月 = 寒假, 3月以后 = 春上 */
function isWinterDate(dateStr: string): boolean {
  const m = getMonth(dateStr);
  return m === 1 || m === 2;
}

function mapTimeSlot(time: string): { timeSlot?: string; flexTime?: string } {
  const t = time.trim();
  const slot = TIME_SLOT_MAP[t];
  return slot ? { timeSlot: slot } : { flexTime: t };
}

// ── Public types (mirrored in dialog component) ───────────────────
export interface ParsedClassGroup {
  /** Display label: 年级 + 班次级别 + 期次, e.g. "四年级 培优A+ 二期" */
  originalName: string;
  teacher: string;
  classroom: string;
  grade: string;
  /** Enrollment string, e.g. "8人" — written to the 学生 field */
  enrollment: string;
  summer?: {
    topic: string;
    dates: string[];
    timePreview: string;
  };
  autumn?: {
    topic: string;
    dates: string[];
    timePreview: string;
  };
}

export interface ParsedRecord {
  student: string;
  date: string;
  grade: string;
  teacher: string;
  classroom: string;
  timeSlot?: string;
  flexTime?: string;
  topic?: string;
}

export interface ParseResponse {
  classes: ParsedClassGroup[];
  records: ParsedRecord[];
  totalRecords: number;
  errors: string[];
}

// ── Route handler ─────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "未找到上传文件" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: "",
    });

    // Skip header row
    const dataRows = rows.slice(1) as (string | number)[][];

    const classes: ParsedClassGroup[] = [];
    const records: ParsedRecord[] = [];
    const errors: string[] = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      if (!row || !row[0]) continue; // skip empty rows

      // New template columns (0-indexed):
      // 0: 学季  1: 年级  2: 班次级别  3: 主讲老师系统姓名
      // 4: 上课时间预览  5: 上课日期  6: 上课时间  7: 教室  8: 缴费人数
      const season      = String(row[0]).trim(); // 暑季 | 寒季
      const grade       = String(row[1]).trim();
      const rawLevel    = String(row[2]).trim();
      const rawTeacher  = String(row[3]).trim();
      const timePreview = String(row[4]).trim();
      const rawDates    = String(row[5]).trim();
      const rawTimes    = String(row[6]).trim();
      const rawRoom     = String(row[7]).trim();
      const rawCount    = String(row[8] ?? "").trim();

      const dateList = rawDates.split(",").map((s) => s.trim()).filter(Boolean);
      const timeList = rawTimes.split(",").map((s) => s.trim()).filter(Boolean);

      if (!dateList.length) {
        errors.push(`第 ${i + 2} 行「${grade} ${rawLevel}」：未找到日期数据，已跳过`);
        continue;
      }

      const teacher    = mapTeacher(rawTeacher);
      const classroom  = mapClassroom(rawRoom);
      const level      = extractLevel(rawLevel);
      const period     = parsePeriod(timePreview);
      const yearStr    = twoDigitYear(dateList[0]);
      // 缴费人数 → "X人"；若未填则置空（不影响导入，只是统计不计入人数）
      const countNum   = parseInt(rawCount, 10);
      const enrollment = !isNaN(countNum) && countNum > 0 ? `${countNum}人` : "";

      // Validate teacher mapping
      if (teacher && !SYSTEM_TEACHERS.includes(teacher)) {
        errors.push(`第 ${i + 2} 行：老师「${rawTeacher}」未匹配到系统老师，将使用原始名称`);
      }

      // Title generation based on season
      let firstTopic  = "";
      let secondTopic = "";
      let firstLabel  = "";
      let secondLabel = "";

      if (season === "暑季") {
        firstTopic  = `暑假${grade}${level}${period}`;  // e.g. 暑假四年级A+二期
        secondTopic = `秋上${grade}${level}`;           // e.g. 秋上四年级A+
        firstLabel  = "暑假";
        secondLabel = "秋上";
      } else if (season === "寒季") {
        firstTopic  = `寒假${grade}${level}${period}`;  // e.g. 寒假四年级A+一期
        secondTopic = `春上${grade}${level}`;           // e.g. 春上四年级A+
        firstLabel  = "寒假";
        secondLabel = "春上";
      } else {
        // Unknown season — treat all dates as a single group
        firstTopic  = `${grade}${level}${period}`;
        secondTopic = "";
        firstLabel  = season;
        secondLabel = "";
      }

      void yearStr; // yearStr no longer used in topic names

      type DT = { date: string; time: string };
      const firstDT:  DT[] = [];
      const secondDT: DT[] = [];

      for (let j = 0; j < dateList.length; j++) {
        const date = dateList[j];
        const time = timeList[j] ?? timeList[0] ?? "";
        const month = getMonth(date);

        if (season === "暑季") {
          if (isSummerDate(date)) firstDT.push({ date, time });
          else                    secondDT.push({ date, time });
        } else if (season === "寒季") {
          if (isWinterDate(date)) firstDT.push({ date, time });
          else                    secondDT.push({ date, time });
        } else {
          // All dates go to first group
          firstDT.push({ date, time });
          void month;
        }
      }

      // Build ParsedClassGroup for preview
      const group: ParsedClassGroup = {
        originalName: `${grade} ${rawLevel}${period ? " " + period : ""}`,
        teacher,
        classroom,
        grade,
        enrollment,
      };

      if (firstDT.length > 0) {
        group.summer = {
          topic: firstTopic,
          dates: firstDT.map((d) => d.date),
          timePreview: firstDT[0].time,
        };
      }
      if (secondDT.length > 0) {
        group.autumn = {
          topic: secondTopic,
          dates: secondDT.map((d) => d.date),
          timePreview: secondDT[0].time,
        };
      }
      classes.push(group);

      // Build individual records
      // student = enrollment count ("X人") for in-class statistics;
      // topic   = class title (used as the kanban card display name & group key)
      for (const { date, time } of firstDT) {
        const { timeSlot, flexTime } = mapTimeSlot(time);
        records.push({
          student: enrollment,
          date, grade, teacher, classroom,
          topic: firstTopic,
          timeSlot, flexTime,
        });
      }
      for (const { date, time } of secondDT) {
        const { timeSlot, flexTime } = mapTimeSlot(time);
        records.push({
          student: enrollment,
          date, grade, teacher, classroom,
          topic: secondTopic,
          timeSlot, flexTime,
        });
      }

      void firstLabel;
      void secondLabel;
    }

    const response: ParseResponse = {
      classes,
      records,
      totalRecords: records.length,
      errors,
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("[parse-class-template]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "解析失败，请检查文件格式" },
      { status: 500 }
    );
  }
}

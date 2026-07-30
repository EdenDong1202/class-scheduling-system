import { NextResponse } from "next/server";
import { sqlQuery } from "@/lib/teable";

export const revalidate = 30;

const BASE_ID = process.env.TEABLE_BASE_ID ?? "YOUR_TEABLE_BASE_ID";

export async function GET() {
  try {
    const { rows } = await sqlQuery(
      BASE_ID,
      `
      SELECT
        "Ke_Cheng_Zhu_Ti"  AS "topic",
        "Nian_Ji"          AS "grade",
        "Lao_Shi"          AS "teacher",
        "Jiao_Shi"         AS "classroom",
        "Shi_Duan"         AS "time_slot",
        "Bei_Zhu"          AS "flex_time",
        string_agg(DISTINCT "Xue_Sheng", '、') AS "students",
        COUNT(DISTINCT "Ri_Qi")               AS "session_count",
        MIN("Ri_Qi")                          AS "start_date",
        MAX("Ri_Qi")                          AS "end_date",
        COUNT("__id")                         AS "record_count"
      FROM "${BASE_ID}"."Sheet1"
      WHERE "Ke_Cheng_Lei_Xing" = '长期班'
      GROUP BY
        "Ke_Cheng_Zhu_Ti", "Nian_Ji", "Lao_Shi",
        "Jiao_Shi", "Shi_Duan", "Bei_Zhu"
      ORDER BY "Nian_Ji", "Lao_Shi", "Ke_Cheng_Zhu_Ti"
      `
    );

    return NextResponse.json({ rows });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "数据加载失败" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

// Template column headers matching the expected import format
const HEADERS = [
  "学季",
  "年级",
  "班次级别",
  "主讲老师系统姓名",
  "上课时间预览",
  "上课日期",
  "上课时间",
  "教室",
  "缴费人数",
];

// Example rows to guide users on correct format
const EXAMPLES = [
  [
    "暑季",
    "四年级",
    "培优A+",
    "何先骐",
    "二期下午15:30-17:30,周六下午15:30-17:30",
    "2026-07-27,2026-07-28,2026-07-29,2026-07-30,2026-07-31,2026-08-03,2026-08-04,2026-08-05,2026-08-06,2026-08-07,2026-09-05,2026-09-12,2026-09-19,2026-10-07",
    "15:30-17:30,15:30-17:30,15:30-17:30,15:30-17:30,15:30-17:30,15:30-17:30,15:30-17:30,15:30-17:30,15:30-17:30,15:30-17:30,15:30-17:30,15:30-17:30,15:30-17:30,15:30-17:30",
    "英联207",
    8,
  ],
  [
    "暑季",
    "六年级",
    "培优S+",
    "杨洋",
    "一期下午15:30-18:00,周六上午09:30-12:00",
    "2026-07-13,2026-07-14,2026-07-15,2026-07-16,2026-07-17,2026-07-20,2026-07-21,2026-07-22,2026-07-23,2026-07-24,2026-09-05,2026-09-12,2026-09-19,2026-10-07",
    "15:30-18:00,15:30-18:00,15:30-18:00,15:30-18:00,15:30-18:00,15:30-18:00,15:30-18:00,15:30-18:00,15:30-18:00,15:30-18:00,09:30-12:00,09:30-12:00,09:30-12:00,09:30-12:00",
    "英联201",
    6,
  ],
];

export async function GET() {
  try {
    const wb = XLSX.utils.book_new();
    const wsData = [HEADERS, ...EXAMPLES];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Set column widths for readability
    ws["!cols"] = [
      { wch: 8 },   // 学季
      { wch: 10 },  // 年级
      { wch: 12 },  // 班次级别
      { wch: 16 },  // 主讲老师系统姓名
      { wch: 32 },  // 上课时间预览
      { wch: 90 },  // 上课日期
      { wch: 90 },  // 上课时间
      { wch: 10 },  // 教室
      { wch: 10 },  // 缴费人数
    ];

    XLSX.utils.book_append_sheet(wb, ws, "长期班导入模板");

    const xlsxBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(xlsxBuffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition":
          'attachment; filename*=UTF-8\'\'%E9%95%BF%E6%9C%9F%E7%8F%AD%E5%AF%BC%E5%85%A5%E6%A8%A1%E6%9D%BF.xlsx',
      },
    });
  } catch (err) {
    console.error("[download-template]", err);
    return NextResponse.json({ error: "模板生成失败" }, { status: 500 });
  }
}

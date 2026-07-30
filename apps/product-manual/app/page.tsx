import {
  CalendarRange,
  LayoutDashboard,
  Database,
  Clock,
  GraduationCap,
  Lightbulb,
  Rocket,
  ChevronRight,
  Layers,
  Filter,
  Plus,
  Copy,
  Download,
  BookOpen,
  Sparkles,
  ExternalLink,
} from "lucide-react";

const nav = [
  { id: "overview", label: "系统概览", icon: Layers },
  { id: "board", label: "排课看板", icon: CalendarRange },
  { id: "manage", label: "班课管理", icon: LayoutDashboard },
  { id: "quickstart", label: "快速上手", icon: Rocket },
];

function SectionTitle({
  id,
  icon: Icon,
  eyebrow,
  title,
  desc,
}: {
  id: string;
  icon: React.ElementType;
  eyebrow: string;
  title: string;
  desc: string;
}) {
  return (
    <div id={id} className="scroll-mt-24 border-b border-slate-200 pb-6">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-indigo-600">
        <Icon className="h-4 w-4" />
        {eyebrow}
      </div>
      <h2 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">{desc}</p>
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
              <CalendarRange className="h-4 w-4" />
            </div>
            <span className="text-sm font-semibold">排课系统 · 产品说明书</span>
          </div>
          <a
            href="#quickstart"
            className="hidden items-center gap-1 rounded-full bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-700 sm:inline-flex"
          >
            <Rocket className="h-3.5 w-3.5" />
            快速上手
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-b from-white to-slate-50">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-indigo-100/60 blur-3xl" />
        <div className="pointer-events-none absolute -left-20 top-10 h-48 w-48 rounded-full bg-emerald-100/50 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
            <Sparkles className="h-3.5 w-3.5" />
            产品说明书 · v1.1
          </div>
          <h1 className="mt-4 max-w-3xl text-3xl font-bold leading-tight text-slate-900 sm:text-5xl">
            排课看板 & 班课管理
            <span className="block text-indigo-600">校区排课一体化系统</span>
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">
            本系统围绕一张「排课总台账」构建，由两个应用协同工作：
            <strong className="font-semibold text-slate-800">排课看板</strong>负责查看与编排每日课表，
            <strong className="font-semibold text-slate-800">班课管理</strong>负责班课管理与统计。
            数据实时同步，5 秒内自动刷新。
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#overview"
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700"
            >
              开始阅读
              <ChevronRight className="h-4 w-4" />
            </a>
            <a
              href="#board"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <CalendarRange className="h-4 w-4" />
              排课看板
            </a>
            <a
              href="#manage"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <LayoutDashboard className="h-4 w-4" />
              班课管理
            </a>
          </div>
        </div>
      </section>

      {/* Main layout: sidebar + content */}
      <div className="mx-auto flex max-w-6xl gap-8 px-4 py-12 sm:px-6">
        {/* Sidebar TOC */}
        <aside className="sticky top-20 hidden h-fit w-56 shrink-0 lg:block">
          <nav className="space-y-1">
            <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              目录
            </p>
            {nav.map((item, i) => {
              const Icon = item.icon;
              return (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className="group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-600 transition hover:bg-indigo-50 hover:text-indigo-700"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 text-xs font-semibold text-slate-500 group-hover:bg-indigo-100 group-hover:text-indigo-600">
                    {i + 1}
                  </span>
                  <Icon className="h-4 w-4 text-slate-400 group-hover:text-indigo-500" />
                  <span className="font-medium">{item.label}</span>
                </a>
              );
            })}
          </nav>
        </aside>

        {/* Content */}
        <main className="min-w-0 flex-1 space-y-16">
          {/* 1. Overview */}
          <section>
            <SectionTitle
              id="overview"
              icon={Layers}
              eyebrow="01 · 系统概览"
              title="一个数据底座，两个协同应用"
              desc="所有排课记录都存储在「排课总台账」中，两个应用从不同角度读取和操作同一份数据。"
            />

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white">
                  <Database className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-slate-900">排课总台账</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-500">
                  系统的数据底座。每一条记录代表一次课或一个事项，包含学生、年级、日期、时段、教室、老师等完整信息。
                </p>
                <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                  数据层
                </span>
              </div>

              <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-5 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600 text-white">
                  <CalendarRange className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-slate-900">排课看板</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-500">
                  以「周 × 教室 × 时段」网格直观呈现课表，支持添加课程、新增事项、快速查看本周排期。
                </p>
                <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
                  操作视图
                </span>
                <a
                  href="https://your-app-url.example.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 transition hover:text-indigo-700"
                >
                  前往应用
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>

              <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-5 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600 text-white">
                  <LayoutDashboard className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-slate-900">班课管理</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-500">
                  聚焦长期班的生命周期管理，提供开班统计、多维筛选、一键复制与批量导入。
                </p>
                <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                  管理视图
                </span>
                <a
                  href="https://your-app-url.example.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-emerald-600 transition hover:text-emerald-700"
                >
                  前往应用
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-sm font-medium text-slate-700">数据流向</p>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                <span className="rounded-lg bg-slate-900 px-3 py-1.5 font-medium text-white">
                  排课总台账
                </span>
                <ChevronRight className="h-4 w-4 text-slate-400" />
                <span className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 font-medium text-indigo-700">
                  排课看板 · 按周网格展示
                </span>
                <span className="text-slate-300">|</span>
                <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 font-medium text-emerald-700">
                  班课管理 · 按班课聚合
                </span>
              </div>
              <p className="mt-4 text-xs leading-relaxed text-slate-500">
                两个应用读写的是同一张表，在排课看板新增的课程会即时出现在班课管理中（长期班会自动归入班课列表）。
              </p>
            </div>
          </section>

          {/* 2. Board */}
          <section>
            <SectionTitle
              id="board"
              icon={CalendarRange}
              eyebrow="02 · 排课看板"
              title="排课看板"
              desc="以「星期 × 时段 × 教室」三维网格呈现一周排课，一眼掌握全校每日每教室的占用情况。"
            />

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                    <Layers className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-semibold">校区排课总览</h3>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-slate-500">
                  顶部展示「本周」日期范围（如 <span className="font-mono text-slate-700">7/20–7/26</span>），
                  并按天显示当日课程数。快速了解本周整体排课密度。
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                    <CalendarRange className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-semibold">周课表网格</h3>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-slate-500">
                  主体为一张网格表：行 = 周一至周日 × 时段（8:00–20:00，每 2 小时一格），
                  列 = 教室1 至 教室4。每个单元格落位一节课程卡片。
                </p>
              </div>
            </div>

            {/* Mock grid preview */}
            <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-medium text-slate-500">
                看板示意 · 周一
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-center text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/60">
                      <th className="px-3 py-2 text-left font-medium text-slate-500">时间</th>
                      <th className="px-3 py-2 font-medium text-slate-500">教室1</th>
                      <th className="px-3 py-2 font-medium text-slate-500">教室2</th>
                      <th className="px-3 py-2 font-medium text-slate-500">教室3</th>
                      <th className="px-3 py-2 font-medium text-slate-500">教室4</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { t: "A段 08:00", c1: "诊断课·张同学", c2: "", c3: "小灶课·李同学", c4: "" },
                      { t: "B段 10:20", c1: "长期班·初一A", c2: "长期班·五年级", c3: "", c4: "短期班·集训" },
                      { t: "C段 13:10", c1: "", c2: "诊断课·王同学", c3: "长期班·初二", c4: "" },
                      { t: "D段 15:30", c1: "小灶课·赵同学", c2: "", c3: "", c4: "长期班·六年级" },
                      { t: "E段 18:20", c1: "全体事项·教研", c2: "", c3: "长期班·初一B", c4: "" },
                    ].map((row) => (
                      <tr key={row.t} className="border-b border-slate-100 last:border-0">
                        <td className="px-3 py-3 text-left font-mono text-slate-500">{row.t}</td>
                        <td className="px-2 py-3">{row.c1 && <span className="inline-block rounded-md bg-blue-50 px-2 py-1 text-blue-700">{row.c1}</span>}</td>
                        <td className="px-2 py-3">{row.c2 && <span className="inline-block rounded-md bg-blue-50 px-2 py-1 text-blue-700">{row.c2}</span>}</td>
                        <td className="px-2 py-3">{row.c3 && <span className="inline-block rounded-md bg-green-50 px-2 py-1 text-green-700">{row.c3}</span>}</td>
                        <td className="px-2 py-3">{row.c4 && <span className="inline-block rounded-md bg-orange-50 px-2 py-1 text-orange-700">{row.c4}</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-2 text-xs text-slate-400">
                课程卡片颜色对应课程类型，便于快速识别
              </div>
            </div>

            {/* Operations */}
            <h3 className="mt-10 text-lg font-semibold text-slate-900">核心操作</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white">
                    <Plus className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">添加课程</p>
                    <p className="text-xs text-slate-400">为指定教室、时段排入一节课</p>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-slate-500">
                  点击「添加课程」按钮，填写学生、年级、日期、时段、教室、老师与课程主题，保存后课程卡片即落入对应网格。
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500 text-white">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">新增事项</p>
                    <p className="text-xs text-slate-400">排入非课程性质的公共/个人事项</p>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-slate-500">
                  选择「全体事项 / 个人事项」，可排入备课、家长会、请假等非授课安排，同样呈现在网格中。
                </p>
              </div>
            </div>

            {/* Usage flow */}
            <h3 className="mt-10 text-lg font-semibold text-slate-900">使用流程</h3>
            <ol className="mt-4 space-y-3">
              {[
                { t: "查看本周排课", d: "打开看板，顶部自动定位到当前周，直观浏览每日每教室的排课密度。" },
                { t: "识别空位 / 冲突", d: "通过网格空白格快速发现可用时段，通过卡片颜色识别课程类型。" },
                { t: "添加课程或事项", d: "点击「添加课程」或「新增事项」，填写表单后保存，课程实时落入网格。" },
                { t: "核对当前进度", d: "「当前时间」指示线标示当下所处时段，便于教师快速定位进行中的课程。" },
              ].map((s, i) => (
                <li key={i} className="flex gap-4 rounded-xl border border-slate-200 bg-white p-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{s.t}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-slate-500">{s.d}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {/* 3. Manage */}
          <section>
            <SectionTitle
              id="manage"
              icon={LayoutDashboard}
              eyebrow="03 · 班课管理"
              title="班课管理"
              desc="聚焦班课管理，提供开班导入、班课统计、多维筛选、一键复制与批量导入。"
            />

            {/* Dashboard cards */}
            <h3 className="mt-8 text-lg font-semibold text-slate-900">数据看板</h3>
            <p className="mt-1 text-sm text-slate-500">页面顶部三张统计卡，实时反映班课整体状态。</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <p className="text-2xl font-bold text-indigo-600">当前开班</p>
                <p className="mt-2 text-xs text-slate-500">尚未结课的长期班总数</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <p className="text-2xl font-bold text-emerald-600">正在授课</p>
                <p className="mt-2 text-xs text-slate-500">当日有课且进行中的班数</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <p className="text-2xl font-bold text-slate-400">已结课</p>
                <p className="mt-2 text-xs text-slate-500">已标记结课的班数</p>
              </div>
            </div>

            {/* Filters */}
            <h3 className="mt-10 text-lg font-semibold text-slate-900">多维筛选</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { icon: GraduationCap, label: "年级", opts: "一~六年级 / 初一 / 初二" },
                { icon: Clock, label: "学期", opts: "春季 / 暑季 / 秋季 / 寒季" },
                { icon: Layers, label: "状态", opts: "待授课 / 正在授课 / 已结课" },
                { icon: Filter, label: "班型", opts: "长期班 / 短期班" },
              ].map((f) => {
                const Icon = f.icon;
                return (
                  <div key={f.label} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center gap-2 text-slate-700">
                      <Icon className="h-4 w-4 text-emerald-600" />
                      <span className="text-sm font-semibold">{f.label}</span>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-slate-500">{f.opts}</p>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-slate-500">
              多个筛选条件可叠加使用，快速定位某年级某学期特定状态的班课。
            </p>

            {/* Operations */}
            <h3 className="mt-10 text-lg font-semibold text-slate-900">核心操作</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white">
                    <Plus className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">新增班课</p>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-slate-500">
                  手动创建一个长期班，填写学生、年级、日期、时段等信息，保存后进入班课列表与统计。
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white">
                    <Download className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">导入长期班</p>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-slate-500">
                  适用于整班批量建课场景。一次导入多名学生的长期班排期，自动写入排课总台账。
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500 text-white">
                    <Copy className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">右键复制课程</p>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-slate-500">
                  在课程卡片上右键，选择复制后在编辑界面确认修改并保存，即可快速生成一节相似的新课。
                </p>
              </div>
            </div>

            {/* Usage flow */}
            <h3 className="mt-10 text-lg font-semibold text-slate-900">使用流程</h3>
            <ol className="mt-4 space-y-3">
              {[
                { t: "查看班课统计", d: "打开班课管理，顶部三张卡片即时反映开班、授课、结课情况。" },
                { t: "按需筛选", d: "通过年级、学期、状态、班型四个维度组合筛选，定位目标班课。" },
                { t: "新增或导入", d: "零散建课用「新增班课」，整班批量用「导入长期班」。" },
                { t: "复制相似课程", d: "对已有课程卡片右键复制，修改差异字段后保存，高效排课。" },
              ].map((s, i) => (
                <li key={i} className="flex gap-4 rounded-xl border border-slate-200 bg-white p-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{s.t}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-slate-500">{s.d}</p>
                  </div>
                </li>
              ))}
            </ol>

            <div className="mt-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <p className="text-sm font-semibold text-amber-900">提示：数据从何而来</p>
                <p className="mt-1 text-sm leading-relaxed text-amber-800">
                  班课管理列表为空属正常。请先在「排课总台账」中新增记录并设置
                  <span className="mx-1 rounded bg-amber-100 px-1.5 py-0.5 font-mono text-xs text-amber-900">课程类型 = 长期班</span>
                  ，该记录会自动出现在班课管理中。数据实时同步，约 5 秒内自动刷新。
                </p>
              </div>
            </div>
          </section>

          {/* 4. Quick start */}
          <section>
            <SectionTitle
              id="quickstart"
              icon={Rocket}
              eyebrow="04 · 快速上手"
              title="三步开始排课"
              desc="从零到完成第一次排课的最短路径。"
            />

            <div className="mt-8 space-y-4">
              {[
                {
                  icon: Plus,
                  title: "第一步 · 新增一条排课记录",
                  desc: "在排课看板点击「日历空白处」，或在班课管理点击「新增班课 / 导入长期班」。填写学生、年级、日期、时段、教室、老师等关键信息。",
                  tone: "bg-indigo-600",
                },
                {
                  icon: CalendarRange,
                  title: "第二步 · 在看板核对排期",
                  desc: "回到排课看板，确认课程卡片落在正确的「周 × 时段 × 教室」网格中。如需调整，编辑该记录的日期/时段/教室即可，网格会实时更新。",
                  tone: "bg-emerald-600",
                },
                {
                  icon: LayoutDashboard,
                  title: "第三步 · 在班课管理跟踪状态",
                  desc: "长期班会自动进入班课管理列表，通过筛选查看开班、授课、结课状态，统计卡片实时反映整体进度。",
                  tone: "bg-amber-500",
                },
              ].map((step, i) => {
                const Icon = step.icon;
                return (
                  <div key={i} className="flex gap-4 rounded-xl border border-slate-200 bg-white p-5">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white ${step.tone}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-base font-semibold text-slate-900">{step.title}</p>
                      <p className="mt-1 text-sm leading-relaxed text-slate-500">{step.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Two-app summary */}
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-5">
                <div className="flex items-center gap-2 text-indigo-700">
                  <CalendarRange className="h-5 w-5" />
                  <span className="text-sm font-semibold">什么时候用 排课看板？</span>
                </div>
                <ul className="mt-3 space-y-1.5 text-sm text-slate-600">
                  <li>· 想直观查看某周某教室的排课</li>
                  <li>· 需要快速新增单次课程或事项</li>
                  <li>· 排查教室 / 时段冲突</li>
                </ul>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-5">
                <div className="flex items-center gap-2 text-emerald-700">
                  <LayoutDashboard className="h-5 w-5" />
                  <span className="text-sm font-semibold">什么时候用 班课管理？</span>
                </div>
                <ul className="mt-3 space-y-1.5 text-sm text-slate-600">
                  <li>· 统计开班 / 授课 / 结课数量</li>
                  <li>· 按年级、学期、状态筛选长期班</li>
                  <li>· 批量导入或复制相似课程</li>
                </ul>
              </div>
            </div>

            {/* Jump to apps */}
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <a
                href="https://your-app-url.example.com"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center justify-between rounded-xl border border-indigo-200 bg-indigo-50/40 p-5 transition hover:border-indigo-400 hover:bg-indigo-50"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600 text-white">
                    <CalendarRange className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-slate-900">前往 排课看板</p>
                    <p className="text-xs text-slate-500">查看与编排每日课表</p>
                  </div>
                </div>
                <ExternalLink className="h-4 w-4 text-indigo-500 transition group-hover:translate-x-0.5" />
              </a>
              <a
                href="https://your-app-url.example.com"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/40 p-5 transition hover:border-emerald-400 hover:bg-emerald-50"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600 text-white">
                    <LayoutDashboard className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-slate-900">前往 班课管理</p>
                    <p className="text-xs text-slate-500">管理班课与统计</p>
                  </div>
                </div>
                <ExternalLink className="h-4 w-4 text-emerald-500 transition group-hover:translate-x-0.5" />
              </a>
            </div>
          </section>

          {/* Footer */}
          <footer className="border-t border-slate-200 pt-8">
            <p className="text-center text-sm font-semibold text-slate-900">排课系统产品说明书</p>
            <div className="mt-6 rounded-xl border border-indigo-200 bg-indigo-50/50 px-5 py-4 text-center">
              <p className="text-sm text-slate-700">
                如有任何建议或反馈，欢迎知音楼联系 <span className="font-semibold text-indigo-700">董昊琦（376945）</span>
              </p>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}

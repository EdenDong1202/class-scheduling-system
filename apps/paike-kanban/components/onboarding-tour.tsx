"use client";

import { useEffect, useState } from "react";
import {
  Sparkles,
  Trophy,
  LayoutGrid,
  ChevronLeft,
  CalendarPlus,
  Plus,
  CheckCircle2,
  Pencil,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type TourStep =
  | "welcome"
  | "overview"
  | "nav"
  | "new-event"
  | "create"
  | "created"
  | "edit"
  | "delete"
  | "done";

interface Props {
  step: TourStep | null;
  onAdvance: (step: TourStep) => void;
  onSkip: () => void;
  onFinish: () => void;
  /** create 步骤打开新增弹窗时隐藏普通引导卡片 */
  suppressCard?: boolean;
  /** 编辑/删除步骤是否处于「编辑弹窗已打开」阶段（决定聚光灯镂空目标） */
  dialogOpen?: boolean;
}

type IconTone = "blue" | "red";

type CardAction =
  | { kind: "next"; label: string; to: TourStep }
  | { kind: "hint"; text: string };

interface CardStep {
  id: TourStep;
  icon: LucideIcon;
  iconTone: IconTone;
  title: string;
  desc: string;
  position: string;
  action: CardAction;
}

const CARD_STEPS: CardStep[] = [
  {
    id: "overview",
    icon: LayoutGrid,
    iconTone: "blue",
    title: "认识排课看板",
    desc: "纵轴是日期（本周 7 天），横轴是教室（201–209）。每个格子显示该教室当天的课程，今天的行以蓝色标注。",
    position: "top-[84px] left-1/2 -translate-x-1/2",
    action: { kind: "next", label: "下一步 ›", to: "nav" },
  },
  {
    id: "nav",
    icon: ChevronLeft,
    iconTone: "blue",
    title: "切换周次",
    desc: "右上角已高亮的 ‹ › 箭头可切换上下周，点「本周」快速回到今天。课表会自动滚动到当天位置。",
    position: "top-[84px] right-4",
    action: { kind: "next", label: "下一步 ›", to: "new-event" },
  },
  {
    id: "new-event",
    icon: CalendarPlus,
    iconTone: "blue",
    title: "新增事项",
    desc: "右上角已高亮的「新增事项」可以创建个人占用时段（如备课、外出），或标注全体老师均占用的时段，与普通排课分开管理。",
    position: "top-[84px] right-4",
    action: { kind: "next", label: "下一步 ›", to: "create" },
  },
  {
    id: "create",
    icon: Plus,
    iconTone: "blue",
    title: "新增一节演示课程",
    desc: "点击下方课表中今天那行的任意空白格子，即可打开新增表单。我们已为你预填演示数据，保存后不会写入数据库。",
    position: "top-[84px] left-1/2 -translate-x-1/2",
    action: { kind: "hint", text: "↓ 请点击下方课表今天那行的空白格子" },
  },
  {
    id: "created",
    icon: CheckCircle2,
    iconTone: "blue",
    title: "课程已出现在课表上！",
    desc: "在今天的行里找到带「演示」标记的课程卡片了吗？接下来试试编辑它。",
    position: "bottom-6 right-6",
    action: { kind: "next", label: "下一步 ›", to: "edit" },
  },
  {
    id: "edit",
    icon: Pencil,
    iconTone: "blue",
    title: "编辑课程信息",
    desc: "点击右侧高亮的课程卡片打开编辑，修改任意字段（比如学生姓名），再点「保存」。",
    position: "bottom-6 right-6",
    action: { kind: "hint", text: "" },
  },
  {
    id: "delete",
    icon: Trash2,
    iconTone: "red",
    title: "删除课程",
    desc: "点击高亮的课程卡片，在打开的窗口里点「删除课程」，演示数据将被清除。",
    position: "bottom-6 right-6",
    action: { kind: "hint", text: "" },
  },
];

const DONE_ITEMS = [
  "查看每周课表布局",
  "切换周次 / 回到本周",
  "了解新增事项功能",
  "新增课程并填写信息",
  "编辑已有课程",
  "删除课程",
];

const ICON_TONE: Record<IconTone, { wrap: string; icon: string }> = {
  blue: { wrap: "bg-blue-100", icon: "text-blue-600" },
  red: { wrap: "bg-red-100", icon: "text-red-600" },
};

function IconBadge({ icon: Icon, tone }: { icon: LucideIcon; tone: IconTone }) {
  const t = ICON_TONE[tone];
  return (
    <div className={`h-9 w-9 shrink-0 rounded-full flex items-center justify-center ${t.wrap}`}>
      <Icon className={`h-5 w-5 ${t.icon}`} />
    </div>
  );
}

type Rect = { top: number; left: number; right: number; bottom: number; width: number; height: number };

export default function OnboardingTour({
  step,
  onAdvance,
  onSkip,
  onFinish,
  suppressCard,
  dialogOpen,
}: Props) {
  const isSpotlight = step === "edit" || step === "delete";
  const phaseB = !!dialogOpen;
  const targetSelector = !phaseB
    ? '[data-tour="demo-card"]'
    : step === "edit"
      ? '[data-tour="dialog-save"]'
      : '[data-tour="dialog-delete"]';

  const [rect, setRect] = useState<Rect | null>(null);

  // 持续测量目标元素位置（应对滚动 / 弹窗入场动画 / 窗口缩放）
  useEffect(() => {
    if (!isSpotlight) { setRect(null); return; }
    let raf = 0;
    const tick = () => {
      const el = document.querySelector(targetSelector) as HTMLElement | null;
      if (el) {
        const r = el.getBoundingClientRect();
        setRect({ top: r.top, left: r.left, right: r.right, bottom: r.bottom, width: r.width, height: r.height });
      } else {
        setRect(null);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isSpotlight, targetSelector]);

  // 进入阶段 A 时把演示卡片滚到可见区，避免被遮罩挡住够不着
  useEffect(() => {
    if (isSpotlight && !phaseB) {
      const el = document.querySelector('[data-tour="demo-card"]') as HTMLElement | null;
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [isSpotlight, phaseB]);

  if (!step) return null;

  if (step === "welcome") {
    return (
      <Dialog open onOpenChange={() => { /* 禁止外部/Esc 关闭 */ }}>
        <DialogContent
          className="max-w-sm gap-0 p-0 overflow-hidden"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <div className="h-[1.5px] w-full bg-blue-500" />
          <div className="px-6 pt-6 pb-6 space-y-4">
            <div className="flex justify-center">
              <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <DialogHeader className="space-y-2 text-center">
              <DialogTitle className="text-base font-semibold leading-snug">
                欢迎使用排课看板
              </DialogTitle>
              <p className="text-xs text-muted-foreground leading-relaxed">
                用约 1 分钟跟着引导完成一次完整操作：新增一节课、编辑它、再删除它。演示数据不会保存到数据库。
              </p>
            </DialogHeader>
            <div className="flex flex-col gap-2 pt-1">
              <Button className="h-9" onClick={() => onAdvance("overview")}>
                开始体验
              </Button>
              <Button variant="ghost" className="h-9 text-muted-foreground" onClick={onSkip}>
                我已熟悉，跳过引导
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (step === "done") {
    return (
      <Dialog open onOpenChange={() => { /* 禁止外部/Esc 关闭 */ }}>
        <DialogContent
          className="max-w-sm gap-0 p-0 overflow-hidden"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <div className="h-[1.5px] w-full bg-green-500" />
          <div className="px-6 pt-6 pb-6 space-y-4">
            <div className="flex justify-center">
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                <Trophy className="h-6 w-6 text-green-600" />
              </div>
            </div>
            <DialogHeader className="space-y-2 text-center">
              <DialogTitle className="text-base font-semibold leading-snug">
                操作完成！
              </DialogTitle>
              <p className="text-xs text-muted-foreground leading-relaxed">
                你已掌握排课看板的基本操作。演示课程已自动清除，不会留在数据库中。
              </p>
            </DialogHeader>
            <ul className="space-y-2">
              {DONE_ITEMS.map((it) => (
                <li key={it} className="flex items-start gap-2 text-sm text-foreground/80">
                  <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                  <span>{it}</span>
                </li>
              ))}
            </ul>
            <Button className="h-9 w-full" onClick={onFinish}>
              开始使用
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ── 聚光灯步骤（编辑 / 删除）：顶层遮罩 + 镂空目标 + 引导卡片 ──
  if (isSpotlight) {
    const idx = CARD_STEPS.findIndex((s) => s.id === step);
    const card = CARD_STEPS[idx];
    const Icon = card.icon;
    const pct = Math.round(((idx + 1) / CARD_STEPS.length) * 100);
    const phaseHint = !phaseB
      ? "↓ 点击高亮的课程卡片"
      : step === "edit"
        ? "修改任意字段后点「保存」"
        : "点「删除课程」完成演示";

    // 引导卡片定位：阶段 A 贴在课程卡片旁；阶段 B 收到右上角（不挡弹窗）
    const cardW = 320;
    const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
    let cardStyle: React.CSSProperties;
    if (!phaseB && rect) {
      const gap = 12;
      let left: number;
      if (rect.right + gap + cardW <= vw) left = rect.right + gap;
      else if (rect.left - gap - cardW >= 0) left = rect.left - gap - cardW;
      else left = Math.max(8, Math.min(rect.left, vw - cardW - 8));
      cardStyle = { left, top: Math.max(8, rect.top), width: cardW };
    } else {
      cardStyle = { top: 16, right: 16, width: cardW };
    }

    return (
      <>
        {/* 遮罩：定位到目标时四块镂空；未定位时整屏压暗 */}
        {rect ? (
          <>
            <div className="fixed z-[100] bg-black/50" style={{ left: 0, top: 0, right: 0, height: rect.top }} />
            <div className="fixed z-[100] bg-black/50" style={{ left: 0, top: rect.bottom, right: 0, bottom: 0 }} />
            <div className="fixed z-[100] bg-black/50" style={{ left: 0, top: rect.top, width: rect.left, height: rect.height }} />
            <div className="fixed z-[100] bg-black/50" style={{ left: rect.right, top: rect.top, right: 0, height: rect.height }} />
            <div
              className="fixed z-[101] rounded pointer-events-none ring-2 ring-blue-500"
              style={{ left: rect.left - 3, top: rect.top - 3, width: rect.width + 6, height: rect.height + 6 }}
            />
          </>
        ) : (
          <div className="fixed inset-0 z-[100] bg-black/50" />
        )}

        {/* 引导卡片 */}
        <div className="fixed z-[200] rounded-xl bg-white shadow-2xl overflow-hidden" style={cardStyle}>
          <div className="h-1 w-full bg-blue-100">
            <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${pct}%` }} />
          </div>
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground tabular-nums">
                步骤 {idx + 1} / {CARD_STEPS.length}
              </span>
              <button
                type="button"
                onClick={onSkip}
                aria-label="跳过引导"
                className="text-muted-foreground hover:text-foreground rounded p-0.5 -mt-0.5 -mr-0.5"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-start gap-3">
              <IconBadge icon={Icon} tone={card.iconTone} />
              <div className="space-y-1 min-w-0">
                <h3 className="text-sm font-semibold leading-snug">{card.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{card.desc}</p>
              </div>
            </div>
            <p className="text-xs font-medium text-blue-600 pt-1">{phaseHint}</p>
          </div>
        </div>
      </>
    );
  }

  // ── 普通卡片步骤 ──
  const idx = CARD_STEPS.findIndex((s) => s.id === step);
  if (idx === -1) return null;
  // create 步骤打开新增弹窗时隐藏卡片，避免遮挡对话框
  if (suppressCard) return null;
  const card = CARD_STEPS[idx];
  const pct = Math.round(((idx + 1) / CARD_STEPS.length) * 100);
  const Icon = card.icon;

  const action = card.action;
  let actionEl: React.ReactNode = null;
  if (action.kind === "next") {
    actionEl = (
      <Button size="sm" className="h-8" onClick={() => onAdvance(action.to)}>
        {action.label}
      </Button>
    );
  } else {
    actionEl = (
      <p className="text-xs font-medium text-blue-600">{action.text}</p>
    );
  }

  return (
    <div className={`fixed z-[200] w-80 rounded-xl bg-white shadow-2xl overflow-hidden ${card.position}`}>
      {/* 顶部进度条 */}
      <div className="h-1 w-full bg-blue-100">
        <div
          className="h-full bg-blue-500 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="p-4 space-y-3">
        {/* 步骤计数 + 关闭 */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground tabular-nums">
            步骤 {idx + 1} / {CARD_STEPS.length}
          </span>
          <button
            type="button"
            onClick={onSkip}
            aria-label="跳过引导"
            className="text-muted-foreground hover:text-foreground rounded p-0.5 -mt-0.5 -mr-0.5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 图标 + 标题 + 说明 */}
        <div className="flex items-start gap-3">
          <IconBadge icon={Icon} tone={card.iconTone} />
          <div className="space-y-1 min-w-0">
            <h3 className="text-sm font-semibold leading-snug">{card.title}</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">{card.desc}</p>
          </div>
        </div>

        {/* 行动按钮 / 提示 */}
        <div className="flex justify-end pt-1">{actionEl}</div>
      </div>
    </div>
  );
}

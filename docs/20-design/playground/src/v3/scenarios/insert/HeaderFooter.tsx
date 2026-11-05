import { Fragment } from "react"
import { cn } from "@/lib/utils"
import { Button, CheckRow, Dialog, LayerClose, MenuField, RadioRow, SlideFrame, SlideTitle, TextField } from "../../kit"
import { useInsertToast } from "./feedback"

/** 13 种 datetimeN（中文，样张固定时刻 2026-09-30 14:32:05，与 03-16 日期和时间格式选择器同一张表） */
const ZH_FORMATS = [
  "2026/9/30",
  "2026年9月30日星期三",
  "2026年9月30日",
  "2026年9月",
  "9月30日",
  "二〇二六年九月三十日",
  "星期三",
  "2026/9/30 14:32",
  "2026/9/30 14:32:05",
  "14:32",
  "14:32:05",
  "下午2时32分",
  "下午2时32分05秒",
]
const LANGS = ["中文（中国）", "英语（美国）", "日语"]
const FOOTER = "2026 年 Q2 业绩汇报 · 内部资料"

/**
 * 预览：当前页（第 4 页「营收趋势」）的真实缩小渲染（Q8，不用灰条），叠加三个页脚族占位符的位置——
 * 日期左、页脚中、编号右；启用 = 强调色实线 + 浅强调色底并写出内容，关闭 = 灰色虚线。
 */
function Preview({ date, number, footer, numberMissing }: { date: boolean; number: boolean; footer: boolean; numberMissing?: boolean }) {
  const slot = (on: boolean) => (on ? "border-(--v3-accent) bg-(--v3-accent-soft)" : "border-dashed border-(--v3-border-control)")
  return (
    <div className="relative overflow-hidden rounded-[4px] border border-(--v3-border)">
      <SlideFrame label="预览：第 4 页 营收趋势">
        <SlideTitle>营收趋势</SlideTitle>
        <div className="absolute inset-x-[7cqw] top-[20cqw] bottom-[13cqw] flex items-end gap-[3.4cqw] border-b-[0.25cqw] border-[#C9D0DC] px-[2cqw]">
          {[35, 32, 41, 38, 42, 48].map((v, i) => (
            <span key={i} className={cn("flex-1 rounded-t-[0.6cqw]", i < 3 ? "bg-[#C9D5FB]" : "bg-(--s-brand)")} style={{ height: `${(v / 48) * 100}%` }} />
          ))}
        </div>
        {/* 页脚族占位符：日期 / 页脚 / 编号 */}
        <div className="absolute inset-x-[4cqw] bottom-[3cqw] flex h-[6cqw] items-center gap-[2cqw] text-[3.4cqw] leading-none text-(--s-mute)">
          <span className={cn("flex h-full w-[24cqw] items-center rounded-[0.8cqw] border px-[1.4cqw] whitespace-nowrap", slot(date))}>{date && "2026/9/30"}</span>
          <span className={cn("flex h-full flex-1 items-center justify-center rounded-[0.8cqw] border px-[1.4cqw] whitespace-nowrap", slot(footer))}>{footer && "Q2 业绩汇报"}</span>
          {!numberMissing && <span className={cn("flex h-full w-[10cqw] items-center justify-end rounded-[0.8cqw] border px-[1.4cqw] tabular-nums", slot(number))}>{number && "4"}</span>}
        </div>
      </SlideFrame>
    </div>
  )
}

/**
 * 页眉和页脚（03-15 G-81；R-d-70）：入口为工具条「更多 › 页眉和页脚…」与主菜单「插入」；不在文本编辑态时「日期和时间」「幻灯片编号」也打开它。
 * 宽 640：左栏表单、右栏 160 宽预览，间距 20；复选行 28、子项缩进 24。日期「自动更新」= 13 种 datetimeN 格式 + 语言（宽 128），
 * 「固定」= 文本（非当前模式的控件禁用）；底栏左侧写清两个按钮的作用范围，「应用」只作用于所选页、「全部应用」作用于全部页，各一个撤销步。
 * numberMissing：当前版式没有幻灯片编号占位符时该项禁用并说明原因。
 */
export function HeaderFooterDialog({ numberMissing = false }: { numberMissing?: boolean }) {
  const number = !numberMissing
  const toast = useInsertToast()
  // 摘要只在「 · 」处换行，页脚文字按自身的「 · 」拆段，专有名词不从中间断开（Q7）
  const summary = ["2026/9/30", ...FOOTER.split(" · "), ...(number ? ["4"] : [])]
  return (
    <Dialog
      title="页眉和页脚"
      size="lg"
      // 入口在工具条「更多」：关闭后焦点回到那里（状态一打开就是这个对话框、没有触发元素时）
      returnFocus="tool-more"
      description="给幻灯片加日期、编号和页脚文字，内容写入版式上的页脚占位符。"
      footerStart={<span className="text-[12px] leading-4 text-(--v3-text-2)">应用：所选 1 页 · 全部应用：6 页</span>}
      footer={
        // 三个按钮都关闭对话框（LayerClose）；「应用」「全部应用」各是一个撤销步，画布上轻提示写明作用范围
        <>
          <LayerClose>
            <Button variant="secondary">取消</Button>
          </LayerClose>
          <LayerClose>
            <Button variant="secondary" onClick={() => toast("已把页眉和页脚应用到所选 1 页", { undo: true })}>
              应用
            </Button>
          </LayerClose>
          <LayerClose>
            <Button variant="primary" onClick={() => toast("已把页眉和页脚应用到全部 6 页", { undo: true })}>
              全部应用
            </Button>
          </LayerClose>
        </>
      }
    >
      <div className="grid grid-cols-[1fr_160px] gap-5">
        <div className="flex min-w-0 flex-col gap-1">
          <CheckRow label="日期和时间" defaultChecked />
          <div role="radiogroup" aria-label="日期更新方式" className="mb-1 flex flex-col gap-1 pl-6">
            <div className="flex items-center gap-2">
              <RadioRow checked label="自动更新" className="w-[88px] shrink-0" />
              <MenuField aria="日期格式" items={ZH_FORMATS} defaultValue="2026/9/30" className="min-w-0 flex-1" />
              <MenuField aria="日期语言" items={LANGS} defaultValue="中文（中国）" className="w-32 shrink-0" />
            </div>
            <div className="flex items-center gap-2">
              <RadioRow checked={false} label="固定" className="w-[88px] shrink-0" />
              <TextField aria="固定日期文本" defaultValue="2026/9/30" disabled reason="选「固定」后可编辑" className="flex-1" />
            </div>
          </div>
          <CheckRow label="幻灯片编号" defaultChecked={number} disabled={numberMissing} reason={numberMissing ? "当前版式没有此占位符" : undefined} hint={numberMissing ? "当前版式没有此占位符" : undefined} />
          <CheckRow label="页脚" defaultChecked />
          <div className="mb-1 pl-6">
            <TextField aria="页脚文字" defaultValue={FOOTER} />
          </div>
          <div aria-hidden="true" className="my-1 h-px bg-(--v3-border)" />
          <CheckRow label="标题幻灯片中不显示" defaultChecked />
        </div>

        <figure className="flex flex-col gap-2">
          <figcaption className="flex h-7 items-center text-[12px] leading-none text-(--v3-text-2)">预览 · 第 4 页</figcaption>
          <Preview date number={number} footer numberMissing={numberMissing} />
          <p className="text-[12px] leading-[18px] text-(--v3-text-2)">
            {summary.map((t, i) => (
              <Fragment key={t}>
                {i > 0 && " · "}
                <span className="whitespace-nowrap">{t}</span>
              </Fragment>
            ))}
          </p>
        </figure>
      </div>
    </Dialog>
  )
}

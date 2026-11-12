/**
 * 键位写法（rulings §4.25 TB-106，PRD ED-16「快捷键提示文案本地化」）：菜单、工具提示、快捷键面板与命令面板同一种写法（第 3 批转正时由 scenarios/shortcuts/keys.ts 并入底座）。
 * 和弦用平台无关的记法写一次（Mod 在 macOS 为 ⌘、其余为 Ctrl，同 50/10 §10.4），按平台格式化：
 *   - macOS：修饰键按 ⌃⌥⇧⌘ 的顺序连写在键名前（与主菜单、工具提示一致：⇧⌘Z、⌥⌘M、⇧F5）；
 *   - Windows / Linux：Ctrl、Alt、Shift 依次用「+」连接（Ctrl+Shift+Z、Ctrl+Alt+M、Shift+F5）。
 * 记法：「+」分隔，修饰键 Mod / Ctrl / Alt / Shift，其余是键名；Enter、Backspace、Delete、Esc、Space、Tab、Arrows（方向键）、
 * Up / Down / Left / Right、PageUp / PageDown、Home / End、Plus / Minus / Equal、Digits（数字）按平台换写法，其余（字母、F5、[ ]、> <、, /）原样。
 * 底层按 KeyboardEvent.code 匹配、不依赖键位字符（ED-16），这里只管显示。
 */

export type Platform = "mac" | "win"

const MAC_MOD: Record<string, string> = { Ctrl: "⌃", Alt: "⌥", Shift: "⇧", Mod: "⌘" }
/** macOS 修饰键顺序（⌃⌥⇧⌘，09 §3.4 菜单条目规范 3） */
const MAC_ORDER = ["Ctrl", "Alt", "Shift", "Mod"]
/** Windows / Linux：Ctrl（含 Mod）· Alt · Shift */
const WIN_ORDER = ["Mod", "Ctrl", "Alt", "Shift"]

const KEY_NAME: Record<string, { mac: string; win: string }> = {
  Enter: { mac: "↵", win: "Enter" },
  Backspace: { mac: "⌫", win: "Backspace" },
  Delete: { mac: "⌦", win: "Delete" },
  Esc: { mac: "Esc", win: "Esc" },
  Space: { mac: "空格", win: "空格" },
  Tab: { mac: "Tab", win: "Tab" },
  Arrows: { mac: "方向键", win: "方向键" },
  Up: { mac: "↑", win: "↑" },
  Down: { mac: "↓", win: "↓" },
  Left: { mac: "←", win: "←" },
  Right: { mac: "→", win: "→" },
  PageUp: { mac: "PageUp", win: "PageUp" },
  PageDown: { mac: "PageDown", win: "PageDown" },
  Home: { mac: "Home", win: "Home" },
  End: { mac: "End", win: "End" },
  // 放大 / 缩小：实际按的是 = 与 -（Mod+= / Mod+-），macOS 的提示照主菜单写 ⌘+ / ⌘−（PRD ED-16）；Windows 写实际的键
  Plus: { mac: "+", win: "=" },
  Minus: { mac: "−", win: "-" },
  Equal: { mac: "=", win: "=" },
  Digits: { mac: "数字", win: "数字" },
}

/** 一个和弦按平台的写法，如 formatChord("Shift+Mod+Z", "mac") → "⇧⌘Z"，"win" → "Ctrl+Shift+Z"；「数字 ↵」这种两步的键名之间留一个空格 */
export function formatChord(chord: string, p: Platform): string {
  const parts = chord.split("+").filter(Boolean)
  const mods = parts.filter((x) => x in MAC_MOD)
  const keys = parts.filter((x) => !(x in MAC_MOD)).map((k) => KEY_NAME[k]?.[p] ?? k)
  if (p === "mac") {
    const lead = MAC_ORDER.filter((m) => mods.includes(m))
      .map((m) => MAC_MOD[m])
      .join("")
    // 修饰键与中文键名之间留空（⇧ 方向键），与单字符键连写（⇧⌘Z）
    const body = keys.join(" ")
    return lead && /[㐀-鿿]/.test(body.charAt(0)) ? `${lead} ${body}` : `${lead}${body}`
  }
  const lead = WIN_ORDER.filter((m) => mods.includes(m)).map((m) => (m === "Mod" ? "Ctrl" : m))
  // Mod 与 Ctrl 同时写时只留一个 Ctrl
  const uniq = lead.filter((m, i) => lead.indexOf(m) === i)
  return [...uniq, keys.join(" ")].join("+")
}

/** 几个可互换的和弦的读法：两个用「或」，三个及以上「、」分隔、最后一个前用「或」（如「→、空格 或 PageDown」） */
export function joinAlternatives(list: string[]): string {
  if (list.length <= 1) return list[0] ?? ""
  return `${list.slice(0, -1).join("、")} 或 ${list[list.length - 1]}`
}

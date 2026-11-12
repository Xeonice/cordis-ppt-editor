import type { Tone } from "../ui"

/**
 * 身份色 12 色板（PRD CO-03「按用户 id 稳定哈希分配 12 色板」，设计 05 §2、04 §2.4）的哈希顺序：产品的 --presence-1…12 按这个顺序对应。
 * 前 5 色（slate sand sage clay mist）是第 1 批定稿的，后 7 色是第 2 批补足的（v3.css --v3-tone-*，rulings §4.25 DS-42 定稿）。
 * 顺序按「相邻两色尽量不像」排过（OKLab ΔE ≥ 8）：撞色顺延到下一个索引时，不会落到相近的颜色上。
 */
export const TONES: readonly Tone[] = ["slate", "sand", "sage", "clay", "mist", "olive", "iris", "lake", "rose", "denim", "plum", "moss"]

/** FNV-1a 32 位（与 40-modules/17 的 packages/shared/src/hash.ts fnv1a 同一算法：逐个 UTF-16 码元），返回无符号整数。 */
export function fnv1a32(input: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/**
 * 按用户 id 稳定取身份色：index = hash(userId) mod 12（05 §2、50/07 §11）。同一个 id 永远是同一个色；
 * 集成方给了颜色时用集成方的（样张里即 Person.tone 直接写死，如 data.ts 的 ME / WANG / LI / ZHANG）。
 *
 *   const CHEN: Person = { name: "陈静", tone: toneOf("u-chen") }
 */
export function toneOf(userId: string): Tone {
  return TONES[fnv1a32(userId) % TONES.length]!
}

/**
 * 同屏一组协作者的身份色（05 §2「与已在场的协作者撞色时顺延到下一个未占用的索引」）：按在场顺序逐个取 toneOf，
 * 已被前面的人占用就顺延；同一个 id 出现多次（多个会话）取同一个色；满 12 人后第 13 位起复用哈希色（产品在头像上加序号角标区分）。
 * 返回与 userIds 一一对应的色。
 *
 *   const [a, b, c] = assignTones(["u-chen", "u-liu", "u-zhao"])
 */
export function assignTones(userIds: readonly string[]): Tone[] {
  const used = new Set<number>()
  const byId = new Map<string, number>()
  return userIds.map((id) => {
    const known = byId.get(id)
    if (known !== undefined) return TONES[known]!
    let i = fnv1a32(id) % TONES.length
    if (used.size < TONES.length) {
      while (used.has(i)) i = (i + 1) % TONES.length
      used.add(i)
    }
    byId.set(id, i)
    return TONES[i]!
  })
}

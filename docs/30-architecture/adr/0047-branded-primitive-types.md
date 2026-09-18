> 状态：草稿 | 负责：架构-类型治理 | 更新：2026-09-14 | 依赖：charter v0.1

# ADR-0047：品牌原始类型（Branded Primitive Types）

## 状态

提议中（M0 蓝图阶段）。

## 背景

TypeScript 是结构化类型系统：两个字段完全相同的接口互相兼容，两个都叫 `number` 的值（一个代表 EMU 长度、一个代表页面序号）在类型层面完全不可区分。章程 §4 术语表已经点名了一批"概念上不是裸原始类型"的量：`Emu`、`Pt`（度量单位）、`UnitId`、`SlideId`、`ShapeId`（标识符）。如果这些概念在代码里就是普通的 `number`/`string`，编译器无法阻止"把一个像素值传给期望 EMU 的参数"或"把 `ShapeId` 和 `SlideId` 传反"这类错误——这正是本项目大量涉及单位换算（[engine-layout](../../30-architecture/07-rendering.md)，架构-运行时 B 拥有）与多级标识符（`Unit`/`Slide`/`Shape` 层层嵌套）场景下的高风险 bug 来源。

## 决策

采用"品牌类型"（branded / nominal typing 的结构化近似）模式：

```ts
// 示意，定义于 @oce/shared
type Brand<T, TBrand extends string> = T & { readonly __brand: TBrand }
type Emu = Brand<number, 'Emu'>
type UnitId = Brand<string, 'UnitId'>
```

每个品牌类型配一个同名小写开头的构造函数 + 一个 zod schema（[05§4](../09-type-discipline/05-runtime-boundaries.md#4-品牌类型branded-types)），构造函数是唯一合法的"裸值 → 品牌类型"入口，内部做真正的校验（范围/格式），不是简单包一层类型断言。除 `@oce/shared` 自身外，其余代码不得用 `as` 构造品牌类型——这一点由 [ADR-0041](./0041-assertion-policy.md) 的断言禁令自动闭合，不需要品牌类型模式本身再发明一条新规则。

模式统一应用于：度量单位（`Emu`、`Pt`，未来视需要扩展的其他 OOXML 单位）、标识符（`UnitId`、`SlideId`、`ShapeId`，以及模式天然延伸到的任何新增 `*Id` 类型，如 `MasterId`、`ThemeId`、`CommentId`）。

## 备选方案与放弃原因

| 方案 | 放弃原因 |
|---|---|
| 包装类（wrapper class，如 `class Emu { constructor(public readonly value: number) {} }`） | 有运行时开销（每个值都是一个对象，而不是编译期擦除的类型标注）；序列化/反序列化（跨 Snapshot、跨网络协议边界）需要显式拆箱/装箱逻辑，与"品牌类型编译期擦除、运行时就是原始值，序列化零成本"的目标冲突；相等性判断也从"值相等"变成需要自定义 `equals` 或依赖引用相等，容易踩坑 |
| `unique symbol` 标记的不透明类型（opaque type，如 `declare const EmuBrand: unique symbol; type Emu = number & { [EmuBrand]: true }`） | 与本方案采用的字符串字面量品牌（`{ readonly __brand: 'Emu' }`）本质等价，都是"交叉类型 + 一个编译期专用字段"的近似 nominal typing；字符串字面量版本的报错信息更易读（`Type 'number' is not assignable to type 'Emu'` 类信息里能看到 `'Emu'` 这个具体名字，`unique symbol` 版本的报错信息通常更晦涩，指向一个不具名的 symbol），且字符串字面量版本在 IDE 悬浮提示里更直观，故选择字符串字面量形式，功能上两者可视为同一决策的两种实现细节，本 ADR 不因此产生实质分歧 |
| 不做品牌化，靠命名约定（参数名带 `Emu`/`Id` 后缀）与代码评审 | 命名约定不是编译器能验证的东西，函数体内部把 `emuValue` 和 `ptValue` 传反不会有任何提示；本项目 R7 的立场是"能用类型系统表达的约束就不要退化成命名约定" |

## 后果

**正面**：度量单位与标识符的误用（传错单位、传错 id 类型）在**编译期**就会报错，而不是等到渲染出现肉眼可见的错位、或协同状态出现"改到了别的形状"这类难以定位的 bug 才被发现；构造函数集中了校验逻辑，避免校验散落在各个调用点、口径不一致。

**负面**：品牌类型无法完全消除"新增一个公开函数签名时，作者忘记用品牌类型、写成裸 `number`/`string`"这一疏漏——这是本 ADR 主动承认的机械化边界（见 [05§4.3](../09-type-discipline/05-runtime-boundaries.md#43-执行边界的诚实说明)），依赖 [04](../09-type-discipline/04-api-surface.md) 的 API diff 评审兜底，不是一个纯自动化闭环；与外部库/OOXML 原始解析结果交互的边界代码需要频繁调用构造函数做"裸值进、品牌值出"的转换，有一定样板代码量。

## 如何被机械验证

- 品牌类型不被绕过：[ADR-0041](./0041-assertion-policy.md) 的 `as`/`!` 禁令（间接闭合"绕过构造函数直接断言"的路径）。
- 构造函数是唯一入口：代码评审 + `@oce/shared` 目录内聚约定（品牌类型定义与构造函数相邻存放，便于评审者一并核对）；未设独立 AST 规则限定"只有 `@oce/shared` 能构造品牌类型"，因为 TS 的品牌交叉类型本身在结构上允许任何持有正确形状对象的代码通过（这是结构化类型系统的固有特性，非本方案能完全封堵的点，记录为已知限制）。

## 关联

- 章程 §4 术语表（`Emu`/`Pt`/`UnitId`/`SlideId`/`ShapeId` 的原始定义）。
- [05-runtime-boundaries.md §4](../09-type-discipline/05-runtime-boundaries.md#4-品牌类型branded-types)（模式细节与执行边界说明）、[ADR-0041](./0041-assertion-policy.md)（断言禁令，品牌类型不被绕过的直接机制）。

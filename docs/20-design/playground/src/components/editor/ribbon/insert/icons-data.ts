import type { ComponentType } from "react"
import {
  ArrowBigRight, Award, BadgeDollarSign, BookOpen, Bot, BrainCircuit, Briefcase, Building, Bus, Calendar, Car, ChartColumnBig,
  ChartLine, ChartPie, CircleCheck, CircleX, ClipboardCheck, Clock, Cloud, Coins, Compass, Contact, Cpu, Database, Droplet,
  Factory, FileText, Flag, Flame, Gauge, Gift, Globe, GraduationCap, Handshake, Heart, Hourglass, House, Info, Key, Landmark,
  Laptop, Layers, Leaf, Lightbulb, ListChecks, Lock, Mail, MapPin, Medal, Megaphone, MessageCircle, Mountain, Network, Package,
  PenTool, Phone, PiggyBank, Plane, Presentation, Puzzle, Recycle, RefreshCw, Rocket, Scale, School, Send, Server, ShieldCheck,
  Ship, ShoppingCart, Sigma, Smartphone, Sparkles, Sprout, Star, Sun, Target, ThumbsUp, TrainFront, Trees, TrendingDown,
  TrendingUp, TriangleAlert, Trophy, Truck, UserCheck, UserRound, Users, Wallet, Wifi, Workflow, Zap, Bell,
} from "lucide-react"

/**
 * 图标面板样张数据（rulings §4.21：图标 M3 P2，图标集用 lucide-static（ISC），中文检索词自建映射）。
 * playground 用同一套 Lucide 的 React 组件演示；产品里插入的是 SVG 字节（currentColor 换成主题 tx1），成为图片元素。
 * `name` 是中文名（aria-label、替代文本预填、检索主词），`kw` 是补充检索词。
 */
export interface IconDef {
  id: string
  name: string
  kw?: string
  icon: ComponentType<{ className?: string; strokeWidth?: number }>
}

export interface IconCategory {
  id: string
  label: string
  items: IconDef[]
}

const I = (id: string, name: string, icon: IconDef["icon"], kw?: string): IconDef => ({ id, name, icon, kw })

export const iconCategories: IconCategory[] = [
  { id: "business", label: "商务", items: [
    I("briefcase", "公文包", Briefcase, "工作 职业"), I("handshake", "握手", Handshake, "合作 签约"), I("building", "办公楼", Building, "公司 企业"),
    I("landmark", "机构", Landmark, "银行 政府"), I("coins", "硬币", Coins, "资金 收入"), I("wallet", "钱包", Wallet, "支付"),
    I("piggy-bank", "储蓄", PiggyBank, "存钱 预算"), I("badge-dollar", "价格", BadgeDollarSign, "美元 收费"), I("cart", "购物车", ShoppingCart, "电商 采购"),
    I("package", "包裹", Package, "产品 物流"), I("gift", "礼物", Gift, "福利"), I("factory", "工厂", Factory, "制造 生产"),
    I("scale", "天平", Scale, "法律 平衡"), I("presentation", "演示", Presentation, "汇报 培训"),
  ] },
  { id: "data", label: "数据", items: [
    I("trending-up", "增长", TrendingUp, "上升 趋势"), I("trending-down", "下降", TrendingDown, "下滑 趋势"), I("chart-column", "柱形图", ChartColumnBig, "统计"),
    I("chart-pie", "饼图", ChartPie, "占比 构成"), I("chart-line", "折线图", ChartLine, "趋势"), I("gauge", "仪表盘", Gauge, "指标 KPI"),
    I("target", "目标", Target, "靶心 KPI"), I("database", "数据库", Database, "存储"), I("sigma", "求和", Sigma, "合计 公式"),
    I("layers", "分层", Layers, "架构"), I("workflow", "流程", Workflow, "步骤"), I("network", "网络", Network, "结构 关系"),
  ] },
  { id: "people", label: "人物与沟通", items: [
    I("users", "团队", Users, "人员 群组"), I("user", "用户", UserRound, "个人"), I("user-check", "已认证用户", UserCheck, "审核"),
    I("contact", "联系人", Contact, "名片"), I("mail", "邮件", Mail, "信"), I("phone", "电话", Phone, "呼叫"),
    I("message", "消息", MessageCircle, "对话 沟通"), I("megaphone", "广播", Megaphone, "宣传 公告"), I("bell", "通知", Bell, "提醒"),
    I("send", "发送", Send, "提交"), I("thumbs-up", "点赞", ThumbsUp, "好评 认可"), I("heart", "喜爱", Heart, "爱心 健康"),
  ] },
  { id: "tech", label: "科技", items: [
    I("cloud", "云", Cloud, "云计算"), I("server", "服务器", Server, "机房"), I("cpu", "芯片", Cpu, "处理器 算力"),
    I("smartphone", "手机", Smartphone, "移动"), I("laptop", "笔记本电脑", Laptop, "电脑 办公"), I("wifi", "无线网络", Wifi, "联网"),
    I("shield", "安全", ShieldCheck, "防护 合规"), I("lock", "锁", Lock, "隐私 加密"), I("key", "钥匙", Key, "权限 密钥"),
    I("bot", "机器人", Bot, "AI 自动化"), I("brain", "智能", BrainCircuit, "AI 大脑"), I("sparkles", "亮点", Sparkles, "AI 新功能"),
    I("zap", "闪电", Zap, "快速 能源"), I("puzzle", "拼图", Puzzle, "插件 集成"),
  ] },
  { id: "education", label: "教育", items: [
    I("book", "书本", BookOpen, "阅读 学习"), I("graduation", "学位帽", GraduationCap, "毕业 教育"), I("school", "学校", School, "校园"),
    I("pen", "钢笔", PenTool, "设计 书写"), I("lightbulb", "灯泡", Lightbulb, "想法 创意"), I("clipboard", "核对清单", ClipboardCheck, "检查 验收"),
    I("list-checks", "待办", ListChecks, "任务 清单"), I("file", "文档", FileText, "文件 报告"),
  ] },
  { id: "nature", label: "自然", items: [
    I("leaf", "叶子", Leaf, "环保 绿色"), I("sun", "太阳", Sun, "晴天 能源"), I("trees", "树林", Trees, "森林"),
    I("sprout", "新芽", Sprout, "成长 初创"), I("mountain", "山峰", Mountain, "挑战 户外"), I("droplet", "水滴", Droplet, "水"),
    I("flame", "火焰", Flame, "热门"), I("recycle", "循环", Recycle, "回收 可持续"),
  ] },
  { id: "travel", label: "交通与地点", items: [
    I("plane", "飞机", Plane, "出差 航空"), I("car", "汽车", Car, "出行"), I("bus", "公交", Bus, "通勤"),
    I("train", "火车", TrainFront, "高铁"), I("ship", "轮船", Ship, "海运"), I("truck", "货车", Truck, "物流 运输"),
    I("map-pin", "位置", MapPin, "地点 定位"), I("compass", "指南针", Compass, "方向 导航"), I("globe", "地球", Globe, "全球 国际"),
    I("house", "房屋", House, "家 首页"),
  ] },
  { id: "signs", label: "标志与提示", items: [
    I("award", "奖章", Award, "荣誉"), I("trophy", "奖杯", Trophy, "冠军 成就"), I("medal", "奖牌", Medal, "名次"),
    I("flag", "旗帜", Flag, "里程碑"), I("star", "星标", Star, "收藏 评分"), I("check", "完成", CircleCheck, "正确 通过"),
    I("x", "错误", CircleX, "否 失败"), I("alert", "警告", TriangleAlert, "风险 注意"), I("info", "信息", Info, "说明"),
    I("clock", "时钟", Clock, "时间"), I("calendar", "日历", Calendar, "日期 日程"), I("hourglass", "沙漏", Hourglass, "等待 期限"),
    I("rocket", "火箭", Rocket, "发布 启动"), I("arrow", "箭头", ArrowBigRight, "下一步 前进"), I("refresh", "刷新", RefreshCw, "循环 迭代"),
  ] },
]

export const allIcons: IconDef[] = iconCategories.flatMap((c) => c.items)

/** 中文名、补充词与英文 id 一起参与检索 */
export function matchIcon(icon: IconDef, q: string) {
  const s = q.trim().toLowerCase()
  if (!s) return true
  return icon.name.includes(s) || (icon.kw ?? "").toLowerCase().includes(s) || icon.id.includes(s)
}

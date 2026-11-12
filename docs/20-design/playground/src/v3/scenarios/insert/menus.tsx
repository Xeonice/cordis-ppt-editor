/**
 * insert 场景的菜单数据：工具条「更多」与「图片 ▾」的条目已收进底座（editor/insert-menus.tsx，真实工具条与场景静态打开的菜单同一份），这里转出。
 *   - 文本框、形状、图片、表格、图表、评论：底部工具条各自的工具（图片 ▾ 见 IMAGE_MENU）；
 *   - 其余插入项进工具条「更多」（moreMenu）：页眉和页脚、日期和时间、幻灯片编号、符号、公式、图标、视频、音频、链接、插件贡献项；
 *   - 主菜单「插入」列出全部插入命令，是不常驻的第二入口（Q2 不算重复）：条目在 kit/mainMenu.tsx 的 INSERT_ITEMS。
 */
export { IMAGE_MENU, moreMenu } from "../../kit"

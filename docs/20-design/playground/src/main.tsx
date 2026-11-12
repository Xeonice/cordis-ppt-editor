import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { HashRouter } from "react-router-dom"
import "./index.css"
import { initTheme } from "./lib/theme"
import { App } from "./App"

initTheme()

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)

// 嵌入式宿主（artifact 查看器）可能在页面首次渲染前就完成了尺寸测量；挂载与字体就绪后各"戳"一次，促使宿主重新测量/重绘。
const poke = () => {
  window.dispatchEvent(new Event("resize"))
  window.dispatchEvent(new Event("scroll"))
}
requestAnimationFrame(poke)
document.fonts?.ready.then(() => requestAnimationFrame(poke))

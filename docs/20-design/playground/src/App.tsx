import { lazy, Suspense } from "react"
import { Route, Routes } from "react-router-dom"
import { Spinner } from "@/components/ui/spinner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"

const Hub = lazy(() => import("./routes/Hub").then((m) => ({ default: m.Hub })))
const Styleguide = lazy(() => import("./routes/Styleguide").then((m) => ({ default: m.Styleguide })))
const EditorMain = lazy(() => import("./routes/editor/Main").then((m) => ({ default: m.EditorMain })))
const EditorMasters = lazy(() => import("./routes/editor/Masters").then((m) => ({ default: m.EditorMasters })))
const EditorLayouts = lazy(() => import("./routes/editor/Layouts").then((m) => ({ default: m.EditorLayouts })))
const EditorDesign = lazy(() => import("./routes/editor/Design").then((m) => ({ default: m.EditorDesign })))
const Home = lazy(() => import("./routes/Home").then((m) => ({ default: m.Home })))
const Documents = lazy(() => import("./routes/Documents").then((m) => ({ default: m.Documents })))
const Import = lazy(() => import("./routes/Import").then((m) => ({ default: m.Import })))
const EditorInsert = lazy(() => import("./routes/editor/Insert").then((m) => ({ default: m.EditorInsert })))
const EditorText = lazy(() => import("./routes/editor/TextEditing").then((m) => ({ default: m.EditorText })))
const EditorTable = lazy(() => import("./routes/editor/TableEditing").then((m) => ({ default: m.EditorTable })))
const EditorChart = lazy(() => import("./routes/editor/ChartEditing").then((m) => ({ default: m.EditorChart })))
const EditorComments = lazy(() => import("./routes/editor/Comments").then((m) => ({ default: m.EditorComments })))
const EditorHistory = lazy(() => import("./routes/editor/History").then((m) => ({ default: m.EditorHistory })))
const EditorShare = lazy(() => import("./routes/editor/Share").then((m) => ({ default: m.EditorShare })))
const EditorPlugins = lazy(() => import("./routes/editor/Plugins").then((m) => ({ default: m.EditorPlugins })))
const EditorFidelity = lazy(() => import("./routes/editor/Fidelity").then((m) => ({ default: m.EditorFidelity })))
const Export = lazy(() => import("./routes/Export").then((m) => ({ default: m.Export })))
const Present = lazy(() => import("./routes/Present").then((m) => ({ default: m.Present })))
const Viewer = lazy(() => import("./routes/Viewer").then((m) => ({ default: m.Viewer })))
const Settings = lazy(() => import("./routes/Settings").then((m) => ({ default: m.Settings })))
const Offline = lazy(() => import("./routes/Offline").then((m) => ({ default: m.Offline })))

/** 路由级代码分割：artifact 查看器等嵌入环境首屏只需当前路由的代码。 */
export function App() {
  return (
    <TooltipProvider delayDuration={400}>
      <Suspense fallback={<div className="flex h-dvh items-center justify-center bg-canvas"><Spinner className="size-6" /></div>}>
      <Routes>
        <Route path="/" element={<Hub />} />
        <Route path="/styleguide" element={<Styleguide />} />
        <Route path="/editor" element={<EditorMain />} />
        <Route path="/editor/masters" element={<EditorMasters />} />
        <Route path="/editor/layouts" element={<EditorLayouts />} />
        <Route path="/editor/design" element={<EditorDesign />} />
        <Route path="/home" element={<Home />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/import" element={<Import />} />
        <Route path="/editor/insert" element={<EditorInsert />} />
        <Route path="/editor/text" element={<EditorText />} />
        <Route path="/editor/table" element={<EditorTable />} />
        <Route path="/editor/chart" element={<EditorChart />} />
        <Route path="/editor/comments" element={<EditorComments />} />
        <Route path="/editor/history" element={<EditorHistory />} />
        <Route path="/editor/share" element={<EditorShare />} />
        <Route path="/editor/plugins" element={<EditorPlugins />} />
        <Route path="/editor/fidelity" element={<EditorFidelity />} />
        <Route path="/export" element={<Export />} />
        <Route path="/present" element={<Present />} />
        <Route path="/viewer" element={<Viewer />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/offline" element={<Offline />} />
      </Routes>
      </Suspense>
      <Toaster position="bottom-right" />
    </TooltipProvider>
  )
}

import { Fragment } from "react"

/**
 * 中文长句按词组换行（Q7：不断在词中间，如「公 / 式」「折 / 线」「缩 / 放」）：每段整体不折行，段与段之间才可以断（<wbr>）。
 * 分段时让每段都放得下最窄的容器（检查器 280 内约 17 个汉字），超长的段会溢出。
 */
export function Phrases({ parts }: { parts: string[] }) {
  return (
    <>
      {parts.map((p, i) => (
        <Fragment key={i}>
          {i > 0 && <wbr />}
          <span className="whitespace-nowrap">{p}</span>
        </Fragment>
      ))}
    </>
  )
}

import './style.css'
import { createStage } from './render/stage'

const container = document.querySelector<HTMLDivElement>('#app')
if (!container) throw new Error('#app が見つからない')

const stage = createStage(container)

// ループのハンドルを握っておく。停止手段の無い rAF は、破棄済みのレンダラを
// 呼び続けることになる（M4 のリザルト → リトライで効いてくる）
let frame = 0
function loop(elapsedMs: number) {
  // requestAnimationFrame が渡すのはミリ秒。秒に直してシェーダへ渡す
  stage.render(elapsedMs / 1000)
  frame = requestAnimationFrame(loop)
}
frame = requestAnimationFrame(loop)

// 開発中のホットリロードで、古いループとレンダラが積み上がるのを防ぐ
import.meta.hot?.dispose(() => {
  cancelAnimationFrame(frame)
  stage.dispose()
})

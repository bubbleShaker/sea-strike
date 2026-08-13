import './style.css'
import { createStage } from './render/stage'

const container = document.querySelector<HTMLDivElement>('#app')
if (!container) throw new Error('#app が見つからない')

const stage = createStage(container)

// requestAnimationFrame が渡すのはミリ秒。秒に直してシェーダへ渡す
function loop(elapsedMs: number) {
  stage.render(elapsedMs / 1000)
  requestAnimationFrame(loop)
}
requestAnimationFrame(loop)

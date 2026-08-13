import './style.css'
import { createStage } from './render/stage'
import { createSwipeSource } from './input/swipe'
import { createFlightState, stepFlight } from './game/flight'
import { createCrosshair } from './ui/crosshair'

const container = document.querySelector<HTMLDivElement>('#app')
if (!container) throw new Error('#app が見つからない')

const stage = createStage(container)
const aimSource = createSwipeSource(container)
createCrosshair(container)

let flight = createFlightState()
let lastMs = performance.now()

/**
 * タブを離れて戻ったときの dt は数秒に達しうる。そのまま積むと機体が瞬間移動するので、
 * 1 フレーム分の進みに上限を置く（進みが遅くなるだけで、破綻はしない）
 */
const MAX_STEP = 1 / 20

// ループのハンドルを握っておく。停止手段の無い rAF は、破棄済みのレンダラを
// 呼び続けることになる（M4 のリザルト → リトライで効いてくる）
let frame = 0
function loop(nowMs: number) {
  const dt = Math.min((nowMs - lastMs) / 1000, MAX_STEP)
  lastMs = nowMs

  flight = stepFlight(flight, aimSource.read(), dt)
  stage.render(nowMs / 1000, flight)

  frame = requestAnimationFrame(loop)
}
frame = requestAnimationFrame(loop)

// 開発中のホットリロードで、古いループとレンダラが積み上がるのを防ぐ
import.meta.hot?.dispose(() => {
  cancelAnimationFrame(frame)
  aimSource.dispose()
  stage.dispose()
})

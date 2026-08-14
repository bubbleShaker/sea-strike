import './style.css'
import { createStage } from './render/stage'
import { createSwipeSource } from './input/swipe'
import { createTiltWithSwipeFallback } from './input/combined'
import type { AimSource } from './input/aim'
import { createFlightState, stepFlight } from './game/flight'
import { createCrosshair } from './ui/crosshair'
import { createModeBadge } from './ui/mode-badge'
import { showStartScreen } from './ui/start-screen'

const container = document.querySelector<HTMLDivElement>('#app')
if (!container) throw new Error('#app が見つからない')

/**
 * タブを離れて戻ったときの dt は数秒に達しうる。そのまま積むと機体が瞬間移動するので、
 * 1 フレーム分の進みに上限を置く（進みが遅くなるだけで、破綻はしない）
 */
const MAX_STEP = 1 / 20

const stage = createStage(container)
createCrosshair(container)
const modeBadge = createModeBadge(container)

let flight = createFlightState()
let lastMs = performance.now()
let frame = 0
let aimSource: AimSource | null = null

function loop(nowMs: number) {
  const dt = Math.min((nowMs - lastMs) / 1000, MAX_STEP)
  lastMs = nowMs

  if (aimSource) {
    flight = stepFlight(flight, aimSource.read(), dt)
    modeBadge.update(aimSource)
  }
  stage.render(nowMs / 1000, flight)

  frame = requestAnimationFrame(loop)
}
// 開始画面の裏でも海は流しておく。選ぶ間に世界が止まっていると、書き割りに見える
frame = requestAnimationFrame(loop)

const choice = await showStartScreen(container)
aimSource =
  choice === 'tilt' ? createTiltWithSwipeFallback(container) : createSwipeSource(container)
// 選び終えた直後は dt が開始画面の滞在時間ぶん開いている。積まないよう測り直す
lastMs = performance.now()

// 開発中のホットリロードで、古いループとレンダラが積み上がるのを防ぐ
import.meta.hot?.dispose(() => {
  cancelAnimationFrame(frame)
  aimSource?.dispose()
  stage.dispose()
})

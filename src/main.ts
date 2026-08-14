import './style.css'
import { createStage } from './render/stage'
import { createSwipeSource } from './input/swipe'
import { createTiltWithSwipeFallback } from './input/combined'
import type { AimSource } from './input/aim'
import { createWorld, stepWorld } from './game/world'
import { createCrosshair } from './ui/crosshair'
import { createModeBadge } from './ui/mode-badge'
import { createFireButton } from './ui/fire-button'
import { createWeaponSelector } from './ui/weapon-selector'
import { createHud } from './ui/hud'
import { showStartScreen } from './ui/start-screen'

const container = document.querySelector<HTMLDivElement>('#app')
if (!container) throw new Error('#app が見つからない')

/**
 * タブを離れて戻ったときの dt は数秒に達しうる。そのまま積むと機体が瞬間移動するので、
 * 1 フレーム分の進みに上限を置く（進みが遅くなるだけで、破綻はしない）
 */
const MAX_STEP = 1 / 20

const stage = createStage(container)
const crosshair = createCrosshair(container)
const hud = createHud(container)
const fireButton = createFireButton(container)
const weaponSelector = createWeaponSelector(container)

let world = createWorld()
let lastMs = performance.now()
let frame = 0
let aimSource: AimSource | null = null
/** 傾きの基準を取り直す手段。スワイプで始めた場合は何もしない */
let recenter: (() => void) | null = null

const modeBadge = createModeBadge(container, () => recenter?.())

function loop(nowMs: number) {
  const dt = Math.min((nowMs - lastMs) / 1000, MAX_STEP)
  lastMs = nowMs

  if (aimSource) {
    world = stepWorld(
      world,
      { aim: aimSource.read(), firing: fireButton.isFiring(), weapon: weaponSelector.current() },
      dt,
    )
    modeBadge.update(aimSource.kind)
    weaponSelector.update(world)
    hud.update(world)
  }
  stage.render(nowMs / 1000, dt, world)

  frame = requestAnimationFrame(loop)
}
// 開始画面の裏でも海は流しておく。選ぶ間に世界が止まっていると、書き割りに見える
frame = requestAnimationFrame(loop)

// 開発中のホットリロードで、古いループ・レンダラ・DOM が積み上がるのを防ぐ。
// 開始画面を待つ前に登録しておかないと、選ぶ前に保存した時に取りこぼす
import.meta.hot?.dispose(() => {
  cancelAnimationFrame(frame)
  aimSource?.dispose()
  fireButton.dispose()
  weaponSelector.dispose()
  stage.dispose()
  crosshair.remove()
  document.querySelectorAll('.mode-badge, .overlay, .hud').forEach((element) => element.remove())
})

const choice = await showStartScreen(container)
if (choice === 'tilt') {
  const combined = createTiltWithSwipeFallback(container)
  aimSource = combined
  recenter = () => combined.recenter()
} else {
  aimSource = createSwipeSource(container)
}
// 選び終えた直後は dt が開始画面の滞在時間ぶん開いている。積まないよう測り直す
lastMs = performance.now()

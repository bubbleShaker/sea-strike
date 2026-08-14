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
import { showResultScreen } from './ui/result-screen'

const root = document.querySelector<HTMLDivElement>('#app')
if (!root) throw new Error('#app が見つからない')
// 巻き上げられた関数から参照するため、null を剥いだ形で持ち直す
const container: HTMLElement = root

/**
 * タブを離れて戻ったときの dt は数秒に達しうる。そのまま積むと機体が瞬間移動するので、
 * 1 フレーム分の進みに上限を置く（進みが遅くなるだけで、破綻はしない）。
 * game 側もこの上限を前提にしている
 */
const MAX_STEP = 1 / 20

/** 決着してからリザルトを出すまでの間[ms]。撃墜の爆発は 0.8 秒で消える */
const RESULT_DELAY_MS = 750

const stage = createStage(container)
const crosshair = createCrosshair(container)
const hud = createHud(container)
const fireButton = createFireButton(container)
const weaponSelector = createWeaponSelector(container)

let world = createWorld()
let lastMs = performance.now()
let frame = 0
let aimSource: AimSource | null = null
/** 決着の画面を出している間は世界を進めない */
let settling = false
/** 決着のフレームを描き終えたら畳む、という予約 */
let settlePending = false

const modeBadge = createModeBadge(container, () => aimSource?.recenter())

function loop(nowMs: number) {
  const dt = Math.min((nowMs - lastMs) / 1000, MAX_STEP)
  lastMs = nowMs

  if (aimSource && !settling) {
    world = stepWorld(
      world,
      { aim: aimSource.read(), firing: fireButton.isFiring(), weapon: weaponSelector.current() },
      dt,
    )
    modeBadge.update(aimSource.kind)
    weaponSelector.update(world)
    hud.update(world)

    // 決着したら、その瞬間の通知（最後の撃墜や致命弾）を描画へ渡してから畳む。
    // ここで即座に settle() を呼ぶと、いちばん見せたい一撃の演出だけが出ない
    if (world.phase !== 'playing') {
      settling = true
      settlePending = true
    }
  }
  stage.render(nowMs / 1000, dt, world)

  if (settlePending) {
    settlePending = false
    // 渡し終えた通知は捨てる。世界は止まっているので、消さないと
    // 最後の爆発がリザルトの裏で毎フレーム焚かれ、光が焼き付く
    world = { ...world, events: [] }
    // 失敗しても settling を解いておかないと、以後ゲームが無言で止まる
    settle().catch(() => {
      settling = false
    })
  }

  frame = requestAnimationFrame(loop)
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** 決着 → リザルト → もう一度。海は流したまま、世界だけを作り直す */
async function settle() {
  const finished = world

  // 最後の爆発が広がり切るまでの間。すぐ画面を被せると、決着の一撃が
  // 出た瞬間に隠れる
  await wait(RESULT_DELAY_MS)
  await showResultScreen(container, finished)

  world = createWorld()
  // 入力は累積式なので、前回終わったときの向きが残っている。
  // 戻さないと、始まった瞬間に機体がそちらへ振られる
  aimSource?.recenter()
  hud.update(world)
  weaponSelector.update(world)
  // リザルトを見ていた時間ぶん dt が開いている。積まないよう測り直す
  lastMs = performance.now()
  settling = false
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
  hud.dispose()
  stage.dispose()
  crosshair.remove()
  document.querySelectorAll('.mode-badge, .overlay').forEach((element) => element.remove())
})

const choice = await showStartScreen(container)
aimSource =
  choice === 'tilt' ? createTiltWithSwipeFallback(container) : createSwipeSource(container)
// 選び終えた直後は dt が開始画面の滞在時間ぶん開いている。積まないよう測り直す
lastMs = performance.now()

import type { AimState } from '../game/flight'
import type { AimSource } from './aim'

/**
 * 画面の短辺のうち、この割合だけ指を動かせば照準が端まで振れる。
 * 端末の大きさが変わっても「同じ距離の指の動き」で同じだけ振れるよう、
 * ピクセルの絶対量ではなく画面サイズに対する比で持つ
 */
const TRAVEL_RATIO = 0.4

/** この属性を持つ要素の上で始まった操作は照準に使わない（発射ボタンなど） */
const IGNORE_SELECTOR = '[data-no-aim]'

/**
 * 指のドラッグを照準に変える。
 *
 * 累積式にしている（指を離しても振った角度が残る）。
 * 傾け操作では端末を傾け続けている限り角度が保たれるので、
 * 指を離すと中央へ戻る方式にすると、両者の手応えが揃わない。
 */
export function createSwipeSource(target: HTMLElement): AimSource {
  const aim: AimState = { x: 0, y: 0 }
  let activePointer: number | null = null
  let lastX = 0
  let lastY = 0

  const travel = () => Math.min(window.innerWidth, window.innerHeight) * TRAVEL_RATIO

  const clamp = (value: number) => Math.min(Math.max(value, -1), 1)

  const onPointerDown = (event: PointerEvent) => {
    if (activePointer !== null) return
    if (event.target instanceof Element && event.target.closest(IGNORE_SELECTOR)) return
    activePointer = event.pointerId
    lastX = event.clientX
    lastY = event.clientY
    // 指が要素の外へ出ても move / up を受け取り続けるための宣言。
    // これが無いと、画面の縁まで振ったところで操作が切れる
    target.setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerId !== activePointer) return
    const scale = travel()
    aim.x = clamp(aim.x + (event.clientX - lastX) / scale)
    // clientY は下が +。指を上へ動かしたときに上を向いてほしいので符号を反転する
    aim.y = clamp(aim.y - (event.clientY - lastY) / scale)
    lastX = event.clientX
    lastY = event.clientY
  }

  const onPointerEnd = (event: PointerEvent) => {
    if (event.pointerId !== activePointer) return
    activePointer = null
  }

  target.addEventListener('pointerdown', onPointerDown)
  target.addEventListener('pointermove', onPointerMove)
  target.addEventListener('pointerup', onPointerEnd)
  target.addEventListener('pointercancel', onPointerEnd)

  return {
    kind: 'swipe',
    read: () => aim,
    dispose() {
      target.removeEventListener('pointerdown', onPointerDown)
      target.removeEventListener('pointermove', onPointerMove)
      target.removeEventListener('pointerup', onPointerEnd)
      target.removeEventListener('pointercancel', onPointerEnd)
    },
  }
}

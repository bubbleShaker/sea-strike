import type { AimSource } from './aim'
import { createSwipeSource } from './swipe'
import { createTiltSource } from './tilt'

/**
 * 傾きを主に、反応が無い間はスワイプで操作できる入力源。
 *
 * 「傾けられない時」は端末が対応していない場合だけではない。許可はしたが
 * センサーが動かない、机に置いた、といった途中の事情もある。
 * どちらに転んでも操作不能にならないよう、両方の耳を開けたまま値だけを選ぶ。
 *
 * ゲーム側から見ればただの AimSource ひとつで、切り替わったことすら知らない。
 */
export function createTiltWithSwipeFallback(target: HTMLElement): AimSource {
  const tilt = createTiltSource()
  const swipe = createSwipeSource(target)

  return {
    get kind() {
      return tilt.hasSignal() ? ('tilt' as const) : ('swipe' as const)
    },
    read: () => (tilt.hasSignal() ? tilt.read() : swipe.read()),
    dispose() {
      tilt.dispose()
      swipe.dispose()
    },
  }
}

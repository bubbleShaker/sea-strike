import type { AimSource } from './aim'
import { createSwipeSource, type SwipeSource } from './swipe'
import { createTiltSource, type TiltSource } from './tilt'

export type CombinedAimSource = AimSource

/**
 * 傾きを主に、反応が無い間はスワイプで操作できる入力源。
 *
 * 「傾けられない時」は端末が対応していない場合だけではない。許可はしたが
 * センサーが動かない、机に置いた、といった途中の事情もある。
 * どちらに転んでも操作不能にならないよう、両方の耳を開けたまま値だけを選ぶ。
 *
 * 切り替わる瞬間には、引き継ぐ側を今の照準に合わせる。これをしないと、
 * 裏で溜まっていた値へ照準が瞬間移動する。
 *
 * ゲーム側から見ればただの AimSource ひとつで、切り替わったことすら知らない。
 */
export function combineTiltAndSwipe(tilt: TiltSource, swipe: SwipeSource): CombinedAimSource {
  let usingTilt = false

  const sync = () => {
    const active = tilt.hasSignal()
    if (active === usingTilt) return active
    // 直前まで見えていた照準を、これから使う側に引き継がせる
    const current = usingTilt ? tilt.read() : swipe.read()
    if (active) tilt.alignTo(current)
    else swipe.set(current)
    usingTilt = active
    return active
  }

  return {
    get kind() {
      return sync() ? ('tilt' as const) : ('swipe' as const)
    },
    read: () => (sync() ? tilt.read() : swipe.read()),
    // 両方戻す。どちらが効いているかに関わらず「中央に戻る」ことを保証したい
    recenter() {
      tilt.calibrate()
      swipe.recenter()
    },
    dispose() {
      tilt.dispose()
      swipe.dispose()
    },
  }
}

/** 実際の端末に繋いだ既定の組み合わせ */
export function createTiltWithSwipeFallback(target: HTMLElement): CombinedAimSource {
  return combineTiltAndSwipe(createTiltSource(), createSwipeSource(target))
}

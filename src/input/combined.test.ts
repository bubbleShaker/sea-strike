import { describe, expect, it } from 'vitest'
import { combineTiltAndSwipe } from './combined'
import type { AimState } from '../game/aim'
import type { TiltSource } from './tilt'
import type { SwipeSource } from './swipe'

/** センサーの有無を手で切り替えられる傾き入力 */
function fakeTilt(): TiltSource & { signal: boolean; aim: AimState; aligned: AimState | null } {
  return {
    kind: 'tilt',
    signal: false,
    aim: { x: 0, y: 0 },
    aligned: null,
    read() {
      return this.aim
    },
    hasSignal() {
      return this.signal
    },
    calibrate() {
      this.aim = { x: 0, y: 0 }
    },
    alignTo(target) {
      this.aligned = { ...target }
      this.aim = { ...target }
    },
    dispose() {},
  }
}

function fakeSwipe(): SwipeSource & { aim: AimState } {
  return {
    kind: 'swipe',
    aim: { x: 0, y: 0 },
    read() {
      return this.aim
    },
    set(next) {
      this.aim = { ...next }
    },
    dispose() {},
  }
}

describe('combineTiltAndSwipe', () => {
  it('センサーが黙っている間はスワイプの値を返す', () => {
    const tilt = fakeTilt()
    const swipe = fakeSwipe()
    swipe.aim = { x: 0.4, y: -0.2 }

    const source = combineTiltAndSwipe(tilt, swipe)
    expect(source.kind).toBe('swipe')
    expect(source.read()).toEqual({ x: 0.4, y: -0.2 })
  })

  it('センサーが動き出したら傾きに切り替わる', () => {
    const tilt = fakeTilt()
    const swipe = fakeSwipe()
    const source = combineTiltAndSwipe(tilt, swipe)

    tilt.signal = true
    expect(source.kind).toBe('tilt')
  })

  it('スワイプから傾きへ移るとき、照準が飛ばないよう引き継ぐ', () => {
    const tilt = fakeTilt()
    const swipe = fakeSwipe()
    swipe.aim = { x: 0.6, y: 0.3 }
    const source = combineTiltAndSwipe(tilt, swipe)
    source.read()

    tilt.signal = true
    expect(source.read()).toEqual({ x: 0.6, y: 0.3 })
    expect(tilt.aligned).toEqual({ x: 0.6, y: 0.3 })
  })

  it('傾きが途切れたとき、スワイプ側がその照準から続く', () => {
    const tilt = fakeTilt()
    const swipe = fakeSwipe()
    const source = combineTiltAndSwipe(tilt, swipe)

    tilt.signal = true
    source.read()
    tilt.aim = { x: 0.2, y: -0.5 }
    // 傾きで操作している間も、画面に触れた分がスワイプ側に溜まりうる
    swipe.aim = { x: -1, y: 1 }

    tilt.signal = false
    // 溜まっていた値へ飛ばず、直前に見えていた照準から続く
    expect(source.read()).toEqual({ x: 0.2, y: -0.5 })
  })

  it('recenter は傾きの基準を取り直す', () => {
    const tilt = fakeTilt()
    tilt.aim = { x: 0.9, y: 0.9 }
    const source = combineTiltAndSwipe(tilt, fakeSwipe())

    source.recenter()
    expect(tilt.aim).toEqual({ x: 0, y: 0 })
  })
})

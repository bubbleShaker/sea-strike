import { describe, expect, it } from 'vitest'
import { normalizeDegrees, tiltToAim, TILT_RANGE_DEG } from './tilt-math'

/** 基準は「端末をやや起こして持った」あたり。ここからの差分だけが照準になる */
const base = { beta: 45, gamma: 0 }

function aim(beta: number, gamma: number, screenAngleDeg = 0) {
  return tiltToAim({ beta, gamma, screenAngleDeg }, base)
}

describe('normalizeDegrees', () => {
  it('180 を跨ぐ差を短い方へ畳む', () => {
    expect(normalizeDegrees(350)).toBeCloseTo(-10)
    expect(normalizeDegrees(-350)).toBeCloseTo(10)
    expect(normalizeDegrees(10)).toBeCloseTo(10)
    expect(normalizeDegrees(180)).toBeCloseTo(-180)
  })
})

describe('tiltToAim（縦持ち）', () => {
  it('基準の姿勢では中央', () => {
    expect(aim(base.beta, base.gamma)).toEqual({ x: 0, y: 0 })
  })

  it('右へ倒すと右を向く', () => {
    expect(aim(base.beta, base.gamma + 13).x).toBeCloseTo(0.5)
  })

  it('左へ倒すと左を向く', () => {
    expect(aim(base.beta, base.gamma - 13).x).toBeCloseTo(-0.5)
  })

  it('端末の上端を下げると下を向く（覗き窓として振る舞う）', () => {
    expect(aim(base.beta - 13, base.gamma).y).toBeCloseTo(-0.5)
  })

  it('端末を起こすと上を向く', () => {
    expect(aim(base.beta + 13, base.gamma).y).toBeCloseTo(0.5)
  })

  it('傾けすぎても -1..1 を超えない', () => {
    expect(aim(base.beta + 90, base.gamma + 90).x).toBeLessThanOrEqual(1)
    expect(aim(base.beta - 90, base.gamma - 90).y).toBeGreaterThanOrEqual(-1)
  })
})

describe('tiltToAim（横持ち）', () => {
  it('画面を 90° 回すと、前後の傾きが左右の照準になる', () => {
    const rotated = aim(base.beta + TILT_RANGE_DEG / 2, base.gamma, 90)
    expect(rotated.x).toBeCloseTo(0.5)
    expect(Math.abs(rotated.y)).toBeLessThan(1e-6)
  })

  it('270° でも符号が反転するだけで振れ幅は同じ', () => {
    const at90 = aim(base.beta + 13, base.gamma, 90)
    const at270 = aim(base.beta + 13, base.gamma, 270)
    expect(at270.x).toBeCloseTo(-at90.x)
  })
})

describe('tiltToAim（垂直付近のガード）', () => {
  it('端末をほぼ垂直に立てると左右の反応が消える', () => {
    // gamma の定義が崩れる姿勢。ここで反応させると手ぶれで照準が飛ぶ
    const upright = tiltToAim({ beta: 89, gamma: 20, screenAngleDeg: 0 }, { beta: 89, gamma: 0 })
    expect(Math.abs(upright.x)).toBeLessThan(0.05)
  })

  it('通常の持ち方では抑制されない', () => {
    const normal = tiltToAim({ beta: 40, gamma: 13, screenAngleDeg: 0 }, { beta: 40, gamma: 0 })
    expect(normal.x).toBeCloseTo(0.5)
  })
})

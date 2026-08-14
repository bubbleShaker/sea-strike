import { describe, expect, it } from 'vitest'
import { addShake, decayShake, MAX_SHAKE } from './shake'

describe('addShake', () => {
  it('受けた量に応じて増える', () => {
    expect(addShake(0, 10)).toBeGreaterThan(0)
    expect(addShake(0, 30)).toBeGreaterThan(addShake(0, 10))
  })

  it('積み重ねても上限を超えない（画面が飛ばない）', () => {
    let shake = 0
    for (let i = 0; i < 20; i++) shake = addShake(shake, 30)
    expect(shake).toBe(MAX_SHAKE)
  })
})

describe('decayShake', () => {
  it('時間とともに収まる', () => {
    expect(decayShake(1, 0.1)).toBeLessThan(1)
  })

  it('フレームレートが違っても同じところへ収まる', () => {
    // 同じ 0.5 秒ぶんを、細かい刻みと粗い刻みで進める
    const after = (dt: number, steps: number) => {
      let shake = 1
      for (let i = 0; i < steps; i++) shake = decayShake(shake, dt)
      return shake
    }
    expect(after(1 / 120, 60)).toBeCloseTo(after(1 / 30, 15), 3)
  })

  it('十分な時間で完全に止まる（微小な揺れが残り続けない）', () => {
    let shake = MAX_SHAKE
    for (let t = 0; t < 3; t += 1 / 60) shake = decayShake(shake, 1 / 60)
    expect(shake).toBe(0)
  })
})

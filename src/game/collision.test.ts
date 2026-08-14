import { describe, expect, it } from 'vitest'
import { segmentHitsSphere } from './collision'
import { vec } from './vec'

describe('segmentHitsSphere', () => {
  it('球を貫く線分は当たる', () => {
    expect(segmentHitsSphere(vec(0, 0, 0), vec(0, 0, -100), vec(0, 0, -50), 5)).toBe(true)
  })

  it('球を跨いで飛び越しても当たる（すり抜け防止）', () => {
    // 1 フレームで 100m 進む弾と、半径 8m の敵。点で見ると外れてしまう位置関係
    const from = vec(0, 0, -10)
    const to = vec(0, 0, -110)
    expect(segmentHitsSphere(from, to, vec(0, 0, -60), 8)).toBe(true)
  })

  it('横に外れた線分は当たらない', () => {
    expect(segmentHitsSphere(vec(0, 0, 0), vec(0, 0, -100), vec(20, 0, -50), 8)).toBe(false)
  })

  it('球の手前で止まった線分は当たらない', () => {
    expect(segmentHitsSphere(vec(0, 0, 0), vec(0, 0, -30), vec(0, 0, -60), 8)).toBe(false)
  })

  it('球を通り過ぎた後の線分は当たらない', () => {
    expect(segmentHitsSphere(vec(0, 0, -80), vec(0, 0, -180), vec(0, 0, -60), 8)).toBe(false)
  })

  it('かすめる距離なら当たる', () => {
    expect(segmentHitsSphere(vec(0, 0, 0), vec(0, 0, -100), vec(7.9, 0, -50), 8)).toBe(true)
    expect(segmentHitsSphere(vec(0, 0, 0), vec(0, 0, -100), vec(8.1, 0, -50), 8)).toBe(false)
  })

  it('動いていない弾は点として判定する', () => {
    expect(segmentHitsSphere(vec(0, 0, -50), vec(0, 0, -50), vec(0, 0, -50), 5)).toBe(true)
    expect(segmentHitsSphere(vec(0, 0, 0), vec(0, 0, 0), vec(0, 0, -50), 5)).toBe(false)
  })
})

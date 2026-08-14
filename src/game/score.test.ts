import { describe, expect, it } from 'vitest'
import { calculateScore, PAR_TIME, type ScoreInput } from './score'

const base: ScoreInput = {
  kills: 20,
  elapsed: PAR_TIME / 2,
  hp: 100,
  maxHp: 100,
  shots: 100,
  hits: 50,
  won: true,
}

describe('calculateScore', () => {
  it('速く終えるほど時間の点が高い', () => {
    const fast = calculateScore({ ...base, elapsed: PAR_TIME + 10 }).time
    const slow = calculateScore({ ...base, elapsed: PAR_TIME + 60 }).time
    expect(fast).toBeGreaterThan(slow)
  })

  it('目標時間までに終えれば時間の点は満点', () => {
    expect(calculateScore({ ...base, elapsed: 5 }).time).toBe(
      calculateScore({ ...base, elapsed: PAR_TIME }).time,
    )
  })

  it('かかりすぎても時間の点は負にならない', () => {
    expect(calculateScore({ ...base, elapsed: 9999 }).time).toBe(0)
  })

  it('被弾するほど減点される', () => {
    const hurt = calculateScore({ ...base, hp: 40 })
    expect(hurt.damage).toBeLessThan(0)
    expect(hurt.total).toBeLessThan(calculateScore(base).total)
  })

  it('無傷で勝つと加点がつく', () => {
    expect(calculateScore(base).perfect).toBeGreaterThan(0)
    expect(calculateScore({ ...base, hp: 99 }).perfect).toBe(0)
  })

  it('命中率が高いほど点が高い', () => {
    const sharp = calculateScore({ ...base, shots: 100, hits: 90 }).accuracy
    const sloppy = calculateScore({ ...base, shots: 1000, hits: 90 }).accuracy
    expect(sharp).toBeGreaterThan(sloppy)
  })

  it('一発も撃たなければ命中率の点は 0（0 除算で壊れない）', () => {
    expect(calculateScore({ ...base, shots: 0, hits: 0 }).accuracy).toBe(0)
  })

  it('負けても撃墜と命中率は残る', () => {
    const lost = calculateScore({ ...base, kills: 12, won: false, hp: 0 })
    expect(lost.kills).toBeGreaterThan(0)
    expect(lost.accuracy).toBeGreaterThan(0)
    expect(lost.time).toBe(0)
    expect(lost.perfect).toBe(0)
  })

  it('合計は負にならない', () => {
    const disaster = calculateScore({
      kills: 0,
      elapsed: 300,
      hp: 0,
      maxHp: 100,
      shots: 500,
      hits: 0,
      won: false,
    })
    expect(disaster.total).toBe(0)
  })

  it('同じ内容なら同じ点（再現する）', () => {
    expect(calculateScore(base)).toEqual(calculateScore(base))
  })
})

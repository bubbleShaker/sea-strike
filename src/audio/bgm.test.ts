import { describe, expect, it } from 'vitest'
import { shouldPlay } from './bgm'

describe('shouldPlay', () => {
  const base = { started: true, muted: false, hidden: false }

  it('始まっていて、ミュートでなく、タブが見えているときだけ鳴る', () => {
    expect(shouldPlay(base)).toBe(true)
  })

  it('開始画面を抜けるまでは鳴らさない', () => {
    // ブラウザはユーザーが操作するまで音を拒む。始まる前に鳴らそうとしても無駄
    expect(shouldPlay({ ...base, started: false })).toBe(false)
  })

  it('ミュート中は鳴らさない', () => {
    expect(shouldPlay({ ...base, muted: true })).toBe(false)
  })

  it('タブが隠れている間は鳴らさない', () => {
    expect(shouldPlay({ ...base, hidden: true })).toBe(false)
  })

  it('二つ以上そろって欠けていても鳴らさない', () => {
    expect(shouldPlay({ started: false, muted: true, hidden: true })).toBe(false)
  })
})

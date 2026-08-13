import { describe, expect, it } from 'vitest'
import {
  createFlightState,
  stepFlight,
  FORWARD_SPEED,
  MAX_ALTITUDE,
  MIN_ALTITUDE,
  PITCH_LIMIT,
  YAW_LIMIT,
  type AimState,
  type FlightState,
} from './flight'

/** 入力を据え置いたまま一定時間進める */
function fly(state: FlightState, aim: AimState, seconds: number, dt = 1 / 60): FlightState {
  let current = state
  for (let t = 0; t < seconds; t += dt) current = stepFlight(current, aim, dt)
  return current
}

describe('stepFlight', () => {
  it('入力が無くても前へ進み続ける（レール式）', () => {
    const after = stepFlight(createFlightState(), { x: 0, y: 0 }, 1)
    expect(after.position.z).toBeCloseTo(-FORWARD_SPEED)
    expect(after.position.x).toBeCloseTo(0)
  })

  it('機首は可動範囲を超えない', () => {
    const right = fly(createFlightState(), { x: 1, y: 1 }, 5)
    expect(Math.abs(right.yaw)).toBeLessThanOrEqual(YAW_LIMIT + 1e-6)
    expect(right.pitch).toBeLessThanOrEqual(PITCH_LIMIT + 1e-6)
  })

  it('範囲外の入力でも可動範囲を超えない（入力層の暴走を受け止める）', () => {
    const over = fly(createFlightState(), { x: 12, y: -12 }, 5)
    expect(Math.abs(over.yaw)).toBeLessThanOrEqual(YAW_LIMIT + 1e-6)
    expect(Math.abs(over.pitch)).toBeLessThanOrEqual(PITCH_LIMIT + 1e-6)
  })

  it('右を向くと右へ寄り、左を向くと左へ寄る', () => {
    const right = fly(createFlightState(), { x: 1, y: 0 }, 2)
    const left = fly(createFlightState(), { x: -1, y: 0 }, 2)
    expect(right.position.x).toBeGreaterThan(0)
    expect(left.position.x).toBeLessThan(0)
  })

  it('高度は海面下にも成層圏にも行かない', () => {
    expect(fly(createFlightState(), { x: 0, y: -1 }, 30).position.y).toBeGreaterThanOrEqual(
      MIN_ALTITUDE,
    )
    expect(fly(createFlightState(), { x: 0, y: 1 }, 30).position.y).toBeLessThanOrEqual(MAX_ALTITUDE)
  })

  it('フレームレートが違っても同じところへ着く（追従が dt に依らない）', () => {
    const fast = fly(createFlightState(), { x: 1, y: 0 }, 3, 1 / 120)
    const slow = fly(createFlightState(), { x: 1, y: 0 }, 3, 1 / 30)
    expect(fast.yaw).toBeCloseTo(slow.yaw, 3)
  })

  it('旋回する側へ機体が傾く', () => {
    const right = fly(createFlightState(), { x: 1, y: 0 }, 2)
    expect(Math.sign(right.bank)).toBe(Math.sign(right.yaw))
    expect(right.bank).not.toBe(0)
  })
})

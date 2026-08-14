import { CRUISE_ALTITUDE } from './constants'
import { clampAim, type AimState } from './aim'
import type { Vec3 } from './vec'

export interface FlightState {
  position: Vec3
  /** 機首の左右角[rad]。Three.js の Y 回転に合わせ、+ が左 */
  yaw: number
  /** 機首の上下角[rad]。+ が上 */
  pitch: number
  /** 見た目のバンク角[rad]。旋回する側へ機体を傾ける */
  bank: number
}

/** 機首を振れる範囲。これ以上曲げると、レール式の前進と視線が乖離して酔う */
export const YAW_LIMIT = Math.PI / 3
export const PITCH_LIMIT = (40 * Math.PI) / 180

/** 前進速度[m/s]。固定。レール式なのでプレイヤーは加減速できない */
export const FORWARD_SPEED = 150
/** 機首を向けた側へ寄る速さ[m/s]。旋回の代わりに横滑りで「曲がった感じ」を出す */
const LATERAL_SPEED = 80
const CLIMB_SPEED = 55

export const MIN_ALTITUDE = 14
export const MAX_ALTITUDE = 170

/**
 * 航路の中心から左右に離れられる限界[m]。
 * 敵はワールド座標に置くので、際限なく横流れされると
 * 「目の前に現れる」という前提そのものが崩れる
 */
export const LATERAL_LIMIT = 420

/**
 * 機首の向きに対して機体をどれだけ傾けるか。見た目のためだけの係数。
 * 大きくすると水平線が大きく回り、狙いが定めづらくなる
 */
const BANK_RATIO = 0.18

/** 照準の追従の速さ[1/s]。入力に即座に貼りつかせず、機体の重さを感じさせる */
const AIM_RESPONSE = 7

export function createFlightState(): FlightState {
  return {
    position: { x: 0, y: CRUISE_ALTITUDE, z: 0 },
    yaw: 0,
    pitch: 0,
    bank: 0,
  }
}

function clamp(value: number, min: number, max: number): number {
  // 一度でも NaN が入ると座標が二度と戻らないので、ここで断つ
  if (!Number.isFinite(value)) return 0
  return Math.min(Math.max(value, min), max)
}

/**
 * 指数的な追従。dt に依らず同じ速さで近づくよう、1 - e^(-k*dt) を使う。
 * 単純な線形補間（current += (target - current) * k * dt）だと、
 * フレームレートが変わるたびに手応えが変わってしまう
 */
function approach(current: number, target: number, rate: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-rate * dt))
}

/**
 * 1 フレーム進める。純関数（新しい状態を返す）なので、描画を立ち上げずに検証できる。
 *
 * 前進方向は常に -Z に固定する（レール式）。機首を振っても進路は曲がらず、
 * 向けた側へ少し横滑りするだけ。こうすると敵をどこに出せば「目の前に現れる」かが
 * 一定に保てる。
 */
export function stepFlight(state: FlightState, aim: AimState, dt: number): FlightState {
  const targetYaw = -clampAim(aim.x) * YAW_LIMIT
  const targetPitch = clampAim(aim.y) * PITCH_LIMIT

  const yaw = approach(state.yaw, targetYaw, AIM_RESPONSE, dt)
  const pitch = approach(state.pitch, targetPitch, AIM_RESPONSE, dt)

  // 機首方向の水平成分。Three.js は -Z が前なので、yaw が + のとき前方は -X（左）
  const lateral = -Math.sin(yaw) * LATERAL_SPEED * dt

  return {
    position: {
      x: clamp(state.position.x + lateral, -LATERAL_LIMIT, LATERAL_LIMIT),
      y: clamp(state.position.y + Math.sin(pitch) * CLIMB_SPEED * dt, MIN_ALTITUDE, MAX_ALTITUDE),
      z: state.position.z - FORWARD_SPEED * dt,
    },
    yaw,
    pitch,
    bank: yaw * BANK_RATIO,
  }
}

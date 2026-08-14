import { clampAim, type AimState } from '../game/aim'

/**
 * 基準姿勢から何度傾ければ端まで振れるか。
 * 手首だけで無理なく届く角度として選んだ。大きくすると鈍く、小さくすると過敏になる
 */
export const TILT_RANGE_DEG = 26

/** 端末がこの角度より起き上がると、左右の傾きの読みが崩れ始める */
const GIMBAL_START_DEG = 68
const GIMBAL_END_DEG = 86

/** 角度の差を -180..180 に畳む。179° と -179° の差が 358° にならないように */
export function normalizeDegrees(delta: number): number {
  const wrapped = ((delta + 180) % 360 + 360) % 360 - 180
  return wrapped
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1)
  return t * t * (3 - 2 * t)
}

export interface TiltReading {
  /** 端末の前後の傾き[deg]。水平（画面が上向き）で 0、垂直に立てると 90 */
  beta: number
  /** 端末の左右の傾き[deg]。右へ倒すと + */
  gamma: number
  /** 画面の回転角[deg]。0 / 90 / 180 / 270 */
  screenAngleDeg: number
}

/**
 * 端末の傾きを照準に変える。
 *
 * 端末を「覗き窓」として扱う。下へ向ければ下が見え、右へ倒せば右が見える。
 *
 * beta / gamma は端末の軸で測られていて画面の向きを知らないので、
 * 画面の回転角ぶん回して「プレイヤーから見た上下左右」に直す。
 * この変換は three.js の DeviceOrientationControls が z 軸まわりに
 * -orient を掛けているのと同じもの。
 *
 * DOM も時間も参照しない純関数にしてある。姿勢と符号の対応は
 * 実機無しでは確かめようがなく、テストで固定しておきたいため。
 */
export function tiltToAim(reading: TiltReading, base: { beta: number; gamma: number }): AimState {
  const deltaBeta = normalizeDegrees(reading.beta - base.beta)
  const deltaGamma = normalizeDegrees(reading.gamma - base.gamma)

  const angle = (reading.screenAngleDeg * Math.PI) / 180
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)

  const screenX = deltaGamma * cos + deltaBeta * sin
  const screenY = deltaBeta * cos - deltaGamma * sin

  // 端末をほぼ垂直に立てると gamma の定義が崩れ、わずかな手ぶれで 180° 飛ぶ。
  // 起きているほど左右の反応を抑えて、照準が暴れるのを防ぐ
  const upright = smoothstep(GIMBAL_START_DEG, GIMBAL_END_DEG, Math.abs(reading.beta))

  return {
    x: clampAim((screenX / TILT_RANGE_DEG) * (1 - upright)),
    y: clampAim(screenY / TILT_RANGE_DEG),
  }
}

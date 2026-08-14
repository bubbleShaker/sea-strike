import type { AimState } from '../game/flight'
import type { AimSource } from './aim'

/**
 * 基準姿勢から何度傾ければ端まで振れるか。
 * 手首だけで無理なく届く角度として選んだ。大きくすると鈍く、小さくすると過敏になる
 */
const TILT_RANGE_DEG = 26

/** この時間センサーの反応が無ければ、傾きは使えないと判断する */
export const TILT_SIGNAL_TIMEOUT_MS = 1200

export interface TiltSource extends AimSource {
  /** 今の姿勢を基準に取り直す。持ち方を変えたときに使う */
  calibrate(): void
  /** センサーから値が届いているか。届かない端末では呼び出し側がスワイプへ落とす */
  hasSignal(): boolean
}

/** iOS 13+ は本人の許可を求める。許可 API があるかどうかで見分ける */
type PermissionCapableEvent = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>
}

export function isTiltSupported(): boolean {
  return typeof window !== 'undefined' && 'DeviceOrientationEvent' in window
}

export function needsTiltPermission(): boolean {
  if (!isTiltSupported()) return false
  return typeof (DeviceOrientationEvent as PermissionCapableEvent).requestPermission === 'function'
}

/**
 * 傾きセンサーの利用許可を取る。
 *
 * iOS ではこの呼び出しがユーザーの操作（タップ）から直接始まっていないと、
 * 問答無用で拒否される。だから開始ボタンの click ハンドラの中で呼ぶ必要がある。
 */
export async function requestTiltPermission(): Promise<boolean> {
  const requestPermission = (DeviceOrientationEvent as PermissionCapableEvent).requestPermission
  if (typeof requestPermission !== 'function') return isTiltSupported()
  try {
    return (await requestPermission()) === 'granted'
  } catch {
    return false
  }
}

function clamp(value: number): number {
  return Math.min(Math.max(value, -1), 1)
}

/**
 * 端末の傾きを照準に変える。
 *
 * 端末を「覗き窓」として扱う。下へ向ければ下が見え、右へ倒せば右が見える。
 * 絶対角ではなく開始時の姿勢からの差分で測るので、寝転がって遊んでも成立する。
 */
export function createTiltSource(): TiltSource {
  const aim: AimState = { x: 0, y: 0 }
  let base: { beta: number; gamma: number } | null = null
  let lastSignalMs = 0

  const onOrientation = (event: DeviceOrientationEvent) => {
    const { beta, gamma } = event
    if (beta === null || gamma === null) return
    lastSignalMs = performance.now()

    // 最初に届いた姿勢を基準にする。以後はそこからの差分だけを見る
    if (!base) base = { beta, gamma }

    const deltaBeta = beta - base.beta
    const deltaGamma = gamma - base.gamma

    // beta / gamma は端末の軸で測られていて、画面の向きを考慮しない。
    // 横持ちにすると前後と左右が入れ替わるので、画面の回転角ぶん回して
    // 「プレイヤーから見た上下左右」に直す
    const angle = ((screen.orientation?.angle ?? 0) * Math.PI) / 180
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    const screenX = deltaGamma * cos + deltaBeta * sin
    const screenY = deltaBeta * cos - deltaGamma * sin

    aim.x = clamp(screenX / TILT_RANGE_DEG)
    aim.y = clamp(screenY / TILT_RANGE_DEG)
  }

  window.addEventListener('deviceorientation', onOrientation)

  return {
    kind: 'tilt',
    read: () => aim,
    calibrate() {
      base = null
      aim.x = 0
      aim.y = 0
    },
    hasSignal: () => lastSignalMs !== 0 && performance.now() - lastSignalMs < TILT_SIGNAL_TIMEOUT_MS,
    dispose() {
      window.removeEventListener('deviceorientation', onOrientation)
    },
  }
}

import type { AimState } from '../game/aim'
import { clampAim } from '../game/aim'
import type { AimSource } from './aim'
import { tiltToAim } from './tilt-math'

/** この時間センサーの反応が無ければ、傾きは使えないと判断する */
export const TILT_SIGNAL_TIMEOUT_MS = 1200

export interface TiltSource extends AimSource {
  /** 今の姿勢を基準に取り直し、照準を中央へ戻す */
  calibrate(): void
  /** 今の姿勢が指定の照準を指すよう基準をずらす。スワイプから引き継ぐときに使う */
  alignTo(aim: AimState): void
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
  if (!isTiltSupported()) return false
  const requestPermission = (DeviceOrientationEvent as PermissionCapableEvent).requestPermission
  if (typeof requestPermission !== 'function') return true
  try {
    return (await requestPermission()) === 'granted'
  } catch {
    return false
  }
}

/** 画面の回転角。screen.orientation は iOS Safari 16.4 未満に無いので、旧 API へ落ちる */
function currentScreenAngle(): number {
  const modern = screen.orientation?.angle
  if (typeof modern === 'number') return modern
  const legacy = (window as { orientation?: number }).orientation
  return typeof legacy === 'number' ? legacy : 0
}

/**
 * 端末の傾きを照準に変える。
 *
 * 絶対角ではなく基準姿勢からの差分で測るので、寝転がって遊んでも成立する。
 * 角度への変換そのものは tilt-math（純関数）に置き、ここは
 * センサーの購読と基準の管理だけを持つ。
 */
export function createTiltSource(): TiltSource {
  const aim: AimState = { x: 0, y: 0 }
  /** 基準姿勢からの生の照準（オフセットを引く前）。引き継ぎの計算に要る */
  const raw: AimState = { x: 0, y: 0 }
  /** 引き継ぎのためのずらし量。alignTo でここに差が入る */
  const offset: AimState = { x: 0, y: 0 }
  let base: { beta: number; gamma: number } | null = null
  let lastSignalMs = 0

  const onOrientation = (event: DeviceOrientationEvent) => {
    const { beta, gamma } = event
    if (beta === null || gamma === null) return
    if (!Number.isFinite(beta) || !Number.isFinite(gamma)) return
    lastSignalMs = performance.now()

    // 最初に届いた姿勢を基準にする。以後はそこからの差分だけを見る
    if (!base) base = { beta, gamma }

    const next = tiltToAim({ beta, gamma, screenAngleDeg: currentScreenAngle() }, base)
    raw.x = next.x
    raw.y = next.y
    aim.x = clampAim(next.x - offset.x)
    aim.y = clampAim(next.y - offset.y)
  }

  const calibrate = () => {
    base = null
    offset.x = 0
    offset.y = 0
    raw.x = 0
    raw.y = 0
    aim.x = 0
    aim.y = 0
  }

  // 端末を縦横に回すと beta / gamma の意味が物理的に変わる。基準を取り直さないと
  // 照準が振り切れたまま戻らなくなる
  window.addEventListener('orientationchange', calibrate)
  screen.orientation?.addEventListener('change', calibrate)
  window.addEventListener('deviceorientation', onOrientation)

  return {
    kind: 'tilt',
    read: () => aim,
    calibrate,
    alignTo(target) {
      offset.x = raw.x - target.x
      offset.y = raw.y - target.y
      aim.x = clampAim(target.x)
      aim.y = clampAim(target.y)
    },
    hasSignal: () => lastSignalMs !== 0 && performance.now() - lastSignalMs < TILT_SIGNAL_TIMEOUT_MS,
    dispose() {
      window.removeEventListener('deviceorientation', onOrientation)
      window.removeEventListener('orientationchange', calibrate)
      screen.orientation?.removeEventListener('change', calibrate)
    },
  }
}

/**
 * 画面の揺れの量。0 で静止、1 で最大。
 *
 * Three.js に触らない算術だけを切り出してある。揺れは「フレームレートが
 * 変わっても同じ速さで収まる」ことを守りたい部分で、そこはテストで固定したい。
 */

/** 揺れの上限。これを超えると何が起きているか分からなくなる */
export const MAX_SHAKE = 1.1

/** ダメージ 1 あたりの揺れ。接触（30）で 0.42、通常の被弾（10）で 0.14 */
const SHAKE_PER_DAMAGE = 0.014

/** 収まる速さ[1/s]。大きいほど早く落ち着く */
const SHAKE_DECAY = 6

/** これ以下は揺れていないものとして切り捨てる */
const SHAKE_EPSILON = 0.002

export function addShake(current: number, damage: number): number {
  return Math.min(current + damage * SHAKE_PER_DAMAGE, MAX_SHAKE)
}

/**
 * 時間で減衰させる。
 * 指数で減らすのは、dt に依らず同じ速さで収めるため
 * （current -= k * dt だと fps によって揺れの長さが変わる）
 */
export function decayShake(current: number, dt: number): number {
  const next = current * Math.exp(-SHAKE_DECAY * dt)
  return next < SHAKE_EPSILON ? 0 : next
}

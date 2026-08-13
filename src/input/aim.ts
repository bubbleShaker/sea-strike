import type { AimState } from '../game/flight'

/**
 * 照準の入力源。傾きもスワイプも、この形に揃えてからゲームへ渡す。
 *
 * ゲーム側は `read()` を毎フレーム呼ぶだけで、値がセンサー由来か指由来かを知らない。
 * 「傾けられない時にスワイプで同等の操作」という要件は、この境界だけで満たす。
 */
export interface AimSource {
  readonly kind: 'tilt' | 'swipe'
  read(): AimState
  dispose(): void
}

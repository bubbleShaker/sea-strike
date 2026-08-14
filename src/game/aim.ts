/**
 * 照準の入力。画面上の照準の変位に相当する -1..1 の値で、単位も角度も持たない。
 *
 * 角度に直すのは flight（ゲームの規則）の仕事にしている。
 * 入力層は「どれだけ倒したか」だけを言えばよく、可動範囲を知らずに済む。
 * 傾きとスワイプが同じ範囲を同じ速さで狙えるのは、この一点に合流するため。
 */
export interface AimState {
  /** 右が + */
  x: number
  /** 上が + */
  y: number
}

/** -1..1 に収める。NaN は 0 に潰す（センサーの欠測が機体の座標を壊さないように） */
export function clampAim(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(Math.max(value, -1), 1)
}

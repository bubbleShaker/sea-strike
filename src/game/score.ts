

/** スコアの内訳。合計だけ見せると、何が効いたのか分からない */
export interface ScoreBreakdown {
  /** 撃墜そのものの点 */
  kills: number
  /** 速さの点。目標時間より早く終えるほど高い */
  time: number
  /** 命中率の点。撃った弾のうち当たった割合 */
  accuracy: number
  /** 被弾の減点（負の数） */
  damage: number
  /** 無傷で勝ち切った場合の加点 */
  perfect: number
  total: number
}

export interface ScoreInput {
  kills: number
  /** 経過時間[s] */
  elapsed: number
  /** 残り HP */
  hp: number
  maxHp: number
  /** 撃った弾の数 */
  shots: number
  /** 当たった弾の数 */
  hits: number
  won: boolean
}

/**
 * この時間で終えれば時間点が満点。これを過ぎると 0 に近づく。
 * 全弾必中で駆け抜けると 30 秒強で終わるので、そこから少し余裕を見た値。
 * 緩くしすぎると勝った人が全員満点になり、点が勝敗の言い換えにしかならない
 */
export const PAR_TIME = 60
const KILL_POINT = 120
const TIME_POINT_MAX = 1500
const ACCURACY_POINT_MAX = 800
const DAMAGE_POINT = 12
const PERFECT_BONUS = 1000

/**
 * 命中率（0..1）。
 *
 * 貫通する弾は 1 発で複数機に当たるので、素直に割ると 1 を超える。
 * 表示とスコアで別々に計算すると「命中率 400%」と「命中率の点は満点」が
 * 同じ画面に並ぶので、ここに一本化する。
 */
export function accuracyRatio(shots: number, hits: number): number {
  if (shots <= 0) return 0
  return Math.min(hits / shots, 1)
}

/**
 * スコアを出す。
 *
 * 速さと丁寧さの両方を見る。速いだけなら弾をばら撒いて突っ込めばよく、
 * 丁寧なだけなら時間をかけて安全に削ればいい。どちらか一方に寄せると
 * 遊び方が一つに固まるので、時間・命中率・被弾を並べて競わせる。
 *
 * 負けたときも撃墜と命中率は残す。何もかも 0 にすると、
 * あと 1 機で負けた回と何もできなかった回が同じ点になってしまう。
 */
export function calculateScore(input: ScoreInput): ScoreBreakdown {
  const kills = input.kills * KILL_POINT

  // 目標時間に対する超過分で減っていく。PAR_TIME の 2 倍かかると 0
  const timeRatio = Math.max(0, 1 - Math.max(0, input.elapsed - PAR_TIME) / PAR_TIME)
  const time = input.won ? Math.round(TIME_POINT_MAX * timeRatio) : 0

  const accuracy = Math.round(ACCURACY_POINT_MAX * accuracyRatio(input.shots, input.hits))

  const damage = -Math.round(Math.max(0, input.maxHp - input.hp) * DAMAGE_POINT)

  const perfect = input.won && input.hp >= input.maxHp ? PERFECT_BONUS : 0

  return {
    kills,
    time,
    accuracy,
    damage,
    perfect,
    // 合計が負になると「頑張ったのに減った」だけが残るので、下は 0 で止める
    total: Math.max(0, kills + time + accuracy + damage + perfect),
  }
}

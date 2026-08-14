import { dot, lengthSquared, sub, type Vec3 } from './vec'

/**
 * 移動した弾が球に当たったか。
 *
 * 弾は 600m/s 前後で飛ぶので、60fps でも 1 フレームに 10m 進む。
 * 「今いる点」と球で判定すると、敵（半径 8m 程度）を跨いですり抜ける。
 * そこで前フレームの位置と今の位置を結んだ線分で見る。
 *
 * 線分上で球の中心に最も近い点を求め、そこまでの距離が半径以内かを調べる。
 */
export function segmentHitsSphere(
  from: Vec3,
  to: Vec3,
  center: Vec3,
  radius: number,
): boolean {
  const travel = sub(to, from)
  const toCenter = sub(center, from)
  const travelLengthSquared = lengthSquared(travel)

  // 止まっている弾。点と球の判定に落ちる
  if (travelLengthSquared === 0) return lengthSquared(toCenter) <= radius * radius

  // 線分上の最近接点を 0..1 で表したもの。線分の外に出たら端で止める
  const t = Math.min(Math.max(dot(toCenter, travel) / travelLengthSquared, 0), 1)
  const closest = {
    x: from.x + travel.x * t,
    y: from.y + travel.y * t,
    z: from.z + travel.z * t,
  }

  return lengthSquared(sub(center, closest)) <= radius * radius
}

import type { WeaponId } from './game/weapons'

/**
 * 武器の色。弾の描画（Three.js）と持ち替え UI（CSS）で同じ色を使う。
 *
 * ゲームの規則ではなく見た目の取り決めなので game/ には置かない。
 * 一方で、弾の色と UI の色がずれると「今どれを撃っているか」が
 * 手元を見ないと分からなくなるため、両者が同じ定数を読む形にしている。
 */
export const WEAPON_COLOR: Record<WeaponId, string> = {
  vulcan: '#ffd24a',
  cannon: '#ff8a3d',
  spread: '#b6f05a',
  homing: '#ff6ad5',
  laser: '#68f0ff',
}

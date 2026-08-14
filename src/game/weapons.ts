export type WeaponId = 'vulcan' | 'cannon' | 'spread' | 'homing' | 'laser'

export interface Weapon {
  id: WeaponId
  name: string
  /** HUD に出す短い説明 */
  note: string
  /** 1 発の威力 */
  damage: number
  /** 弾速[m/s] */
  speed: number
  /** 次を撃てるまでの間隔[s] */
  cooldown: number
  /** 1 回の発射で出る弾の数 */
  count: number
  /** 散らばり[rad]。count が 1 なら命中のばらつきになる */
  spread: number
  /** 弾が消えるまでの時間[s] */
  life: number
  /** 当たり判定の太さ[m] */
  radius: number
  /** 何機まで貫けるか（1 なら当たった時点で消える） */
  pierce: number
  /** 追尾の強さ[1/s]。0 なら真っ直ぐ飛ぶ */
  homing: number
  /** 撃てる回数。null は無限。撃ち切ると使えなくなる */
  ammo: number | null
}

/**
 * 弾の性格。
 *
 * 5 種は「強さの階段」ではなく「用途の違い」で分けている。
 * どれか一つが常に最適にならないよう、威力・弾速・連射・弾数を
 * 互いに削り合わせてある。
 */
export const WEAPONS: Record<WeaponId, Weapon> = {
  vulcan: {
    id: 'vulcan',
    name: 'VULCAN',
    note: '連射／弾数無限',
    damage: 10,
    speed: 900,
    cooldown: 0.09,
    count: 1,
    spread: 0.007,
    life: 2.2,
    radius: 2.4,
    pierce: 1,
    homing: 0,
    ammo: null,
  },
  cannon: {
    id: 'cannon',
    name: 'CANNON',
    note: '単発高威力／遅い',
    damage: 85,
    speed: 420,
    cooldown: 0.85,
    count: 1,
    spread: 0,
    life: 3.2,
    radius: 4.5,
    pierce: 1,
    homing: 0,
    ammo: 24,
  },
  spread: {
    id: 'spread',
    name: 'SPREAD',
    note: '散弾／近距離',
    damage: 16,
    speed: 620,
    cooldown: 0.55,
    count: 7,
    spread: 0.07,
    life: 1.1,
    radius: 3.0,
    pierce: 1,
    homing: 0,
    ammo: 30,
  },
  homing: {
    id: 'homing',
    name: 'HOMING',
    note: '追尾／弾数少',
    damage: 45,
    speed: 340,
    cooldown: 1.1,
    count: 1,
    spread: 0.02,
    life: 4.5,
    radius: 5.0,
    pierce: 1,
    homing: 3.2,
    ammo: 12,
  },
  laser: {
    id: 'laser',
    name: 'LASER',
    note: '貫通／即着弾',
    damage: 30,
    speed: 3000,
    cooldown: 0.5,
    count: 1,
    spread: 0,
    life: 0.6,
    radius: 2.0,
    pierce: 4,
    homing: 0,
    ammo: 20,
  },
}

export const WEAPON_ORDER: WeaponId[] = ['vulcan', 'cannon', 'spread', 'homing', 'laser']

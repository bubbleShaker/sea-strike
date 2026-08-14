import type { AimState } from './aim'
import { segmentHitsSphere } from './collision'
import { createFlightState, stepFlight, FORWARD_SPEED, type FlightState } from './flight'
import { add, direction, normalize, scale, sub, vec, length, type Vec3 } from './vec'
import { WEAPONS, type WeaponId } from './weapons'

export interface Enemy {
  id: number
  position: Vec3
  velocity: Vec3
  hp: number
  maxHp: number
  radius: number
}

export interface Bullet {
  id: number
  position: Vec3
  velocity: Vec3
  /** 残り寿命[s] */
  life: number
  damage: number
  radius: number
  /** あと何機貫けるか */
  pierce: number
  homing: number
  weapon: WeaponId
  /** すでに当てた敵。貫通中に同じ機体へ二重に当たらないようにする */
  hitIds: number[]
}

/** そのフレームで起きたこと。描画側が演出を出すために読む（状態ではなく通知） */
export type WorldEvent =
  | { type: 'hit'; position: Vec3 }
  | { type: 'kill'; position: Vec3 }
  | { type: 'fire'; weapon: WeaponId }

export interface World {
  flight: FlightState
  enemies: Enemy[]
  bullets: Bullet[]
  kills: number
  /** 経過時間[s] */
  elapsed: number
  /** 武器ごとの残弾。null は無限 */
  ammo: Record<WeaponId, number | null>
  /** 次に撃てるようになるまでの時間[s] */
  cooldown: number
  spawnTimer: number
  nextId: number
  events: WorldEvent[]
}

export interface Command {
  aim: AimState
  firing: boolean
  weapon: WeaponId
}

/**
 * 敵の出現位置。プレイヤーの前方に、この距離だけ離して置く。
 * 相対速度は 240m/s ほどになるので、出現から接触まで約 5 秒。
 * 遠すぎると点が近づいてくるだけの時間が長く、近すぎると避ける間が無い
 */
const SPAWN_DISTANCE = 1200
/**
 * 左右の散らばり。縦持ちの画面は横の視野が 40 度ほどしかないので、
 * 広げすぎると「どこにいるか分からない敵」ばかりになる
 */
const SPAWN_LATERAL = 240
/**
 * 出現高度は自機の高度を中心に振る。絶対的な高さで決めると、
 * 高く飛んでいるときに敵が足元にしか出ず、機首を振っても届かない
 */
const SPAWN_ALTITUDE_SPREAD = 55
const SPAWN_MIN_ALTITUDE = 25
const SPAWN_MAX_ALTITUDE = 160
const SPAWN_INTERVAL = 1.5

/** 同時に出す上限。多すぎると避けられず、少なすぎると間延びする */
const MAX_ENEMIES = 5

const ENEMY_SPEED = 90
const ENEMY_HP = 40
const ENEMY_RADIUS = 9

/** これだけ後ろへ通り過ぎた敵は消す */
const DESPAWN_BEHIND = 260

/**
 * 機首の何 m 先から弾を出すか。
 * 近すぎるとカメラのすぐ手前を通って画面いっぱいに見え、照準が隠れる
 */
const MUZZLE_OFFSET = 45
/** 弾を出す高さのずれ[m]。視線の真上に重ねると、飛んでいく様子が見えない */
const MUZZLE_DROP = -4

export function createWorld(): World {
  return {
    flight: createFlightState(),
    enemies: [],
    bullets: [],
    kills: 0,
    elapsed: 0,
    ammo: {
      vulcan: WEAPONS.vulcan.ammo,
      cannon: WEAPONS.cannon.ammo,
      spread: WEAPONS.spread.ammo,
      homing: WEAPONS.homing.ammo,
      laser: WEAPONS.laser.ammo,
    },
    cooldown: 0,
    spawnTimer: 0.8,
    nextId: 1,
    events: [],
  }
}

function spawnEnemy(origin: Vec3, id: number, random: () => number): Enemy {
  return {
    id,
    position: vec(
      origin.x + (random() * 2 - 1) * SPAWN_LATERAL,
      Math.min(
        Math.max(origin.y + (random() * 2 - 1) * SPAWN_ALTITUDE_SPREAD, SPAWN_MIN_ALTITUDE),
        SPAWN_MAX_ALTITUDE,
      ),
      origin.z - SPAWN_DISTANCE,
    ),
    // プレイヤーへ向かって正面から来る。横に少しだけ流して単調さを消す
    velocity: vec((random() * 2 - 1) * 18, (random() * 2 - 1) * 6, ENEMY_SPEED),
    hp: ENEMY_HP,
    maxHp: ENEMY_HP,
    radius: ENEMY_RADIUS,
  }
}

/** 弾に一番近い敵。ホーミングの目標に使う */
function nearestEnemy(enemies: Enemy[], from: Vec3): Enemy | null {
  let best: Enemy | null = null
  let bestDistance = Infinity
  for (const enemy of enemies) {
    const distance = length(sub(enemy.position, from))
    if (distance < bestDistance) {
      bestDistance = distance
      best = enemy
    }
  }
  return best
}

/**
 * 機首方向を spread の範囲でばらけさせる。
 * 散弾は数を撃つほど広がるので、扇状ではなく円錐状に散らす
 */
function spreadDirection(base: Vec3, spread: number, random: () => number): Vec3 {
  if (spread === 0) return base
  const angle = random() * Math.PI * 2
  const radius = Math.sqrt(random()) * spread
  // base に直交する 2 軸を作って、その平面上でずらす
  const up = Math.abs(base.y) > 0.9 ? vec(1, 0, 0) : vec(0, 1, 0)
  const right = normalize(vec(
    base.y * up.z - base.z * up.y,
    base.z * up.x - base.x * up.z,
    base.x * up.y - base.y * up.x,
  ))
  const upward = vec(
    base.y * right.z - base.z * right.y,
    base.z * right.x - base.x * right.z,
    base.x * right.y - base.y * right.x,
  )
  return normalize(
    add(base, add(scale(right, Math.cos(angle) * radius), scale(upward, Math.sin(angle) * radius))),
  )
}

function fire(
  flight: FlightState,
  firstId: number,
  weaponId: WeaponId,
  random: () => number,
): { bullets: Bullet[]; nextId: number } {
  const weapon = WEAPONS[weaponId]
  const aimDirection = direction(flight.yaw, flight.pitch)
  const muzzle = add(
    flight.position,
    add(scale(aimDirection, MUZZLE_OFFSET), vec(0, MUZZLE_DROP, 0)),
  )
  // 機体の前進ぶんを弾にも乗せる。乗せないと、真横を向いたとき弾が置き去りに見える
  const carried = vec(0, 0, -FORWARD_SPEED)

  const bullets: Bullet[] = []
  let nextId = firstId
  for (let i = 0; i < weapon.count; i++) {
    const heading = spreadDirection(aimDirection, weapon.spread, random)
    bullets.push({
      id: nextId++,
      position: muzzle,
      velocity: add(scale(heading, weapon.speed), carried),
      life: weapon.life,
      damage: weapon.damage,
      radius: weapon.radius,
      pierce: weapon.pierce,
      homing: weapon.homing,
      weapon: weaponId,
      hitIds: [],
    })
  }
  return { bullets, nextId }
}

/**
 * 世界を 1 フレーム進める。
 *
 * 純関数（新しい状態を返す）。乱数を引数で受け取るのは、敵の出現を
 * 再現可能にしてテストできるようにするため。
 */
export function stepWorld(
  world: World,
  command: Command,
  dt: number,
  random: () => number = Math.random,
): World {
  const events: WorldEvent[] = []
  const flight = stepFlight(world.flight, command.aim, dt)

  // 敵を進める。通り過ぎたものは消す。
  // ここで作った複製だけを以降で書き換えるので、渡された world は壊れない
  const enemies: Enemy[] = []
  for (const enemy of world.enemies) {
    const moved: Enemy = { ...enemy, position: add(enemy.position, scale(enemy.velocity, dt)) }
    if (moved.position.z < flight.position.z + DESPAWN_BEHIND) enemies.push(moved)
  }

  // 出現
  let spawnTimer = world.spawnTimer - dt
  let nextId = world.nextId
  if (spawnTimer <= 0) {
    spawnTimer += SPAWN_INTERVAL
    if (enemies.length < MAX_ENEMIES) {
      enemies.push(spawnEnemy(flight.position, nextId++, random))
    }
  }

  // 発射
  let cooldown = Math.max(world.cooldown - dt, 0)
  const ammo = { ...world.ammo }
  const bullets: Bullet[] = [...world.bullets]
  const remaining = ammo[command.weapon]
  if (command.firing && cooldown === 0 && (remaining === null || remaining > 0)) {
    const shot = fire(flight, nextId, command.weapon, random)
    bullets.push(...shot.bullets)
    nextId = shot.nextId
    cooldown = WEAPONS[command.weapon].cooldown
    if (remaining !== null) ammo[command.weapon] = remaining - 1
    events.push({ type: 'fire', weapon: command.weapon })
  }

  // 弾を進めながら当たりを見る
  const survivors: Bullet[] = []
  for (const bullet of bullets) {
    const life = bullet.life - dt
    if (life <= 0) continue

    let velocity = bullet.velocity
    if (bullet.homing > 0) {
      const target = nearestEnemy(enemies, bullet.position)
      if (target) {
        const speed = length(velocity)
        const desired = scale(normalize(sub(target.position, bullet.position)), speed)
        // 指数的に向きを寄せる。急に折れ曲がらせないことで「追ってくる」ように見せる
        const blend = 1 - Math.exp(-bullet.homing * dt)
        velocity = scale(normalize(add(scale(velocity, 1 - blend), scale(desired, blend))), speed)
      }
    }

    const from = bullet.position
    const to = add(from, scale(velocity, dt))

    let pierce = bullet.pierce
    // 複製してから足す。前フレームの弾を書き換えないため
    const hitIds = [...bullet.hitIds]
    for (const enemy of enemies) {
      if (pierce <= 0) break
      if (enemy.hp <= 0 || hitIds.includes(enemy.id)) continue
      if (!segmentHitsSphere(from, to, enemy.position, enemy.radius + bullet.radius)) continue

      enemy.hp -= bullet.damage
      hitIds.push(enemy.id)
      pierce -= 1
      events.push({ type: enemy.hp <= 0 ? 'kill' : 'hit', position: enemy.position })
    }

    if (pierce <= 0) continue
    survivors.push({ ...bullet, position: to, velocity, life, pierce, hitIds })
  }

  // 撃墜されたものを取り除く
  let kills = world.kills
  const alive = enemies.filter((enemy) => {
    if (enemy.hp > 0) return true
    kills += 1
    return false
  })

  return {
    flight,
    enemies: alive,
    bullets: survivors,
    kills,
    elapsed: world.elapsed + dt,
    ammo,
    cooldown,
    spawnTimer,
    nextId,
    events,
  }
}

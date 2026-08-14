import type { AimState } from './aim'
import { segmentHitsSphere } from './collision'
import { TARGET_KILLS } from './constants'
import { createFlightState, stepFlight, FORWARD_SPEED, type FlightState } from './flight'
import {
  add,
  direction,
  dot,
  length,
  lengthSquared,
  normalize,
  scale,
  sub,
  vec,
  type Vec3,
} from './vec'
import { WEAPONS, type WeaponId } from './weapons'

export interface Enemy {
  id: number
  position: Vec3
  velocity: Vec3
  hp: number
  maxHp: number
  radius: number
  /** 次に撃つまでの時間[s] */
  fireTimer: number
}

/** 敵が撃ってくる弾。こちらの弾と違って追尾も貫通もしない */
export interface EnemyBullet {
  id: number
  position: Vec3
  velocity: Vec3
  life: number
  damage: number
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
  | { type: 'damage'; amount: number }

/** 決着。playing 以外になったら世界は動かない */
export type Phase = 'playing' | 'won' | 'lost'

export interface World {
  phase: Phase
  flight: FlightState
  enemies: Enemy[]
  bullets: Bullet[]
  enemyBullets: EnemyBullet[]
  kills: number
  hp: number
  maxHp: number
  /** 撃った弾の数。命中率に使う */
  shots: number
  /** 当てた弾の数 */
  hits: number
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

/**
 * 同時に出す上限。多すぎると避けられず、少なすぎると間延びする。
 * 描画側のプールもこの値から決めるので、export している
 */
export const MAX_ENEMIES = 5

const ENEMY_SPEED = 90
const ENEMY_HP = 40
const ENEMY_RADIUS = 9

/** 敵が撃ってくる距離[m]。これより遠いと当たらないので撃たない */
const ENEMY_FIRE_RANGE = 750
/** 敵の射撃間隔[s]。同時に 5 機いるので、実際はこの 1/5 の頻度で飛んでくる */
const ENEMY_FIRE_INTERVAL = 3.6
const ENEMY_BULLET_SPEED = 380
const ENEMY_BULLET_DAMAGE = 10
const ENEMY_BULLET_RADIUS = 2.5
const ENEMY_BULLET_LIFE = 4

/** 自機の当たり判定[m]。見えない機体なので、避けた感覚に合うところまで小さく */
const PLAYER_RADIUS = 11
/** 敵機と接触したときのダメージ。撃たれるより痛い */
const COLLISION_DAMAGE = 30
const MAX_HP = 100

/** これだけ後ろへ通り過ぎた敵は消す */
const DESPAWN_BEHIND = 260

/**
 * 機首の何 m 先から弾を出すか。
 *
 * 大きく取ると、その手前にいる敵に当たらない死角ができる。
 * 「散弾は近距離」と謳っている以上、目の前が抜けるのは困る。
 * 目の前を通る弾が画面を覆う問題は、描画側で見かけの大きさを
 * 距離に応じて縮めることで解いてある
 */
const MUZZLE_OFFSET = 6
/** 弾を出す高さのずれ[m]。視線の真上に重ねると、飛んでいく様子が見えない */
const MUZZLE_DROP = -4

export function createWorld(): World {
  return {
    phase: 'playing',
    flight: createFlightState(),
    enemies: [],
    bullets: [],
    enemyBullets: [],
    kills: 0,
    hp: MAX_HP,
    maxHp: MAX_HP,
    shots: 0,
    hits: 0,
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
    // 出現直後に撃たれると避ける間が無い。1 回ぶんの間隔を置いてから始める
    fireTimer: ENEMY_FIRE_INTERVAL * (0.6 + random() * 0.8),
  }
}

/**
 * 弾に一番近い敵。ホーミングの目標に使う。
 *
 * 進行方向の前にいる相手だけを見る。無条件に最も近い敵を狙うと、
 * すれ違った直後に U ターンして戻っていく弾ができる。
 * 距離の比較だけなので、平方根は取らない
 */
function nearestEnemy(enemies: Enemy[], from: Vec3, heading: Vec3): Enemy | null {
  let best: Enemy | null = null
  let bestDistance = Infinity
  for (const enemy of enemies) {
    const toEnemy = sub(enemy.position, from)
    if (dot(toEnemy, heading) <= 0) continue
    const distance = lengthSquared(toEnemy)
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
  // 決着がついた世界は動かさない。リザルトの裏で時間が進んだり、
  // 撃墜数が増えたりしないようにする
  if (world.phase !== 'playing') return world.events.length === 0 ? world : { ...world, events: [] }

  const events: WorldEvent[] = []
  const flight = stepFlight(world.flight, command.aim, dt)

  // 敵を進める。通り過ぎたものは消す。
  // ここで作った複製だけを以降で書き換えるので、渡された world は壊れない
  const enemies: Enemy[] = []
  for (const enemy of world.enemies) {
    const moved: Enemy = {
      ...enemy,
      position: add(enemy.position, scale(enemy.velocity, dt)),
      fireTimer: enemy.fireTimer - dt,
    }
    if (moved.position.z < flight.position.z + DESPAWN_BEHIND) enemies.push(moved)
  }

  // 出現。dt は呼び出し側（main.ts の MAX_STEP）で 1/20 秒に抑えられている前提で、
  // 1 フレームに 1 機までしか出さない
  let spawnTimer = world.spawnTimer - dt
  let nextId = world.nextId
  if (spawnTimer <= 0) {
    spawnTimer = SPAWN_INTERVAL
    if (enemies.length < MAX_ENEMIES) {
      enemies.push(spawnEnemy(flight.position, nextId++, random))
    }
  }

  // 敵の射撃。撃ってくるのは、こちらより前にいて射程に入った機体だけ
  const enemyBullets: EnemyBullet[] = []
  for (const enemy of enemies) {
    if (enemy.fireTimer > 0) continue
    enemy.fireTimer = ENEMY_FIRE_INTERVAL
    const toPlayer = sub(flight.position, enemy.position)
    const distance = length(toPlayer)
    if (distance > ENEMY_FIRE_RANGE || enemy.position.z > flight.position.z) continue

    // こちらは 150m/s で前進し続けるので、今いる場所へ撃つと必ず後ろへ抜ける。
    // 前進ぶんだけは読んで撃つ。読まないのは横と上下の動きで、
    // 「真っ直ぐ飛べば当たる、機首を振って動けば外れる」という駆け引きにする
    const travelTime = distance / (ENEMY_BULLET_SPEED + FORWARD_SPEED)
    const predicted = add(flight.position, vec(0, 0, -FORWARD_SPEED * travelTime))

    enemyBullets.push({
      id: nextId++,
      position: { ...enemy.position },
      velocity: scale(normalize(sub(predicted, enemy.position)), ENEMY_BULLET_SPEED),
      life: ENEMY_BULLET_LIFE,
      damage: ENEMY_BULLET_DAMAGE,
      radius: ENEMY_BULLET_RADIUS,
    })
  }

  // 発射
  const ammo = { ...world.ammo }
  const bullets: Bullet[] = [...world.bullets]
  const remaining = ammo[command.weapon]
  let shots = world.shots
  // 0 でクランプせずに引く。ここで切り捨てると、実効の連射間隔が
  // フレーム時間の倍数に丸められ、フレームレートの低い端末ほど火力が落ちる
  let cooldown = world.cooldown - dt
  if (command.firing && cooldown <= 0 && (remaining === null || remaining > 0)) {
    const shot = fire(flight, nextId, command.weapon, random)
    bullets.push(...shot.bullets)
    nextId = shot.nextId
    // 行き過ぎたぶんを次の間隔から差し引いて、平均の連射速度を保つ
    cooldown = Math.max(cooldown + WEAPONS[command.weapon].cooldown, 0)
    if (remaining !== null) ammo[command.weapon] = remaining - 1
    // 命中率の分母は「出した弾の数」。散弾は 1 回で 7 発ぶん背負う
    shots += shot.bullets.length
    events.push({ type: 'fire', weapon: command.weapon })
  } else {
    // 撃たなかったぶんの借金は繰り越さない（撃たずに待って連射する裏技を作らない）
    cooldown = Math.max(cooldown, 0)
  }

  // 弾を進めながら当たりを見る
  let hits = world.hits
  const survivors: Bullet[] = []
  for (const bullet of bullets) {
    const life = bullet.life - dt
    if (life <= 0) continue

    let velocity = bullet.velocity
    if (bullet.homing > 0) {
      const target = nearestEnemy(enemies, bullet.position, velocity)
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
      hits += 1
      // 通知は値として渡す。敵の position をそのまま持たせると、
      // 受け取った側が「あとで読む」だけで意味が変わる
      events.push({ type: enemy.hp <= 0 ? 'kill' : 'hit', position: { ...enemy.position } })
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

  // こちらが受ける被害。敵弾と、機体そのものとの接触
  let hp = world.hp
  const takeDamage = (amount: number) => {
    hp = Math.max(0, hp - amount)
    events.push({ type: 'damage', amount })
  }

  const flyingEnemyBullets: EnemyBullet[] = []
  for (const bullet of [...world.enemyBullets, ...enemyBullets]) {
    const life = bullet.life - dt
    if (life <= 0) continue
    const to = add(bullet.position, scale(bullet.velocity, dt))
    if (segmentHitsSphere(bullet.position, to, flight.position, PLAYER_RADIUS + bullet.radius)) {
      takeDamage(bullet.damage)
      continue
    }
    flyingEnemyBullets.push({ ...bullet, position: to, life })
  }

  // 生き残っている敵とぶつかったら、その機体は落ちずにこちらが痛む
  const clear: Enemy[] = []
  for (const enemy of alive) {
    if (length(sub(enemy.position, flight.position)) <= enemy.radius + PLAYER_RADIUS) {
      takeDamage(COLLISION_DAMAGE)
      events.push({ type: 'kill', position: { ...enemy.position } })
      continue
    }
    clear.push(enemy)
  }

  const phase: Phase = hp <= 0 ? 'lost' : kills >= TARGET_KILLS ? 'won' : 'playing'

  return {
    phase,
    flight,
    enemies: clear,
    bullets: survivors,
    enemyBullets: flyingEnemyBullets,
    kills,
    hp,
    maxHp: world.maxHp,
    shots,
    hits,
    elapsed: world.elapsed + dt,
    ammo,
    cooldown,
    spawnTimer,
    nextId,
    events,
  }
}

import { describe, expect, it } from 'vitest'
import { createWorld, stepWorld, type Command, type World } from './world'
import { WEAPONS, type WeaponId } from './weapons'
import { vec } from './vec'

const still: Command = { aim: { x: 0, y: 0 }, firing: false, weapon: 'vulcan' }

/** 乱数を固定して、敵の出現を再現できるようにする */
const fixedRandom = () => 0.5

function run(world: World, command: Command, seconds: number, dt = 1 / 60): World {
  let current = world
  for (let t = 0; t < seconds; t += dt) current = stepWorld(current, command, dt, fixedRandom)
  return current
}

/**
 * 目の前に据え置きの敵を 1 機だけ置く。
 * spawnTimer を遠くへ飛ばして自然な出現を止め、その 1 機だけを見られるようにする
 */
function withEnemy(world: World, distance = 300): World {
  return {
    ...world,
    spawnTimer: 9999,
    enemies: [
      {
        id: 999,
        position: vec(world.flight.position.x, world.flight.position.y, world.flight.position.z - distance),
        velocity: vec(0, 0, 0),
        hp: 40,
        maxHp: 40,
        radius: 9,
        // 撃ち返してこない的として置く
        fireTimer: 9999,
      },
    ],
  }
}

describe('敵の出現', () => {
  it('しばらく飛ぶと前方に敵が現れる', () => {
    const after = run(createWorld(), still, 3)
    expect(after.enemies.length).toBeGreaterThan(0)
    // 必ず前方（-Z 側）に出る
    for (const enemy of after.enemies) {
      expect(enemy.position.z).toBeLessThan(after.flight.position.z)
    }
  })

  it('同時に出る数には上限がある', () => {
    const after = run(createWorld(), still, 40)
    expect(after.enemies.length).toBeLessThanOrEqual(5)
  })

  it('通り過ぎた敵は消える', () => {
    const world = { ...createWorld(), enemies: [] }
    const after = run(world, still, 30)
    for (const enemy of after.enemies) {
      expect(enemy.position.z).toBeLessThan(after.flight.position.z + 260)
    }
  })
})

describe('発射', () => {
  it('撃つと弾が出る', () => {
    const after = stepWorld(createWorld(), { ...still, firing: true }, 1 / 60, fixedRandom)
    expect(after.bullets.length).toBe(1)
    expect(after.events).toContainEqual({ type: 'fire', weapon: 'vulcan' })
  })

  it('連射間隔より短い間に二度は撃てない', () => {
    const firing = { ...still, firing: true }
    let world = stepWorld(createWorld(), firing, 1 / 60, fixedRandom)
    world = stepWorld(world, firing, 1 / 60, fixedRandom)
    expect(world.bullets.length).toBe(1)
  })

  it('弾は寿命で消える', () => {
    const after = run(createWorld(), { ...still, firing: false }, 0)
    const fired = stepWorld(after, { ...still, firing: true }, 1 / 60, fixedRandom)
    const later = run(fired, still, WEAPONS.vulcan.life + 0.5)
    expect(later.bullets.length).toBe(0)
  })

  it('弾数のある武器は撃つと減り、撃ち切ると出なくなる', () => {
    const weapon: WeaponId = 'cannon'
    let world: World = { ...createWorld(), ammo: { ...createWorld().ammo, cannon: 1 } }
    world = stepWorld(world, { ...still, firing: true, weapon }, 1 / 60, fixedRandom)
    expect(world.ammo.cannon).toBe(0)

    const before = world.bullets.length
    world = run(world, { ...still, firing: true, weapon }, 2)
    // 撃った 1 発は寿命で消えているので、増えていないことを見る
    expect(world.bullets.length).toBeLessThanOrEqual(before)
  })

  it('散弾は 1 回の発射で複数の弾が出る', () => {
    const after = stepWorld(
      createWorld(),
      { ...still, firing: true, weapon: 'spread' },
      1 / 60,
      fixedRandom,
    )
    expect(after.bullets.length).toBe(WEAPONS.spread.count)
  })
})

describe('命中と撃墜', () => {
  it('当て続ければ落とせる', () => {
    const world = withEnemy(createWorld())
    const after = run(world, { ...still, firing: true }, 3)
    expect(after.kills).toBe(1)
    expect(after.enemies).toHaveLength(0)
  })

  it('撃墜は kill として通知される', () => {
    let world = withEnemy(createWorld(), 120)
    let killed = false
    for (let t = 0; t < 3; t += 1 / 60) {
      world = stepWorld(world, { ...still, firing: true }, 1 / 60, fixedRandom)
      if (world.events.some((event) => event.type === 'kill')) killed = true
    }
    expect(killed).toBe(true)
  })

  it('一撃で落ちない敵には hit が通知される', () => {
    let world = withEnemy(createWorld(), 120)
    let hits = 0
    for (let t = 0; t < 0.6; t += 1 / 60) {
      world = stepWorld(world, { ...still, firing: true }, 1 / 60, fixedRandom)
      hits += world.events.filter((event) => event.type === 'hit').length
    }
    expect(hits).toBeGreaterThan(0)
  })

  it('横を向いていれば当たらない', () => {
    const world = withEnemy(createWorld())
    const after = run(world, { aim: { x: 1, y: 0 }, firing: true, weapon: 'vulcan' }, 2)
    expect(after.kills).toBe(0)
  })

  it('貫通する弾は 1 発で複数機に当たる', () => {
    const base = createWorld()
    const line: World = {
      ...base,
      spawnTimer: 9999,
      enemies: [200, 260].map((distance, index) => ({
        id: index + 1,
        position: vec(0, base.flight.position.y, base.flight.position.z - distance),
        velocity: vec(0, 0, 0),
        hp: 30,
        maxHp: 30,
        radius: 9,
        fireTimer: 9999,
      })),
    }
    const after = run(line, { ...still, firing: true, weapon: 'laser' }, 0.4)
    expect(after.kills).toBe(2)
  })

  it('追尾する弾は狙いが外れていても当たる', () => {
    const world = withEnemy(createWorld(), 400)
    const after = run(world, { aim: { x: 0.35, y: 0 }, firing: true, weapon: 'homing' }, 4)
    expect(after.kills).toBe(1)
  })

  it('追尾する弾は、狙う相手が居なくても飛び続ける', () => {
    const world: World = { ...createWorld(), spawnTimer: 9999 }
    const after = run(world, { ...still, firing: true, weapon: 'homing' }, 0.5)
    expect(after.bullets.length).toBeGreaterThan(0)
    for (const bullet of after.bullets) {
      expect(Number.isFinite(bullet.position.z)).toBe(true)
    }
  })

  it('貫通する弾でも同じ機体に二度は当たらない', () => {
    const base = createWorld()
    const tough: World = {
      ...base,
      spawnTimer: 9999,
      enemies: [
        {
          id: 1,
          position: vec(0, base.flight.position.y, base.flight.position.z - 250),
          velocity: vec(0, 0, 0),
          // 貫通回数ぶん当たれば落ちる硬さ。二度当たれば落ちてしまう
          hp: WEAPONS.laser.damage * 2,
          maxHp: WEAPONS.laser.damage * 2,
          radius: 9,
          fireTimer: 9999,
        },
      ],
    }
    // レーザーは 4 機まで貫くが、1 機に 4 回当たってはいけない
    const after = stepWorld(tough, { ...still, firing: true, weapon: 'laser' }, 1 / 20, fixedRandom)
    expect(after.kills).toBe(0)
    expect(after.hits).toBeLessThanOrEqual(1)
  })

  it('弾切れの武器では撃てず、発射も通知されない', () => {
    const base = createWorld()
    const empty: World = { ...base, ammo: { ...base.ammo, cannon: 0 } }
    const after = stepWorld(empty, { ...still, firing: true, weapon: 'cannon' }, 1 / 60, fixedRandom)
    expect(after.bullets).toHaveLength(0)
    expect(after.events).not.toContainEqual({ type: 'fire', weapon: 'cannon' })
    expect(after.cooldown).toBe(0)
  })

  it('通知は毎フレーム作り直される（前フレームのぶんが残らない）', () => {
    const fired = stepWorld(createWorld(), { ...still, firing: true }, 1 / 60, fixedRandom)
    expect(fired.events.length).toBeGreaterThan(0)
    const quiet = stepWorld(fired, still, 1 / 60, fixedRandom)
    expect(quiet.events).toHaveLength(0)
  })
})

describe('被弾と決着', () => {
  /** 目の前に、こちらを撃つ気満々の敵を置く */
  function withShooter(distance = 300): World {
    const base = createWorld()
    return {
      ...base,
      spawnTimer: 9999,
      enemies: [
        {
          id: 1,
          position: vec(base.flight.position.x, base.flight.position.y, base.flight.position.z - distance),
          velocity: vec(0, 0, 0),
          hp: 1000,
          maxHp: 1000,
          radius: 9,
          fireTimer: 0,
        },
      ],
    }
  }

  it('射程内の敵に撃たれると HP が減り、被弾が通知される', () => {
    let world = withShooter()
    let damaged = false
    for (let t = 0; t < 4; t += 1 / 60) {
      world = stepWorld(world, still, 1 / 60, fixedRandom)
      if (world.events.some((event) => event.type === 'damage')) damaged = true
    }
    expect(world.hp).toBeLessThan(world.maxHp)
    expect(damaged).toBe(true)
  })

  it('射程外の敵は撃ってこない', () => {
    const after = run(withShooter(2000), still, 3)
    expect(after.hp).toBe(after.maxHp)
  })

  it('敵とぶつかると大きく傷つき、その機体は消える', () => {
    const world = withShooter(18)
    const after = stepWorld(world, still, 1 / 60, fixedRandom)
    expect(after.hp).toBeLessThanOrEqual(after.maxHp - 30)
    expect(after.enemies).toHaveLength(0)
    // ぶつかった機体は撃墜数に入れない（体当たりで稼げてしまう）
    expect(after.kills).toBe(0)
  })

  it('HP が尽きると負けになり、世界が止まる', () => {
    const world: World = { ...withShooter(18), hp: 10 }
    const dead = stepWorld(world, still, 1 / 60, fixedRandom)
    expect(dead.phase).toBe('lost')

    const later = run(dead, { ...still, firing: true }, 2)
    expect(later.elapsed).toBe(dead.elapsed)
    expect(later.bullets).toEqual(dead.bullets)
  })

  it('規定数を落とすと勝ちになる', () => {
    const world: World = { ...createWorld(), spawnTimer: 9999, kills: 19, enemies: [
      {
        id: 1,
        position: vec(0, 48, -200),
        velocity: vec(0, 0, 0),
        hp: 10,
        maxHp: 40,
        radius: 9,
        fireTimer: 9999,
      },
    ] }
    const after = run(world, { ...still, firing: true }, 2)
    expect(after.kills).toBe(20)
    expect(after.phase).toBe('won')
  })

  it('撃った数と当てた数を数えている（命中率のため）', () => {
    const after = run(withEnemy(createWorld(), 200), { ...still, firing: true }, 1)
    expect(after.shots).toBeGreaterThan(0)
    expect(after.hits).toBeGreaterThan(0)
    expect(after.hits).toBeLessThanOrEqual(after.shots)
  })
})

describe('フレームレートに左右されないこと', () => {
  it('弾は dt が粗くても敵をすり抜けない', () => {
    // 1/20 は main.ts が許す最大の dt。この粗さでも命中数が変わらないことを見る
    const kills = [1 / 60, 1 / 30, 1 / 20].map(
      (dt) => run(withEnemy(createWorld(), 400), { ...still, firing: true }, 3, dt).kills,
    )
    expect(kills).toEqual([1, 1, 1])
  })

  it('連射の速さが dt に依らない', () => {
    const shots = [1 / 60, 1 / 30, 1 / 24].map(
      (dt) => run(createWorld(), { ...still, firing: true }, 3, dt).shots,
    )
    // 理論値は 3 / 0.09 = 33 発。フレームの粗さで 1 発ずれる程度に収まること
    for (const count of shots) expect(Math.abs(count - 33)).toBeLessThanOrEqual(1)
  })

  it('撃たずに待っても連射の貯金はできない', () => {
    const waited = run(createWorld(), still, 5)
    const after = stepWorld(waited, { ...still, firing: true }, 1 / 60, fixedRandom)
    expect(after.shots).toBe(1)
  })
})

describe('世界の更新', () => {
  it('渡した world を書き換えない', () => {
    const world = withEnemy(createWorld(), 120)
    const snapshot = JSON.stringify(world)
    run(world, { ...still, firing: true }, 1)
    expect(JSON.stringify(world)).toBe(snapshot)
  })
})

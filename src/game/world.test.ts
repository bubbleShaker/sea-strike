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
})

describe('世界の更新', () => {
  it('渡した world を書き換えない', () => {
    const world = withEnemy(createWorld(), 120)
    const snapshot = JSON.stringify(world)
    run(world, { ...still, firing: true }, 1)
    expect(JSON.stringify(world)).toBe(snapshot)
  })
})

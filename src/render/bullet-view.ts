import * as THREE from 'three'
import type { Bullet } from '../game/world'
import type { WeaponId } from '../game/weapons'
import { WEAPON_COLOR } from '../theme'

/** 同時に飛ぶ弾の上限。連射と散弾が重なった時の最大を見込んだ数 */
const MAX_BULLETS = 220

/** 弾の色。UI の持ち替えボタンと同じ定数から作り、色がずれないようにする */
const BULLET_COLOR: Record<WeaponId, THREE.Color> = {
  vulcan: new THREE.Color(WEAPON_COLOR.vulcan),
  cannon: new THREE.Color(WEAPON_COLOR.cannon),
  spread: new THREE.Color(WEAPON_COLOR.spread),
  homing: new THREE.Color(WEAPON_COLOR.homing),
  laser: new THREE.Color(WEAPON_COLOR.laser),
}

/**
 * 弾の見た目の長さ[m]。当たり判定の大きさとは別に決める。
 * 弾はほぼ正面へ飛んでいくので、実寸で描くと画面中央の点にしかならない。
 * 速い弾ほど長く引いて、飛んでいったことが見えるようにする
 */
const TRACER_LENGTH: Record<WeaponId, number> = {
  vulcan: 26,
  cannon: 16,
  spread: 12,
  homing: 18,
  laser: 140,
}

/** 見かけの太さ[m]。距離に比例させたうえで、この幅で挟む */
const TRACER_MIN_THICKNESS = 0.35
const TRACER_MAX_THICKNESS = 2.6

export interface BulletView {
  /** カメラ位置を要るのは、弾の見かけの大きさを距離で決めるため */
  sync(bullets: Bullet[], cameraPosition: THREE.Vector3): void
  dispose(): void
}

/**
 * 弾の描画。
 *
 * 連射すると常時 100 発以上が飛ぶので、1 発ずつ Mesh にすると
 * ドローコールがそのまま増えてスマホで落ちる。InstancedMesh を使い、
 * 同じ形を 1 回の描画命令でまとめて出す。
 * 位置・向き・長さは行列で、色は武器ごとにインスタンス色で与える。
 */
export function createBulletView(scene: THREE.Scene): BulletView {
  // Y 軸に立って生まれる円柱を、-Z（lookAt が向ける軸）に沿うよう寝かせる
  const geometry = new THREE.CylinderGeometry(1, 1, 1, 6)
  geometry.rotateX(-Math.PI / 2)

  const material = new THREE.MeshBasicMaterial({ toneMapped: false })
  const mesh = new THREE.InstancedMesh(geometry, material, MAX_BULLETS)
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  // 個々の弾は視界の外に出てもまとめて 1 つの物体として扱われる。
  // 全体をカリング対象にすると、画面内に弾があるのに消えることがある
  mesh.frustumCulled = false
  mesh.count = 0

  // setColorAt を一度呼ばないと instanceColor が用意されない
  const white = new THREE.Color('#ffffff')
  for (let i = 0; i < MAX_BULLETS; i++) mesh.setColorAt(i, white)

  scene.add(mesh)

  // 行列を組み立てるための使い捨ての入れ物。毎フレーム new しないため使い回す
  const dummy = new THREE.Object3D()

  return {
    sync(bullets, cameraPosition) {
      const count = Math.min(bullets.length, MAX_BULLETS)
      for (let i = 0; i < count; i++) {
        const bullet = bullets[i]!
        dummy.position.set(bullet.position.x, bullet.position.y, bullet.position.z)
        dummy.lookAt(
          bullet.position.x + bullet.velocity.x,
          bullet.position.y + bullet.velocity.y,
          bullet.position.z + bullet.velocity.z,
        )

        // 弾はほぼ真正面へ飛ぶので、実寸のまま描くと目の前を通る間だけ
        // 画面いっぱいの帯になり、遠ざかると消える。
        // 見かけの大きさが一定になるよう、距離で伸び縮みさせる
        const distance = cameraPosition.distanceTo(dummy.position)
        const length = Math.min(distance * 0.14, TRACER_LENGTH[bullet.weapon])
        const thickness = Math.min(
          Math.max(distance * 0.0045, TRACER_MIN_THICKNESS),
          TRACER_MAX_THICKNESS,
        )
        dummy.scale.set(thickness, thickness, length)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
        mesh.setColorAt(i, BULLET_COLOR[bullet.weapon])
      }
      mesh.count = count
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    },
    dispose() {
      scene.remove(mesh)
      mesh.dispose()
      geometry.dispose()
      material.dispose()
    },
  }
}

import * as THREE from 'three'
import type { EnemyBullet } from '../game/world'

const MAX_BULLETS = 80

/**
 * 敵弾の描画。
 *
 * 自分の弾（細長い曳光弾）とは別の形にしてある。同じ見た目だと、
 * 向かってくる弾と自分が撃った弾の区別がつかず、避ける判断ができない。
 * こちらは球で、赤く光らせる。
 */
export interface EnemyBulletView {
  /** カメラ位置が要るのは、遠くの弾が点にならないよう見かけの大きさを保つため */
  sync(bullets: EnemyBullet[], cameraPosition: THREE.Vector3): void
  dispose(): void
}

export function createEnemyBulletView(scene: THREE.Scene): EnemyBulletView {
  const geometry = new THREE.SphereGeometry(1, 8, 6)
  const material = new THREE.MeshBasicMaterial({ color: '#ff5a3c', toneMapped: false })
  const mesh = new THREE.InstancedMesh(geometry, material, MAX_BULLETS)
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  mesh.frustumCulled = false
  mesh.count = 0
  scene.add(mesh)

  const dummy = new THREE.Object3D()

  return {
    sync(bullets, cameraPosition) {
      const count = Math.min(bullets.length, MAX_BULLETS)
      for (let i = 0; i < count; i++) {
        const bullet = bullets[i]!
        dummy.position.set(bullet.position.x, bullet.position.y, bullet.position.z)
        // 遠くの弾が点になると避けようがない。見かけの大きさを保つ
        const distance = cameraPosition.distanceTo(dummy.position)
        const size = Math.max(bullet.radius, distance * 0.012)
        dummy.scale.setScalar(size)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
      }
      mesh.count = count
      mesh.instanceMatrix.needsUpdate = true
    },
    dispose() {
      scene.remove(mesh)
      mesh.dispose()
      geometry.dispose()
      material.dispose()
    },
  }
}

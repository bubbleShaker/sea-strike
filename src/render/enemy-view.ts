import * as THREE from 'three'
import type { Enemy } from '../game/world'
import { MAX_ENEMIES } from '../game/constants'
import { createEnemyModelFactory } from './models'

/**
 * 同時に見せられる機数。world 側の上限から決める。
 * 直接書くと、world の上限を上げたときに「当たるのに見えない敵」が生まれる
 */
const POOL_SIZE = MAX_ENEMIES

export interface EnemyView {
  /** 世界の敵をそのまま映す。生成も削除もせず、見せる数だけを変える */
  sync(enemies: Enemy[]): void
  dispose(): void
}

/**
 * 敵機の描画。
 *
 * 毎フレーム作って捨てると GC が跳ねるので、あらかじめ作った機体を
 * 使い回して、余った分は隠すだけにする（プール）。
 * 見た目の状態はここに持たず、渡された配列の通りに置き直す。
 */
export function createEnemyView(scene: THREE.Scene): EnemyView {
  const models = createEnemyModelFactory()
  const pool: THREE.Group[] = []
  for (let i = 0; i < POOL_SIZE; i++) {
    const model = models.create()
    model.visible = false
    scene.add(model)
    pool.push(model)
  }

  return {
    sync(enemies) {
      pool.forEach((model, index) => {
        const enemy = enemies[index]
        if (!enemy) {
          model.visible = false
          return
        }
        model.visible = true
        model.position.set(enemy.position.x, enemy.position.y, enemy.position.z)
        // 進行方向へ機首を向ける。敵は +Z へ飛ぶので、こちらを向いた姿になる
        model.lookAt(
          enemy.position.x + enemy.velocity.x,
          enemy.position.y + enemy.velocity.y,
          enemy.position.z + enemy.velocity.z,
        )
        // 損傷の度合いを機体の傾きで示す。煙を出すより安上がりで、遠目にも分かる
        const damage = 1 - enemy.hp / enemy.maxHp
        model.rotateZ(damage * 0.5)
      })
    },
    dispose() {
      for (const model of pool) scene.remove(model)
      pool.length = 0
      // ジオメトリと材質は全機で共有しているので、作った側が一度だけ捨てる
      models.dispose()
    },
  }
}

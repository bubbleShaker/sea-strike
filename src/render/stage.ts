import * as THREE from 'three'
import { createSky } from './sky'
import { createOcean } from './ocean'
import { CRUISE_ALTITUDE } from '../game/constants'
import type { World } from '../game/world'
import { createEnemyView } from './enemy-view'
import { createBulletView } from './bullet-view'
import { createEnemyBulletView } from './enemy-bullet-view'
import { createEffects } from './effects'

/** 被弾で機体が揺すぶられる幅[m] と、傾く角[rad]。揺れの量（0..1）に掛ける */
const SHAKE_OFFSET = 1.4
const SHAKE_ROLL = 0.14

export interface Stage {
  /**
   * 世界をそのまま映して 1 フレーム描く。
   * time は秒（波の位相）、dt は前フレームからの経過（演出の進行）
   */
  render(time: number, dt: number, world: World): void
  dispose(): void
}

/**
 * 描画の一式（レンダラ・カメラ・海・空）をまとめて立ち上げる。
 * ゲームの規則はここに一切置かない。ここは「見せる係」に徹する。
 *
 * scene や camera を外へ出さないのは、外から `stage.scene.add(...)` できてしまうと
 * それが一番の近道になり、ゲーム側が Three.js に依存し始めるため。
 * 外に必要な操作が出てきたら、その都度この interface に絞った口を足す。
 */
export function createStage(container: HTMLElement): Stage {
  // DPR2 の画面では 1px のエッジがそもそも見えない。
  // MSAA は帯域を最も食う設定なので、高精細な端末では antialias を降ろす
  const highDensity = window.devicePixelRatio >= 2
  const renderer = new THREE.WebGLRenderer({
    antialias: !highDensity,
    powerPreference: 'high-performance',
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  container.appendChild(renderer.domElement)

  const scene = new THREE.Scene()

  // near/far の比は深度精度に効く。near を必要以上に寄せると遠景が z-fight する
  const camera = new THREE.PerspectiveCamera(75, 1, 1, 12000)
  camera.position.set(0, CRUISE_ALTITUDE, 0)

  const sky = createSky()
  scene.add(sky.mesh)

  const ocean = createOcean()
  scene.add(ocean.mesh)

  // 敵機を照らすための光。海と空は自前シェーダなので影響を受けない
  // 海の SUN_DIRECTION と揃える。背後から照らすことで、正面の敵に光が当たる
  const sun = new THREE.DirectionalLight(0xfff2dd, 2.4)
  sun.position.set(140, 270, 320)
  scene.add(sun)
  scene.add(new THREE.HemisphereLight(0xbcd8e6, 0x0d3a52, 1.4))

  const enemyView = createEnemyView(scene)
  const bulletView = createBulletView(scene)
  const enemyBulletView = createEnemyBulletView(scene)
  const effects = createEffects(scene)

  const resize = () => {
    const width = container.clientWidth
    const height = container.clientHeight
    // URL バーの伸縮などで一瞬 0 になることがある。aspect が NaN になるのを防ぐ
    if (width === 0 || height === 0) return
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
  }
  resize()
  window.addEventListener('resize', resize)

  return {
    render(time, dt, world) {
      const { position } = world.flight
      camera.position.set(position.x, position.y, position.z)
      // YXZ 順は「まず左右に振り、次に上下に振り、最後に傾ける」の順。
      // 既定の XYZ 順だと、上を向いた状態で左右に振ったとき視界が捩れる
      camera.rotation.set(world.flight.pitch, world.flight.yaw, world.flight.bank, 'YXZ')

      effects.emit(world.events)
      effects.update(dt, camera.position)

      // 被弾の衝撃。機体が揺すぶられたように見せる。
      //
      // 揺らすのは位置と傾き（roll）だけで、視線の向き（pitch / yaw）は動かさない。
      // 向きを揺らすと、弾が飛ぶ方向と画面中央のクロスヘアがずれ、
      // 被弾のあと 1 秒ほど「狙ったのに外れる」状態になる。
      // roll は画面が回るだけで中心は動かないので、照準を嘘にしない
      if (effects.shake > 0) {
        const amount = effects.shake
        camera.position.x += (Math.random() - 0.5) * SHAKE_OFFSET * amount
        camera.position.y += (Math.random() - 0.5) * SHAKE_OFFSET * amount
        camera.rotation.z += (Math.random() - 0.5) * SHAKE_ROLL * amount
      }

      sky.follow(camera.position)
      ocean.update(time, camera.position)
      enemyView.sync(world.enemies)
      bulletView.sync(world.bullets, camera.position)
      enemyBulletView.sync(world.enemyBullets, camera.position)
      renderer.render(scene, camera)
    },
    dispose() {
      window.removeEventListener('resize', resize)
      enemyView.dispose()
      bulletView.dispose()
      enemyBulletView.dispose()
      effects.dispose()
      // renderer.dispose() は GPU 上の geometry / material までは解放しない。
      // 海の板だけで数万頂点あるので、明示的に辿って捨てる
      scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return
        object.geometry.dispose()
        const materials = Array.isArray(object.material) ? object.material : [object.material]
        for (const material of materials) material.dispose()
      })
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}

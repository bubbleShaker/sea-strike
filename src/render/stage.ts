import * as THREE from 'three'
import { createSky } from './sky'
import { createOcean } from './ocean'
import { CRUISE_ALTITUDE } from '../game/constants'
import type { FlightState } from '../game/flight'

export interface Stage {
  /** 機体の状態を映して 1 フレーム描く。time は秒（波の位相に使う） */
  render(time: number, flight: FlightState): void
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
  const sun = new THREE.DirectionalLight(0xfff2dd, 2.2)
  sun.position.set(120, 200, -240)
  scene.add(sun)
  scene.add(new THREE.HemisphereLight(0xbcd8e6, 0x0d3a52, 1.4))

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
    render(time, flight) {
      const { position } = flight
      camera.position.set(position.x, position.y, position.z)
      // YXZ 順は「まず左右に振り、次に上下に振り、最後に傾ける」の順。
      // 既定の XYZ 順だと、上を向いた状態で左右に振ったとき視界が捩れる
      camera.rotation.set(flight.pitch, flight.yaw, flight.bank, 'YXZ')

      sky.follow(camera.position)
      ocean.update(time, camera.position)
      renderer.render(scene, camera)
    },
    dispose() {
      window.removeEventListener('resize', resize)
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

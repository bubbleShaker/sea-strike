import * as THREE from 'three'
import { createSky } from './sky'
import { createOcean, type Ocean } from './ocean'

export interface Stage {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  ocean: Ocean
  /** 波を進めて 1 フレーム描く。time は秒 */
  render(time: number): void
  dispose(): void
}

/** 巡航高度。低すぎると波に埋もれ、高すぎると海が遠い書き割りになる */
export const CRUISE_ALTITUDE = 48

/**
 * 描画の一式（レンダラ・カメラ・海・空）をまとめて立ち上げる。
 * ゲームの規則はここに一切置かない。ここは「見せる係」に徹する。
 */
export function createStage(container: HTMLElement): Stage {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
  // 端末の実解像度をそのまま使うと高精細スマホで描画量が跳ね上がる。2 倍で頭打ちにする
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  container.appendChild(renderer.domElement)

  const scene = new THREE.Scene()

  // near を 0.5 まで寄せるのは、機首の目の前を弾が抜けるため。
  // far は空ドーム(半径 6000)を収める距離
  const camera = new THREE.PerspectiveCamera(75, 1, 0.5, 12000)
  camera.position.set(0, CRUISE_ALTITUDE, 0)

  scene.add(createSky())

  const ocean = createOcean()
  scene.add(ocean.mesh)

  // 敵機を照らすための光。海は自前シェーダなので影響しない
  const sun = new THREE.DirectionalLight(0xfff2dd, 2.2)
  sun.position.set(120, 200, -240)
  scene.add(sun)
  scene.add(new THREE.HemisphereLight(0xbcd8e6, 0x0d3a52, 1.4))

  const resize = () => {
    const width = container.clientWidth
    const height = container.clientHeight
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
  }
  resize()
  window.addEventListener('resize', resize)

  return {
    scene,
    camera,
    ocean,
    render(time) {
      ocean.update(time, camera.position)
      renderer.render(scene, camera)
    },
    dispose() {
      window.removeEventListener('resize', resize)
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}

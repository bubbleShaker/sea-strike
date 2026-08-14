import * as THREE from 'three'
import type { WorldEvent } from '../game/world'
import { WEAPON_COLOR } from '../theme'

const BURST_POOL = 28
const DEBRIS_POOL = 64

interface Burst {
  sprite: THREE.Sprite
  /** 残り時間[s]。0 で消える */
  life: number
  duration: number
  size: number
}

interface Debris {
  mesh: THREE.Mesh
  velocity: THREE.Vector3
  spin: THREE.Vector3
  life: number
  duration: number
}

/**
 * 光の粒。放射状のグラデーションを描いた小さな画像を作る。
 *
 * 画像ファイルを持たずに済ませたいので、その場で canvas に描いて渡す。
 * 素の四角いスプライトでは火花に見えない
 */
function createGlowTexture(): THREE.Texture {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (context) {
    const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    gradient.addColorStop(0, 'rgba(255,255,255,1)')
    gradient.addColorStop(0.3, 'rgba(255,214,140,0.8)')
    gradient.addColorStop(0.6, 'rgba(255,120,50,0.35)')
    gradient.addColorStop(1, 'rgba(255,90,30,0)')
    context.fillStyle = gradient
    context.fillRect(0, 0, size, size)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

export interface Effects {
  /** そのフレームの出来事を受け取って演出を置く */
  emit(events: WorldEvent[], muzzle: THREE.Vector3, forward: THREE.Vector3): void
  update(dt: number): void
  /**
   * 被弾などで積んだ揺れの強さ。stage がカメラに適用する。
   * 揺らすのはカメラの持ち主の仕事なので、ここでは量だけを持つ
   */
  readonly shake: number
  dispose(): void
}

/**
 * 命中・撃墜・発射の手応え。
 *
 * 当たったかどうかは、数字より先に目で分かる必要がある。
 * ここは世界の状態を持たず、通知（WorldEvent）を見て一度きりの光を置くだけ。
 */
export function createEffects(scene: THREE.Scene): Effects {
  const texture = createGlowTexture()
  const bursts: Burst[] = []
  const debris: Debris[] = []
  let shake = 0

  for (let i = 0; i < BURST_POOL; i++) {
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    const sprite = new THREE.Sprite(material)
    sprite.visible = false
    scene.add(sprite)
    bursts.push({ sprite, life: 0, duration: 1, size: 1 })
  }

  // 破片は爆発の全機で使い回す。形は同じで向きだけ違えば、飛び散って見える
  const debrisGeometry = new THREE.TetrahedronGeometry(1.6)
  const debrisMaterial = new THREE.MeshStandardMaterial({
    color: '#5a6672',
    roughness: 0.7,
    metalness: 0.3,
  })
  for (let i = 0; i < DEBRIS_POOL; i++) {
    const mesh = new THREE.Mesh(debrisGeometry, debrisMaterial)
    mesh.visible = false
    scene.add(mesh)
    debris.push({
      mesh,
      velocity: new THREE.Vector3(),
      spin: new THREE.Vector3(),
      life: 0,
      duration: 1,
    })
  }

  const placeBurst = (
    position: { x: number; y: number; z: number },
    size: number,
    duration: number,
    color: THREE.ColorRepresentation,
  ) => {
    // 空いている枠を探す。無ければ一番寿命が短いものを奪う（消える寸前のもの）
    let slot = bursts.find((burst) => burst.life <= 0)
    if (!slot) slot = bursts.reduce((a, b) => (a.life < b.life ? a : b))
    slot.sprite.position.set(position.x, position.y, position.z)
    slot.sprite.material.color.set(color)
    slot.sprite.visible = true
    slot.life = duration
    slot.duration = duration
    slot.size = size
  }

  const scatterDebris = (position: { x: number; y: number; z: number }, count: number) => {
    let placed = 0
    for (const piece of debris) {
      if (placed >= count) break
      if (piece.life > 0) continue
      piece.mesh.position.set(position.x, position.y, position.z)
      piece.mesh.visible = true
      piece.mesh.scale.setScalar(0.6 + Math.random() * 0.9)
      // 球面に一様な方向へ弾き飛ばす
      const theta = Math.random() * Math.PI * 2
      const z = Math.random() * 2 - 1
      const r = Math.sqrt(1 - z * z)
      const speed = 25 + Math.random() * 45
      piece.velocity.set(r * Math.cos(theta) * speed, r * Math.sin(theta) * speed, z * speed)
      piece.spin.set(Math.random() * 8 - 4, Math.random() * 8 - 4, Math.random() * 8 - 4)
      piece.life = 1.1 + Math.random() * 0.6
      piece.duration = piece.life
      placed += 1
    }
  }

  return {
    get shake() {
      return shake
    },
    emit(events, muzzle, forward) {
      for (const event of events) {
        if (event.type === 'hit') {
          placeBurst(event.position, 14, 0.22, '#ffd9a0')
        } else if (event.type === 'kill') {
          placeBurst(event.position, 70, 0.8, '#ffb066')
          scatterDebris(event.position, 8)
        } else if (event.type === 'fire') {
          // 銃口の光。弾そのものより手前で一瞬だけ光らせる
          const flash = muzzle.clone().addScaledVector(forward, 4)
          placeBurst(flash, 5, 0.06, WEAPON_COLOR[event.weapon])
        } else if (event.type === 'damage') {
          // 受けた量に応じて揺らす。上限を置かないと接触で画面が飛ぶ
          shake = Math.min(shake + event.amount * 0.014, 1.1)
        }
      }
    },
    update(dt) {
      for (const burst of bursts) {
        if (burst.life <= 0) continue
        burst.life -= dt
        if (burst.life <= 0) {
          burst.sprite.visible = false
          continue
        }
        // 経過とともに広がりながら薄くなる
        const progress = 1 - burst.life / burst.duration
        const scale = burst.size * (0.35 + progress * 0.9)
        burst.sprite.scale.set(scale, scale, 1)
        burst.sprite.material.opacity = 1 - progress * progress
      }

      for (const piece of debris) {
        if (piece.life <= 0) continue
        piece.life -= dt
        if (piece.life <= 0) {
          piece.mesh.visible = false
          continue
        }
        piece.mesh.position.addScaledVector(piece.velocity, dt)
        // 落ちていく。空中で止まると破片に見えない
        piece.velocity.y -= 60 * dt
        piece.mesh.rotation.x += piece.spin.x * dt
        piece.mesh.rotation.y += piece.spin.y * dt
        piece.mesh.rotation.z += piece.spin.z * dt
        piece.mesh.scale.multiplyScalar(1 - dt * 0.35)
      }

      // 揺れは指数的に収まる。dt に依らず同じ速さで落ち着かせる
      shake *= Math.exp(-6 * dt)
      if (shake < 0.002) shake = 0
    },
    dispose() {
      for (const burst of bursts) {
        scene.remove(burst.sprite)
        burst.sprite.material.dispose()
      }
      for (const piece of debris) scene.remove(piece.mesh)
      bursts.length = 0
      debris.length = 0
      debrisGeometry.dispose()
      debrisMaterial.dispose()
      texture.dispose()
    },
  }
}

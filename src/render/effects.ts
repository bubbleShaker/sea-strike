import * as THREE from 'three'
import type { WorldEvent } from '../game/world'

const POOL_SIZE = 24

interface Burst {
  sprite: THREE.Sprite
  /** 残り時間[s]。0 で消える */
  life: number
  duration: number
  size: number
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
  /** そのフレームの出来事を受け取って火花を置く */
  emit(events: WorldEvent[]): void
  update(dt: number): void
  dispose(): void
}

/**
 * 命中と撃墜の手応え。
 *
 * 当たったかどうかは、数字より先に光で分かる必要がある。
 * ここは世界の状態を持たず、通知（WorldEvent）を見て一度きりの光を置くだけ。
 */
export function createEffects(scene: THREE.Scene): Effects {
  const texture = createGlowTexture()
  const bursts: Burst[] = []

  for (let i = 0; i < POOL_SIZE; i++) {
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

  const place = (position: { x: number; y: number; z: number }, size: number, duration: number) => {
    // 空いている枠を探す。無ければ一番寿命が短いものを奪う（見えなくなる寸前のもの）
    let slot = bursts.find((burst) => burst.life <= 0)
    if (!slot) slot = bursts.reduce((a, b) => (a.life < b.life ? a : b))
    slot.sprite.position.set(position.x, position.y, position.z)
    slot.sprite.visible = true
    slot.life = duration
    slot.duration = duration
    slot.size = size
  }

  return {
    emit(events) {
      for (const event of events) {
        if (event.type === 'hit') place(event.position, 14, 0.22)
        else if (event.type === 'kill') place(event.position, 70, 0.75)
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
    },
    dispose() {
      for (const burst of bursts) {
        scene.remove(burst.sprite)
        burst.sprite.material.dispose()
      }
      bursts.length = 0
      texture.dispose()
    },
  }
}

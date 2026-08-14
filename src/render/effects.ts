import * as THREE from 'three'
import type { WorldEvent } from '../game/world'
import { WEAPON_COLOR } from '../theme'
import { addShake, decayShake } from './shake'

const BURST_POOL = 28
const DEBRIS_POOL = 64

/** 演出の大きさ[m]。距離で補正する前の基準値 */
const HIT_SIZE = 14
const KILL_SIZE = 70
/**
 * 銃口の光は自機の数 m 先で光る。他の演出と同じ大きさにすると、
 * 近すぎて画面の下半分を覆う。視界の端で瞬く程度に留める
 */
const MUZZLE_SIZE = 1.8

const HIT_DURATION = 0.22
const KILL_DURATION = 0.8
const MUZZLE_DURATION = 0.06

/** 1 回の撃墜で飛ばす破片の数 */
const DEBRIS_PER_KILL = 8
/** 破片の基準の大きさ[m]。実寸は機体（翼幅 26m）の破片としては小さめ */
const DEBRIS_SIZE = 1.6
/**
 * 遠くの破片が 1 画素以下になると、描いても見えないのに負荷だけ残る。
 * 距離に応じて見かけの大きさを保つ（弾の曳光と同じ手）
 */
const DEBRIS_APPARENT_SCALE = 0.004
const DEBRIS_GRAVITY = 60
/** 落ちながら小さくなって消える。急に消えると目に付く */
const DEBRIS_SHRINK = 0.35

interface Burst {
  sprite: THREE.Sprite
  /** 残り時間[s]。0 で消える */
  life: number
  duration: number
  size: number
}

interface Debris {
  position: THREE.Vector3
  rotation: THREE.Euler
  velocity: THREE.Vector3
  spin: THREE.Vector3
  /** 基準の大きさ。表示時に距離で補正する */
  size: number
  life: number
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
  emit(events: WorldEvent[]): void
  update(dt: number, cameraPosition: THREE.Vector3): void
  /**
   * 被弾で積んだ揺れの強さ。stage がカメラに適用する。
   * 揺らすのはカメラの持ち主の仕事なので、ここでは量だけを持つ
   */
  readonly shake: number
  dispose(): void
}

/**
 * 命中・撃墜・発射の手応え。
 *
 * 当たったかどうかは、数字より先に目で分かる必要がある。
 * ここが持つのは演出の状態（光の寿命、破片の飛び方、揺れの残量）だけで、
 * 世界の状態は持たない。通知（WorldEvent）を見て一度きりの光を置く。
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

  // 破片は形も色も同じなので、1 回の描画命令でまとめて出す。
  // 64 個を個別の Mesh にすると、敵機 5 機ぶん（25）より多いドローコールを
  // 破片だけで払うことになる
  const debrisGeometry = new THREE.TetrahedronGeometry(DEBRIS_SIZE)
  const debrisMaterial = new THREE.MeshLambertMaterial({ color: '#5a6672' })
  const debrisMesh = new THREE.InstancedMesh(debrisGeometry, debrisMaterial, DEBRIS_POOL)
  debrisMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  debrisMesh.frustumCulled = false
  debrisMesh.count = 0
  scene.add(debrisMesh)

  for (let i = 0; i < DEBRIS_POOL; i++) {
    debris.push({
      position: new THREE.Vector3(),
      rotation: new THREE.Euler(),
      velocity: new THREE.Vector3(),
      spin: new THREE.Vector3(),
      size: 1,
      life: 0,
    })
  }

  // 行列を組み立てるための使い捨ての入れ物。毎フレーム new しないため使い回す
  const dummy = new THREE.Object3D()

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
      piece.position.set(position.x, position.y, position.z)
      piece.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6)
      piece.size = 0.6 + Math.random() * 0.9
      // 球面に一様な方向へ弾き飛ばす（角度を 2 つ振ると極に偏る）
      const theta = Math.random() * Math.PI * 2
      const z = Math.random() * 2 - 1
      const r = Math.sqrt(1 - z * z)
      const speed = 25 + Math.random() * 45
      piece.velocity.set(r * Math.cos(theta) * speed, r * Math.sin(theta) * speed, z * speed)
      piece.spin.set(Math.random() * 8 - 4, Math.random() * 8 - 4, Math.random() * 8 - 4)
      piece.life = 1.1 + Math.random() * 0.6
      placed += 1
    }
  }

  return {
    get shake() {
      return shake
    },
    emit(events) {
      for (const event of events) {
        if (event.type === 'hit') {
          placeBurst(event.position, HIT_SIZE, HIT_DURATION, '#ffd9a0')
        } else if (event.type === 'kill') {
          placeBurst(event.position, KILL_SIZE, KILL_DURATION, '#ffb066')
          scatterDebris(event.position, DEBRIS_PER_KILL)
        } else if (event.type === 'fire') {
          // 銃口の光。位置は世界が教えてくれる（描画側で計算し直さない）
          placeBurst(event.position, MUZZLE_SIZE, MUZZLE_DURATION, WEAPON_COLOR[event.weapon])
        } else if (event.type === 'damage') {
          shake = addShake(shake, event.amount)
        }
      }
    },
    update(dt, cameraPosition) {
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

      let visible = 0
      for (const piece of debris) {
        if (piece.life <= 0) continue
        piece.life -= dt
        piece.position.addScaledVector(piece.velocity, dt)
        // 落ちていく。空中で止まると破片に見えない
        piece.velocity.y -= DEBRIS_GRAVITY * dt
        piece.rotation.x += piece.spin.x * dt
        piece.rotation.y += piece.spin.y * dt
        piece.rotation.z += piece.spin.z * dt
        piece.size *= 1 - dt * DEBRIS_SHRINK
        // 海に落ちたら終わり。海面下を沈み続けても誰にも見えない
        if (piece.life <= 0 || piece.position.y <= 0) {
          piece.life = 0
          continue
        }

        dummy.position.copy(piece.position)
        dummy.rotation.copy(piece.rotation)
        // 遠いほど実寸より大きく描く。そうしないと画素に届かない
        const distance = cameraPosition.distanceTo(piece.position)
        dummy.scale.setScalar(Math.max(piece.size, distance * DEBRIS_APPARENT_SCALE))
        dummy.updateMatrix()
        debrisMesh.setMatrixAt(visible, dummy.matrix)
        visible += 1
      }
      debrisMesh.count = visible
      debrisMesh.instanceMatrix.needsUpdate = true

      shake = decayShake(shake, dt)
    },
    dispose() {
      for (const burst of bursts) {
        scene.remove(burst.sprite)
        burst.sprite.material.dispose()
      }
      bursts.length = 0
      debris.length = 0
      scene.remove(debrisMesh)
      debrisMesh.dispose()
      debrisGeometry.dispose()
      debrisMaterial.dispose()
      texture.dispose()
    },
  }
}

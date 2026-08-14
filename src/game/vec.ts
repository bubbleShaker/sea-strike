/**
 * 3 次元ベクトル。Three.js の Vector3 を使わないのは、ドメイン層を描画から
 * 切り離しておくため（ここのコードは WebGL を立ち上げずにテストできる）。
 */
export interface Vec3 {
  x: number
  y: number
  z: number
}

export function vec(x: number, y: number, z: number): Vec3 {
  return { x, y, z }
}

export function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }
}

export function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
}

export function scale(a: Vec3, factor: number): Vec3 {
  return { x: a.x * factor, y: a.y * factor, z: a.z * factor }
}

export function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z
}

export function lengthSquared(a: Vec3): number {
  return dot(a, a)
}

export function length(a: Vec3): number {
  return Math.sqrt(lengthSquared(a))
}

export function normalize(a: Vec3): Vec3 {
  const size = length(a)
  return size === 0 ? vec(0, 0, 0) : scale(a, 1 / size)
}

/**
 * 機首の向き（yaw / pitch）を単位ベクトルに直す。
 * Three.js に合わせて -Z が正面、+Y が上、yaw は + が左。
 */
export function direction(yaw: number, pitch: number): Vec3 {
  const cosPitch = Math.cos(pitch)
  return {
    x: -Math.sin(yaw) * cosPitch,
    y: Math.sin(pitch),
    z: -Math.cos(yaw) * cosPitch,
  }
}

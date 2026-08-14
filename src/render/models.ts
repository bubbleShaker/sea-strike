import * as THREE from 'three'

/**
 * 敵機を組み立てる部品。
 *
 * 形も色も全機で同じなので、ジオメトリとマテリアルは 1 セットだけ作って
 * 全機で共有する。機体ごとに作ると、8 機ぶんで 40 個の GPU リソースを
 * 抱えることになる（中身は同じもの）。
 * 共有している以上、破棄はプールではなく disposeEnemyResources が一度だけ行う。
 */
const BODY_GEOMETRY = new THREE.ConeGeometry(3.2, 17, 6)
// ConeGeometry は +Y へ尖る。機首を前（-Z）へ倒した状態で焼き込んでおく
BODY_GEOMETRY.rotateX(-Math.PI / 2)

const WING_GEOMETRY = new THREE.BoxGeometry(26, 0.8, 5.5)
const TAIL_GEOMETRY = new THREE.BoxGeometry(11, 0.7, 3)
const FIN_GEOMETRY = new THREE.BoxGeometry(0.7, 5, 4)
const NOSE_GEOMETRY = new THREE.SphereGeometry(1.6, 8, 6)

const BODY_MATERIAL = new THREE.MeshStandardMaterial({
  color: '#3d4a55',
  roughness: 0.55,
  metalness: 0.4,
})
const WING_MATERIAL = new THREE.MeshStandardMaterial({
  color: '#4d5b68',
  roughness: 0.6,
  metalness: 0.35,
})
const NOSE_MATERIAL = new THREE.MeshStandardMaterial({
  color: '#d8433a',
  emissive: '#5a120d',
  roughness: 0.4,
})

/**
 * 敵の戦闘機。外部のモデルファイルは持たず、箱と円錐で組む。
 *
 * 素材を読み込まないのは、公開物を単体で完結させるため（読み込み待ちも
 * 失敗経路も増やさない）。シルエットさえ航空機に見えれば、
 * 数百 m 先を高速で横切る相手としては足りる。
 */
export function createEnemyModel(): THREE.Group {
  const group = new THREE.Group()

  group.add(new THREE.Mesh(BODY_GEOMETRY, BODY_MATERIAL))

  const wings = new THREE.Mesh(WING_GEOMETRY, WING_MATERIAL)
  wings.position.z = 1.5
  group.add(wings)

  const tailWing = new THREE.Mesh(TAIL_GEOMETRY, WING_MATERIAL)
  tailWing.position.z = 7.5
  group.add(tailWing)

  const fin = new THREE.Mesh(FIN_GEOMETRY, WING_MATERIAL)
  fin.position.set(0, 2.4, 7.5)
  group.add(fin)

  // 敵味方が一目で分かるよう、機首に赤い印を置く
  const nose = new THREE.Mesh(NOSE_GEOMETRY, NOSE_MATERIAL)
  nose.position.z = -8
  group.add(nose)

  return group
}

/** 共有している GPU リソースを解放する。ページを畳むときに一度だけ呼ぶ */
export function disposeEnemyResources(): void {
  for (const geometry of [
    BODY_GEOMETRY,
    WING_GEOMETRY,
    TAIL_GEOMETRY,
    FIN_GEOMETRY,
    NOSE_GEOMETRY,
  ]) {
    geometry.dispose()
  }
  for (const material of [BODY_MATERIAL, WING_MATERIAL, NOSE_MATERIAL]) {
    material.dispose()
  }
}

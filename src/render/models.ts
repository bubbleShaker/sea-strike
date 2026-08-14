import * as THREE from 'three'

/**
 * 敵の戦闘機。外部のモデルファイルは持たず、箱と円錐で組む。
 *
 * 素材を読み込まないのは、公開物を単体で完結させるため（読み込み待ちも
 * 失敗経路も増やさない）。シルエットさえ航空機に見えれば、
 * 数百 m 先を高速で横切る相手としては足りる。
 */
export function createEnemyModel(): THREE.Group {
  const group = new THREE.Group()

  const body = new THREE.Mesh(
    new THREE.ConeGeometry(3.2, 17, 6),
    new THREE.MeshStandardMaterial({ color: '#3d4a55', roughness: 0.55, metalness: 0.4 }),
  )
  // ConeGeometry は +Y へ尖る。機首を前（-Z）へ倒す
  body.rotation.x = -Math.PI / 2
  group.add(body)

  const wingMaterial = new THREE.MeshStandardMaterial({
    color: '#4d5b68',
    roughness: 0.6,
    metalness: 0.35,
  })
  const wings = new THREE.Mesh(new THREE.BoxGeometry(26, 0.8, 5.5), wingMaterial)
  wings.position.z = 1.5
  group.add(wings)

  const tailWing = new THREE.Mesh(new THREE.BoxGeometry(11, 0.7, 3), wingMaterial)
  tailWing.position.z = 7.5
  group.add(tailWing)

  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.7, 5, 4), wingMaterial)
  fin.position.set(0, 2.4, 7.5)
  group.add(fin)

  // 敵味方が一目で分かるよう、機首に赤い印を置く
  const nose = new THREE.Mesh(
    new THREE.SphereGeometry(1.6, 8, 6),
    new THREE.MeshStandardMaterial({ color: '#d8433a', emissive: '#5a120d', roughness: 0.4 }),
  )
  nose.position.z = -8
  group.add(nose)

  return group
}

/** モデルを構成する geometry / material をまとめて解放する */
export function disposeModel(root: THREE.Object3D): void {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return
    object.geometry.dispose()
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    for (const material of materials) material.dispose()
  })
}

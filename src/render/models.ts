import * as THREE from 'three'

export interface EnemyModelFactory {
  /** 1 機ぶんの見た目を組み立てる。中身のジオメトリ・材質は全機で共有される */
  create(): THREE.Group
  /** 共有分をまとめて解放する。作った側が一度だけ呼ぶ */
  dispose(): void
}

/**
 * 敵の戦闘機。外部のモデルファイルは持たず、箱と円錐で組む。
 *
 * 素材を読み込まないのは、公開物を単体で完結させるため（読み込み待ちも
 * 失敗経路も増やさない）。シルエットさえ航空機に見えれば、
 * 数百 m 先を高速で横切る相手としては足りる。
 *
 * 形も色も全機で同じなので、ジオメトリと材質は 1 セットだけ作って共有する。
 * 機体ごとに作ると、8 機ぶんで中身の同じ GPU リソースを 40 個抱えることになる。
 *
 * ファクトリにしているのは所有権のため。モジュールの共有変数にすると、
 * 二つ目のステージを作った瞬間に「自分が作っていないものを捨てる dispose」が
 * 生まれ、先に畳んだ側が後発のリソースを壊す。
 */
export function createEnemyModelFactory(): EnemyModelFactory {
  const bodyGeometry = new THREE.ConeGeometry(3.2, 17, 6)
  // ConeGeometry は +Y へ尖る。機首を前（-Z）へ倒した状態で焼き込んでおく
  bodyGeometry.rotateX(-Math.PI / 2)

  const wingGeometry = new THREE.BoxGeometry(26, 0.8, 5.5)
  const tailGeometry = new THREE.BoxGeometry(11, 0.7, 3)
  const finGeometry = new THREE.BoxGeometry(0.7, 5, 4)
  const noseGeometry = new THREE.SphereGeometry(1.6, 8, 6)

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: '#3d4a55',
    roughness: 0.55,
    metalness: 0.4,
  })
  const wingMaterial = new THREE.MeshStandardMaterial({
    color: '#4d5b68',
    roughness: 0.6,
    metalness: 0.35,
  })
  const noseMaterial = new THREE.MeshStandardMaterial({
    color: '#d8433a',
    emissive: '#5a120d',
    roughness: 0.4,
  })

  return {
    create() {
      const group = new THREE.Group()
      group.add(new THREE.Mesh(bodyGeometry, bodyMaterial))

      const wings = new THREE.Mesh(wingGeometry, wingMaterial)
      wings.position.z = 1.5
      group.add(wings)

      const tailWing = new THREE.Mesh(tailGeometry, wingMaterial)
      tailWing.position.z = 7.5
      group.add(tailWing)

      const fin = new THREE.Mesh(finGeometry, wingMaterial)
      fin.position.set(0, 2.4, 7.5)
      group.add(fin)

      // 敵味方が一目で分かるよう、機首に赤い印を置く
      const nose = new THREE.Mesh(noseGeometry, noseMaterial)
      nose.position.z = -8
      group.add(nose)

      return group
    },
    dispose() {
      for (const geometry of [
        bodyGeometry,
        wingGeometry,
        tailGeometry,
        finGeometry,
        noseGeometry,
      ]) {
        geometry.dispose()
      }
      for (const material of [bodyMaterial, wingMaterial, noseMaterial]) {
        material.dispose()
      }
    },
  }
}

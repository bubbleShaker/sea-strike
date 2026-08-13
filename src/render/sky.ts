import * as THREE from 'three'

/** 水平線の色。海のフォグ色と空の下端をここで合わせる。書き換えないこと（両者で共有している） */
export const HORIZON_COLOR = new THREE.Color('#bcd8e6')
export const ZENITH_COLOR = new THREE.Color('#2b6ea8')

export interface Sky {
  mesh: THREE.Mesh
  /** ドームをカメラへ運び直す。前進し続けても球の外へ出ないようにする */
  follow(cameraPosition: THREE.Vector3): void
}

/**
 * 空。裏返した巨大な球にグラデーションを塗っただけのドーム。
 *
 * side: BackSide は「面の裏側だけ描く」指定。球の内側にカメラが入るので、
 * 表を描くと自分を包む球に遮られて何も見えなくなる。
 * depthWrite: false で深度バッファに書かせないのは、常に一番奥にいてほしいため。
 */
export function createSky(): Sky {
  const geometry = new THREE.SphereGeometry(6000, 32, 16)
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uHorizon: { value: HORIZON_COLOR },
      uZenith: { value: ZENITH_COLOR },
    },
    vertexShader: /* glsl */ `
      varying vec3 vPosition;
      void main() {
        vPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    // 末尾の colorspace_fragment は three が用意する変換チャンク。
    // three は Color('#...') を linear-sRGB で保持し、組み込みマテリアルは
    // 描画の最後に sRGB へ戻している。自前シェーダはその工程を持たないので、
    // 入れないと指定した色より暗く沈む
    fragmentShader: /* glsl */ `
      uniform vec3 uHorizon;
      uniform vec3 uZenith;
      varying vec3 vPosition;
      void main() {
        // 球の高さ(-1..1)を 0..1 に均し、水平線付近を厚めに残す
        float h = normalize(vPosition).y;
        float t = smoothstep(-0.05, 0.55, h);
        gl_FragColor = vec4(mix(uHorizon, uZenith, t), 1.0);
        #include <colorspace_fragment>
      }
    `,
  })

  const mesh = new THREE.Mesh(geometry, material)
  mesh.frustumCulled = false

  return {
    mesh,
    follow(cameraPosition) {
      mesh.position.copy(cameraPosition)
    },
  }
}

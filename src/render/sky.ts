import * as THREE from 'three'

/** 水平線の高さ。海のフォグ色と空の下端をここで合わせる */
export const HORIZON_COLOR = new THREE.Color('#bcd8e6')
export const ZENITH_COLOR = new THREE.Color('#2b6ea8')

/**
 * 空。裏返した巨大な球にグラデーションを塗っただけのドーム。
 *
 * side: BackSide は「面の裏側だけ描く」指定。球の内側にカメラが入るので、
 * 表を描くと自分を包む球に遮られて何も見えなくなる。
 * depthWrite: false で深度バッファに書かせないのは、常に一番奥にいてほしいため。
 */
export function createSky(): THREE.Mesh {
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
    fragmentShader: /* glsl */ `
      uniform vec3 uHorizon;
      uniform vec3 uZenith;
      varying vec3 vPosition;
      void main() {
        // 球の高さ(-1..1)を 0..1 に均し、水平線付近を厚めに残す
        float h = normalize(vPosition).y;
        float t = smoothstep(-0.05, 0.55, h);
        gl_FragColor = vec4(mix(uHorizon, uZenith, t), 1.0);
      }
    `,
  })

  const sky = new THREE.Mesh(geometry, material)
  sky.frustumCulled = false
  return sky
}

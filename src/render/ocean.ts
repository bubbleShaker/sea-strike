import * as THREE from 'three'
import { HORIZON_COLOR } from './sky'

/** 太陽の向き。海の反射と、後で敵機のライティングで共有する */
export const SUN_DIRECTION = new THREE.Vector3(0.35, 0.6, -0.7).normalize()

/**
 * 板の一辺。フォグが 4200 で空の色に飽和するので、
 * 中心から 4200 以上あれば板の縁は水平線に溶けて見えない。
 * それ以上広げても、単色を吐くだけのポリゴンが増える
 */
const SIZE = 9000
/**
 * 分割数。頂点シェーダで波を作る以上、細かいほど波が滑らかになる。
 * 1 マス約 47m の密度を保ちつつ、スマホの GPU で 60fps を保てる量として選んだ
 */
const SEGMENTS = 192

export interface Ocean {
  mesh: THREE.Mesh
  /** 波を進め、海をカメラの真下に運び直す */
  update(time: number, cameraPosition: THREE.Vector3): void
}

/**
 * 海面。板ポリを頂点シェーダで波打たせているだけで、水の物理はしていない。
 *
 * 無限に広い海に見せる仕掛け:
 * 板そのものは常にカメラの真下へ動かし、波の位相はワールド座標で計算する。
 * 板が動いても波模様は空間に固定されるので、板の縁に着かないまま前へ進み続けられる。
 */
export function createOcean(): Ocean {
  const geometry = new THREE.PlaneGeometry(SIZE, SIZE, SEGMENTS, SEGMENTS)
  // PlaneGeometry は XY 平面に立って生まれるので、寝かせて床にする
  geometry.rotateX(-Math.PI / 2)

  const uniforms = {
    uTime: { value: 0 },
    /** 板の中心のワールド座標。波の位相をここで補正してワールド固定にする */
    uOrigin: { value: new THREE.Vector2(0, 0) },
    uSun: { value: SUN_DIRECTION },
    uDeep: { value: new THREE.Color('#04283f') },
    uShallow: { value: new THREE.Color('#1d7ba8') },
    uFogColor: { value: HORIZON_COLOR },
  }

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform vec2 uOrigin;

      varying vec3 vNormal;
      varying vec3 vWorldPosition;
      varying float vHeight;

      // 三方向の正弦波を重ねただけの海。周期の違う波を足すと繰り返しが目立たなくなる
      float waveHeight(vec2 p, float t) {
        return sin(p.x * 0.021 + t * 1.1) * 1.6
             + sin(p.y * 0.033 - t * 0.9) * 1.1
             + sin((p.x + p.y) * 0.012 + t * 0.6) * 2.2;
      }

      void main() {
        // ローカル座標 + 板の現在地 = ワールド座標。これを波の入力にする
        vec2 world = position.xz + uOrigin;
        float h = waveHeight(world, uTime);

        // 高さの傾き（偏微分）から法線を出す。テクスチャを持たずに陰影を得るため
        float dx = cos(world.x * 0.021 + uTime * 1.1) * 1.6 * 0.021
                 + cos((world.x + world.y) * 0.012 + uTime * 0.6) * 2.2 * 0.012;
        float dz = cos(world.y * 0.033 - uTime * 0.9) * 1.1 * 0.033
                 + cos((world.x + world.y) * 0.012 + uTime * 0.6) * 2.2 * 0.012;

        vNormal = normalize(vec3(-dx, 1.0, -dz));
        vHeight = h;

        vec3 displaced = vec3(position.x, h, position.z);
        vec4 worldPosition = modelMatrix * vec4(displaced, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uSun;
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      uniform vec3 uFogColor;

      varying vec3 vNormal;
      varying vec3 vWorldPosition;
      varying float vHeight;

      void main() {
        vec3 normal = normalize(vNormal);
        vec3 viewDir = normalize(cameraPosition - vWorldPosition);

        // 浅い角度で見るほど空を映す（フレネル）。水平線側が明るくなるのはこれ
        float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.0);
        float diffuse = max(dot(normal, uSun), 0.0);

        vec3 color = mix(uDeep, uShallow, diffuse * 0.6 + fresnel * 0.8);

        // 波頭の白。高いところだけ泡立たせる
        color += smoothstep(2.6, 4.2, vHeight) * 0.35;

        // 鏡面反射でぎらつきを一点だけ置く
        vec3 halfway = normalize(uSun + viewDir);
        color += pow(max(dot(normal, halfway), 0.0), 90.0) * 0.9;

        // 遠方を空の色へ溶かして水平線を作る
        float distance = length(cameraPosition - vWorldPosition);
        float fog = smoothstep(700.0, 4200.0, distance);
        gl_FragColor = vec4(mix(color, uFogColor, fog), 1.0);

        // three は Color('#...') を linear-sRGB で保持しており、組み込みマテリアルは
        // 描画の最後に sRGB へ戻している。自前シェーダはその工程を持たないので、
        // このチャンクを入れないと指定した色より暗く沈む
        #include <colorspace_fragment>
      }
    `,
  })

  const mesh = new THREE.Mesh(geometry, material)
  // 板は常にカメラの真下にいるため、視錐台カリングの判定が誤って消すことがある
  mesh.frustumCulled = false

  return {
    mesh,
    update(time, cameraPosition) {
      uniforms.uTime.value = time
      mesh.position.x = cameraPosition.x
      mesh.position.z = cameraPosition.z
      uniforms.uOrigin.value.set(cameraPosition.x, cameraPosition.z)
    },
  }
}

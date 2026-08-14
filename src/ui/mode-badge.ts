import type { AimSource } from '../input/aim'

const LABEL: Record<AimSource['kind'], string> = {
  tilt: 'TILT',
  swipe: 'SWIPE',
}

/**
 * 今どちらの操作が効いているかの表示。
 * 傾きからスワイプへ落ちたとき、プレイヤーが理由を分からないまま
 * 「動かない」と感じるのを防ぐためだけに置いている。
 */
export function createModeBadge(container: HTMLElement): { update(source: AimSource): void } {
  const badge = document.createElement('div')
  badge.className = 'mode-badge'
  container.appendChild(badge)

  let shown: string | null = null
  return {
    update(source) {
      const label = LABEL[source.kind]
      // 毎フレーム呼ばれる。変化した時だけ DOM に触る
      if (label === shown) return
      shown = label
      badge.textContent = label
    },
  }
}

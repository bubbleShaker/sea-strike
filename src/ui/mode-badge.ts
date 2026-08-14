import type { AimSource } from '../input/aim'

type AimKind = AimSource['kind']

/**
 * 今どちらの操作が効いているかの表示。傾き中はそのまま再センタリングのボタンになる。
 *
 * 二つの役目を一つに載せているのは、どちらも「傾きが思い通りに動かない」ときに
 * 見る場所だから。スワイプへ落ちた理由が分からないまま「動かない」と感じるのを防ぎ、
 * 基準がずれたときはその場で取り直せるようにする。
 */
export function createModeBadge(
  container: HTMLElement,
  onRecenter: () => void,
): { update(kind: AimKind): void } {
  const badge = document.createElement('button')
  badge.type = 'button'
  badge.className = 'mode-badge'
  // 照準の操作として拾われないようにする（このボタンの上でのドラッグは無効）
  badge.dataset.noAim = ''
  badge.addEventListener('click', onRecenter)
  container.appendChild(badge)

  let shown: AimKind | null = null
  return {
    update(kind) {
      // 毎フレーム呼ばれる。変化した時だけ DOM に触る
      if (kind === shown) return
      shown = kind
      badge.textContent = kind === 'tilt' ? 'TILT ⟲' : 'SWIPE'
      badge.disabled = kind !== 'tilt'
      badge.title = kind === 'tilt' ? 'タップで今の姿勢を基準にし直す' : ''
    },
  }
}

/**
 * BGM のミュート切り替え。操作モードのバッジの真下に置く。
 *
 * 音の設定は「鳴り始めてから初めて気になる」ので、開始画面ではなく
 * ゲーム画面の手の届く場所に出す。
 *
 * 状態はここに持たない。持つと BGM 側と二つの真実ができ、片方だけずれる
 */
export function createMuteButton(
  container: HTMLElement,
  bgm: { readonly muted: boolean; setMuted(muted: boolean): void },
): { dispose(): void } {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'badge mute-button'
  // 読み上げでは名前を固定し、状態は aria-pressed だけで表す
  button.setAttribute('aria-label', 'BGM')
  // 照準の操作として拾われないようにする（このボタンの上でのドラッグは無効）
  button.dataset.noAim = ''

  const render = () => {
    button.textContent = bgm.muted ? '♪ OFF' : '♪ ON'
    button.setAttribute('aria-pressed', String(!bgm.muted))
    button.title = bgm.muted ? 'BGM を鳴らす' : 'BGM を止める'
  }

  const toggle = () => {
    bgm.setMuted(!bgm.muted)
    render()
  }

  render()
  button.addEventListener('click', toggle)
  container.appendChild(button)

  return {
    dispose() {
      button.removeEventListener('click', toggle)
      button.remove()
    },
  }
}

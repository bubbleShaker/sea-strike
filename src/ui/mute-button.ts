/**
 * BGM のミュート切り替え。操作モードのバッジの真下に置く。
 *
 * 音の設定は「鳴り始めてから初めて気になる」ので、開始画面ではなく
 * ゲーム画面の手の届く場所に出す。
 */
export function createMuteButton(
  container: HTMLElement,
  options: { muted: boolean; onChange(muted: boolean): void },
): { dispose(): void } {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'badge mute-button'
  // 照準の操作として拾われないようにする（このボタンの上でのドラッグは無効）
  button.dataset.noAim = ''

  let muted = options.muted

  const render = () => {
    button.textContent = muted ? '♪ OFF' : '♪ ON'
    button.setAttribute('aria-pressed', String(muted))
    button.title = muted ? 'BGM を鳴らす' : 'BGM を止める'
  }

  const toggle = () => {
    muted = !muted
    render()
    options.onChange(muted)
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

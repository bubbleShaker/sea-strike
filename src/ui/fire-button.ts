export interface FireButton {
  /** 今押されているか。ゲームループが毎フレーム読む */
  isFiring(): boolean
  dispose(): void
}

/**
 * 発射ボタン。
 *
 * click ではなく pointerdown / up で見るのは、押しっぱなしの連射を
 * 成立させるため。data-no-aim を付けて、このボタンの上のドラッグが
 * 照準操作として拾われないようにしている。
 */
export function createFireButton(container: HTMLElement): FireButton {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'fire-button'
  button.dataset.noAim = ''
  button.textContent = 'FIRE'
  container.appendChild(button)

  const held = new Set<number>()

  const onDown = (event: PointerEvent) => {
    held.add(event.pointerId)
    // 指が縁からはみ出しても押し続けたままにする
    button.setPointerCapture(event.pointerId)
  }
  const onUp = (event: PointerEvent) => {
    held.delete(event.pointerId)
  }

  button.addEventListener('pointerdown', onDown)
  button.addEventListener('pointerup', onUp)
  button.addEventListener('pointercancel', onUp)
  // 押したままタブが切り替わると up が来ない。撃ちっぱなしで戻るのを防ぐ
  window.addEventListener('blur', () => held.clear())

  return {
    isFiring: () => held.size > 0,
    dispose() {
      button.remove()
    },
  }
}

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
  const release = () => held.clear()

  const onDown = (event: PointerEvent) => {
    held.add(event.pointerId)
    // 指が縁からはみ出しても押し続けたままにする
    button.setPointerCapture(event.pointerId)
  }
  const onUp = (event: PointerEvent) => {
    held.delete(event.pointerId)
  }
  const onVisibilityChange = () => {
    if (document.hidden) release()
  }

  button.addEventListener('pointerdown', onDown)
  button.addEventListener('pointerup', onUp)
  button.addEventListener('pointercancel', onUp)
  // 押したまま画面を離れると up が来ない。撃ちっぱなしで戻るのを防ぐ。
  // iOS ではアプリ切り替えで blur が来ないことがあるので visibilitychange も見る
  window.addEventListener('blur', release)
  document.addEventListener('visibilitychange', onVisibilityChange)
  // ボタンの外で指を離した場合の取りこぼし
  window.addEventListener('pointerup', onUp)

  return {
    isFiring: () => held.size > 0,
    dispose() {
      window.removeEventListener('blur', release)
      window.removeEventListener('pointerup', onUp)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      button.remove()
    },
  }
}

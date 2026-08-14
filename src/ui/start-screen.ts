import { isTiltSupported, needsTiltPermission, requestTiltPermission } from '../input/tilt'

export type ControlChoice = 'tilt' | 'swipe'

/**
 * 開始画面。操作方式をここで選ばせる。
 *
 * 画面を挟むのは演出のためではない。iOS では傾きセンサーの許可が
 * 「ユーザーのタップから直接始まった呼び出し」でしか取れないので、
 * 押してもらうボタンがどうしても要る。
 */
export function showStartScreen(container: HTMLElement): Promise<ControlChoice> {
  const overlay = document.createElement('div')
  overlay.className = 'overlay'
  // 開始画面の上で指を滑らせても照準が動かないようにする
  overlay.dataset.noAim = ''

  const tiltAvailable = isTiltSupported()

  overlay.innerHTML = `
    <div class="panel">
      <h1 class="panel__title">SEA STRIKE</h1>
      <p class="panel__lead">海上を飛び、目の前に現れる敵機を撃ち落とす。</p>
      <div class="panel__actions">
        <button class="button button--primary" data-choice="tilt" ${tiltAvailable ? '' : 'disabled'}>
          端末を傾けて操作
        </button>
        <button class="button" data-choice="swipe">スワイプで操作</button>
      </div>
      <p class="panel__note">${
        tiltAvailable
          ? '傾きが使えない端末では、自動でスワイプに切り替わる。'
          : 'この端末では傾きセンサーが使えないため、スワイプで操作する。'
      }</p>
    </div>
  `

  container.appendChild(overlay)

  return new Promise<ControlChoice>((resolve) => {
    const finish = (choice: ControlChoice) => {
      overlay.remove()
      resolve(choice)
    }

    overlay.addEventListener('click', async (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>('[data-choice]')
      if (!button) return

      if (button.dataset.choice === 'swipe') {
        finish('swipe')
        return
      }

      // 許可ダイアログを待つ間、二度押しで二重に要求しないよう閉じておく
      button.disabled = true
      const granted = needsTiltPermission() ? await requestTiltPermission() : true
      // 許可されなくても始められないと詰む。断られたらそのままスワイプで始める
      finish(granted ? 'tilt' : 'swipe')
    })
  })
}

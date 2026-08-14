import { TARGET_KILLS } from '../game/constants'
import type { World } from '../game/world'

export interface Hud {
  update(world: World): void
}

function formatTime(seconds: number): string {
  const whole = Math.floor(seconds)
  const minutes = Math.floor(whole / 60)
  return `${String(minutes).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`
}

/**
 * 戦況の表示。撃墜数と経過時間。
 *
 * 毎フレーム呼ばれるので、値が変わった時だけ DOM に触る。
 * 数値の書き換えは安く見えて、レイアウトの再計算を毎回引き起こす
 */
export function createHud(container: HTMLElement): Hud {
  const hud = document.createElement('div')
  hud.className = 'hud'
  hud.innerHTML = `
    <div class="hud__item"><span class="hud__label">KILLS</span><span class="hud__value" data-kills>0 / ${TARGET_KILLS}</span></div>
    <div class="hud__item"><span class="hud__label">TIME</span><span class="hud__value" data-time>00:00</span></div>
  `
  container.appendChild(hud)

  const killsElement = hud.querySelector<HTMLElement>('[data-kills]')
  const timeElement = hud.querySelector<HTMLElement>('[data-time]')
  let shownKills = -1
  let shownTime = ''

  return {
    update(world) {
      if (world.kills !== shownKills) {
        shownKills = world.kills
        if (killsElement) killsElement.textContent = `${world.kills} / ${TARGET_KILLS}`
      }
      const time = formatTime(world.elapsed)
      if (time !== shownTime) {
        shownTime = time
        if (timeElement) timeElement.textContent = time
      }
    },
  }
}

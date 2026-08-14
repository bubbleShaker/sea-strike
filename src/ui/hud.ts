import { TARGET_KILLS } from '../game/constants'
import type { World } from '../game/world'

export interface Hud {
  update(world: World): void
  dispose(): void
}

export function formatTime(seconds: number): string {
  const whole = Math.floor(seconds)
  const minutes = Math.floor(whole / 60)
  return `${String(minutes).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`
}

/**
 * 戦況の表示。撃墜数・時間・HP。
 *
 * 毎フレーム呼ばれるので、値が変わった時だけ DOM に触る。
 * 数値の書き換えは安く見えて、レイアウトの再計算を毎回引き起こす。
 *
 * 被弾したときは画面全体を赤く光らせる。数字が減るだけでは、
 * 前を見ている最中に何が起きたのか分からない。
 */
export function createHud(container: HTMLElement): Hud {
  const hud = document.createElement('div')
  hud.className = 'hud'
  hud.innerHTML = `
    <div class="hud__item"><span class="hud__label">KILLS</span><span class="hud__value" data-kills>0 / ${TARGET_KILLS}</span></div>
    <div class="hud__item"><span class="hud__label">TIME</span><span class="hud__value" data-time>00:00</span></div>
    <div class="hud__gauge"><span class="hud__gauge-fill" data-hp></span></div>
  `
  container.appendChild(hud)

  const flash = document.createElement('div')
  flash.className = 'damage-flash'
  container.appendChild(flash)

  const killsElement = hud.querySelector<HTMLElement>('[data-kills]')
  const timeElement = hud.querySelector<HTMLElement>('[data-time]')
  const hpElement = hud.querySelector<HTMLElement>('[data-hp]')
  let shownKills = -1
  let shownTime = ''
  let shownHp = -1

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

      if (world.hp !== shownHp) {
        shownHp = world.hp
        if (hpElement) {
          hpElement.style.width = `${(world.hp / world.maxHp) * 100}%`
          hpElement.classList.toggle('is-critical', world.hp <= world.maxHp * 0.3)
        }
      }

      if (world.events.some((event) => event.type === 'damage')) {
        // アニメーションを一度止めてから掛け直す。連続で撃たれたときに
        // 二度目が無視されるのを防ぐ
        flash.classList.remove('is-hit')
        void flash.offsetWidth
        flash.classList.add('is-hit')
      }
    },
    dispose() {
      hud.remove()
      flash.remove()
    },
  }
}

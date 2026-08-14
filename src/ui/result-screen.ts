import { TARGET_KILLS } from '../game/constants'
import { accuracyRatio, calculateScore } from '../game/score'
import type { World } from '../game/world'
import { formatTime } from './hud'

/**
 * 決着の画面。
 *
 * 合計だけでなく内訳を出す。「速さ」「命中率」「被弾」のどれが効いたのかが
 * 見えないと、次にどう変えればいいのかが分からない。
 */
export function showResultScreen(container: HTMLElement, world: World): Promise<void> {
  const won = world.phase === 'won'
  const score = calculateScore({
    kills: world.kills,
    elapsed: world.elapsed,
    hp: world.hp,
    maxHp: world.maxHp,
    shots: world.shots,
    hits: world.hits,
    won,
  })

  // 貫通弾は 1 発で複数機に当たる。スコアと同じ計算を使わないと、
  // 「命中率 400%」と「命中率の点は満点」が同じ画面に並ぶ
  const accuracy = Math.round(accuracyRatio(world.shots, world.hits) * 100)

  const rows: Array<[string, string]> = [
    ['撃墜', `${world.kills} / ${TARGET_KILLS}`],
    ['時間', formatTime(world.elapsed)],
    ['命中率', `${accuracy}%`],
    ['残 HP', `${world.hp} / ${world.maxHp}`],
  ]

  const points: Array<[string, number]> = [
    ['撃墜', score.kills],
    ['速さ', score.time],
    ['命中率', score.accuracy],
    ['被弾', score.damage],
    ['無傷', score.perfect],
  ]

  const overlay = document.createElement('div')
  overlay.className = 'overlay'
  overlay.dataset.noAim = ''
  overlay.innerHTML = `
    <div class="panel">
      <h1 class="panel__title ${won ? 'is-win' : 'is-lose'}">${won ? 'MISSION COMPLETE' : 'SHOT DOWN'}</h1>
      <p class="panel__lead">${
        won ? '全機撃墜。海はひとまず静かになった。' : '被弾により帰投不能。海に落ちた。'
      }</p>
      <dl class="stats">
        ${rows.map(([label, value]) => `<div class="stats__row"><dt>${label}</dt><dd>${value}</dd></div>`).join('')}
      </dl>
      <div class="score">
        <span class="score__label">SCORE</span>
        <span class="score__value">${score.total.toLocaleString()}</span>
      </div>
      <dl class="stats stats--points">
        ${points
          .filter(([, value]) => value !== 0)
          .map(
            ([label, value]) =>
              `<div class="stats__row"><dt>${label}</dt><dd>${value > 0 ? '+' : ''}${value}</dd></div>`,
          )
          .join('')}
      </dl>
      <div class="panel__actions">
        <button class="button button--primary" data-retry>もう一度飛ぶ</button>
      </div>
    </div>
  `
  container.appendChild(overlay)

  return new Promise((resolve) => {
    overlay.addEventListener('click', (event) => {
      if (!(event.target as Element).closest('[data-retry]')) return
      overlay.remove()
      resolve()
    })
  })
}

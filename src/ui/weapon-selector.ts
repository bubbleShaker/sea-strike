import { WEAPONS, WEAPON_ORDER, type WeaponId } from '../game/weapons'
import type { World } from '../game/world'
import { WEAPON_COLOR } from '../theme'

/** ボタンに出す短い名前。48px 角に収まる長さで、5 種を見分けられるところまで削る */
const SHORT_NAME: Record<WeaponId, string> = {
  vulcan: 'VUL',
  cannon: 'CAN',
  spread: 'SPR',
  homing: 'HOM',
  laser: 'LAS',
}

export interface WeaponSelector {
  /** 今選ばれている武器。ゲームループが毎フレーム読む */
  current(): WeaponId
  /** 残弾の表示を世界に合わせる */
  update(world: World): void
  dispose(): void
}

/**
 * 弾の持ち替え。
 *
 * 撃ちながら押せる位置（画面下部）に並べる。持ち替えは戦闘中の判断なので、
 * メニューを開かせるとその瞬間に撃たれる。
 * 撃ち切った武器は選べなくする。持ち替えた先が空だと気づくのは手遅れなことが多い。
 */
export function createWeaponSelector(container: HTMLElement): WeaponSelector {
  const root = document.createElement('div')
  root.className = 'weapons'
  // 照準の操作として拾われないようにする
  root.dataset.noAim = ''

  const buttons = new Map<WeaponId, { button: HTMLButtonElement; ammo: HTMLElement }>()

  for (const id of WEAPON_ORDER) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'weapons__item'
    button.dataset.weapon = id
    button.style.setProperty('--weapon-color', WEAPON_COLOR[id])
    button.title = `${WEAPONS[id].name} — ${WEAPONS[id].note}`

    const name = document.createElement('span')
    name.className = 'weapons__name'
    name.textContent = SHORT_NAME[id]

    const ammo = document.createElement('span')
    ammo.className = 'weapons__ammo'
    ammo.textContent = WEAPONS[id].ammo === null ? '∞' : String(WEAPONS[id].ammo)

    button.append(name, ammo)
    root.appendChild(button)
    buttons.set(id, { button, ammo })
  }

  let selected: WeaponId = 'vulcan'
  const applySelection = () => {
    for (const [id, { button }] of buttons) {
      button.classList.toggle('is-selected', id === selected)
    }
  }
  applySelection()

  root.addEventListener('click', (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>('[data-weapon]')
    if (!button || button.disabled) return
    selected = button.dataset.weapon as WeaponId
    applySelection()
  })

  container.appendChild(root)

  const shownAmmo = new Map<WeaponId, number | null>()

  return {
    current: () => selected,
    update(world) {
      for (const [id, { button, ammo }] of buttons) {
        const remaining = world.ammo[id]
        // 毎フレーム呼ばれる。変化した時だけ DOM に触る
        if (shownAmmo.get(id) === remaining) continue
        shownAmmo.set(id, remaining)

        ammo.textContent = remaining === null ? '∞' : String(remaining)
        const empty = remaining !== null && remaining <= 0
        button.disabled = empty
        button.classList.toggle('is-empty', empty)

        // 撃ち切ったものを選んだままだと撃てない。無限のバルカンへ戻す
        if (empty && selected === id) {
          selected = 'vulcan'
          applySelection()
        }
      }
    },
    dispose() {
      root.remove()
    },
  }
}

/**
 * 照準。画面中央に固定する。
 *
 * 弾は常に機首の向き（＝画面中央）へ飛ぶので、狙いは「照準を動かす」のではなく
 * 「機体ごと向きを変える」操作になる。中央に据えることでそれを示す。
 */
export function createCrosshair(container: HTMLElement): HTMLElement {
  const crosshair = document.createElement('div')
  crosshair.className = 'crosshair'
  crosshair.innerHTML = `
    <span class="crosshair__ring"></span>
    <span class="crosshair__dot"></span>
  `
  container.appendChild(crosshair)
  return crosshair
}

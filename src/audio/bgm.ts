// `?url` を付けると Vite はファイルを配信物にコピーし、その URL を文字列として返す。
// GitHub Pages のサブパス（/sea-strike/）や本番のハッシュ付きファイル名を自分で組み立てずに済む
import bgmUrl from '../assets/musmus-starry-eyed.mp3?url'

/** ゲーム中ずっと鳴り続けるので控えめに置く */
const VOLUME = 0.32

const MUTED_KEY = 'sea-strike:bgm-muted'

export interface Bgm {
  /** ミュート中か。ボタンの初期表示に使う */
  readonly muted: boolean
  /**
   * 再生を始める。**ユーザーの操作から始まった処理の中で**呼ぶこと。
   * ブラウザは操作を起点にしない音の再生を拒む（モバイルでは特に厳しい）
   */
  start(): void
  setMuted(muted: boolean): void
  dispose(): void
}

/** localStorage はプライベートブラウジングなどで例外を投げる。音の設定ごときで止めない */
function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTED_KEY) === '1'
  } catch {
    return false
  }
}

function writeMuted(muted: boolean): void {
  try {
    localStorage.setItem(MUTED_KEY, muted ? '1' : '0')
  } catch {
    // 保存できなくても、このセッションの間は効いている
  }
}

/**
 * BGM。曲は Starry Eyed / YM-2608 Chiptune（音楽素材 MusMus, 作曲: watson）。
 *
 * ゲームのドメイン層は音を知らない。ここは「鳴っているべきか」という一つの条件
 * （開始済み・ミュートでない・タブが見えている）を音の再生に写すだけの層にしてある。
 */
export function createBgm(): Bgm {
  const audio = new Audio(bgmUrl)
  audio.loop = true
  // 開始画面を見ている間に読み込ませる。ボタンを押した瞬間から鳴ってほしい
  audio.preload = 'auto'
  audio.volume = VOLUME

  let muted = readMuted()
  let started = false

  /** 「鳴っているべきか」を計算して、実際の再生をそこへ寄せる */
  const sync = () => {
    if (started && !muted && !document.hidden) {
      // 再生を拒まれることがある（操作の外から呼ばれた等）。
      // 無音でも遊べるので、握りつぶして進める
      audio.play().catch(() => {})
    } else {
      // stop ではなく pause。曲の位置が残るので、戻したときに続きから鳴る
      audio.pause()
    }
  }

  document.addEventListener('visibilitychange', sync)

  return {
    get muted() {
      return muted
    },
    start() {
      started = true
      sync()
    },
    setMuted(next) {
      muted = next
      writeMuted(next)
      sync()
    },
    dispose() {
      document.removeEventListener('visibilitychange', sync)
      audio.pause()
      // 読み込み中の通信を打ち切る。開発中のホットリロードで多重に走らせない
      audio.removeAttribute('src')
      audio.load()
    },
  }
}

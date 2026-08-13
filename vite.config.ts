import { defineConfig } from 'vite'

// GitHub Pages では https://bubbleshaker.github.io/sea-strike/ の下に置かれる。
// asset の URL をそのサブパス起点にしないと、公開後だけ真っ白になる
export default defineConfig({
  base: '/sea-strike/',
})

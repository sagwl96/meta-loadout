// Records the scenes of pane.html into the README's images.
//
//   npm i puppeteer-core          (anywhere; run this script from that folder)
//   node <repo>/docs/mockup/record.mjs [scene ...]
//
// Needs Chrome (CHROME, default /usr/bin/google-chrome) and ffmpeg on PATH.
// Writes assets/desktop-pane.png and assets/<scene>.gif in the repo.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const puppeteer = createRequire(join(process.cwd(), 'noop.js'))('puppeteer-core')
const here = dirname(fileURLToPath(import.meta.url))
const assets = join(here, '..', '..', 'assets')
const FPS = 12
const SCENES = process.argv.slice(2).length > 0 ? process.argv.slice(2) : ['hero', 'toggle', 'profiles', 'lock', 'sync']

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME ?? '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--font-render-hinting=none'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1200, height: 800, deviceScaleFactor: 1 })
await page.goto(pathToFileURL(join(here, 'pane.html')).href)

for (const scene of SCENES) {
  if (scene === 'hero') {
    await page.setViewport({ width: 780, height: 800, deviceScaleFactor: 2 })
    await page.evaluate(() => window.render('hero', 99999))
    await (await page.$('#app')).screenshot({ path: join(assets, 'desktop-pane.png') })
    await page.setViewport({ width: 1200, height: 800, deviceScaleFactor: 1 })
    console.log('assets/desktop-pane.png')
    continue
  }
  const frames = mkdtempSync(join(tmpdir(), `ml-${scene}-`))
  const length = await page.evaluate(name => window.render(name, 0), scene)
  const count = Math.ceil(((length + 1500) / 1000) * FPS) // hold the last frame 1.5 s
  for (let i = 0; i < count; i++) {
    await page.evaluate((name, t) => window.render(name, t), scene, (i * 1000) / FPS)
    await page.screenshot({ path: join(frames, `${String(i).padStart(4, '0')}.png`) })
  }
  const out = join(assets, `${scene}.gif`)
  execFileSync('ffmpeg', [
    '-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(frames, '%04d.png'),
    '-vf', 'scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle',
    out,
  ])
  rmSync(frames, { recursive: true })
  console.log(`assets/${scene}.gif (${count} frames)`)
}
await browser.close()

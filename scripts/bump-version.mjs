// Bumps src/version.json by 0.1 on every push to master (run from the deploy
// workflow before the build step, so the built app reflects the new number).
import fs from 'node:fs'

const path = new URL('../src/version.json', import.meta.url)
const data = JSON.parse(fs.readFileSync(path, 'utf8'))

const tenths = Math.round(parseFloat(data.version) * 10) + 1
const next = (tenths / 10).toFixed(1)

fs.writeFileSync(path, JSON.stringify({ version: next }, null, 2) + '\n')
console.log(`Bumped version ${data.version} -> ${next}`)

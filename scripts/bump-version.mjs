// Bumps the minor number in src/version.json by 1 on every push to master
// (run from the deploy workflow before the build step, so the built app
// reflects the new number).
//
// Version is "major.minor" as two separate integers, NOT a decimal - treating
// it as a float (e.g. via parseFloat) silently rolls 0.9 -> 1.0 instead of
// 0.10, since 0.10 and 0.1 are the same float. Bump minor as a plain integer
// indefinitely (0.9 -> 0.10 -> 0.11 -> ...); only bump major by hand when you
// actually want to.
import fs from 'node:fs'

const path = new URL('../src/version.json', import.meta.url)
const data = JSON.parse(fs.readFileSync(path, 'utf8'))

const [major, minor] = data.version.split('.').map(Number)
const next = `${major}.${minor + 1}`

fs.writeFileSync(path, JSON.stringify({ version: next }, null, 2) + '\n')
console.log(`Bumped version ${data.version} -> ${next}`)

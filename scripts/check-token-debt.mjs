#!/usr/bin/env node
/**
 * The token debt ratchet.
 *
 * stylelint reports every declaration that bypasses the token layer; this
 * asserts how many there are. The rule itself is a warning because 355 build
 * failures on the day it was added would have meant switching it off.
 *
 * Equality rather than a ceiling, in both directions. Adding one fails. And
 * removing one *also* fails, until the recorded number comes down with it,
 * which is the half that stops the figure going stale while every check stays
 * green. drift learned that the hard way: its type-tier debt moved from 94 to
 * 89 with a list of names that could not tell.
 *
 *   node scripts/check-token-debt.mjs           check
 *   node scripts/check-token-debt.mjs --write   record
 *
 * What the number means: declarations that bypass the token layer. It was 355
 * before core adopted haus's full token cascade, and is recorded in
 * scripts/token-debt.json. The ones left have no haus token to land on; DESIGN.md
 * lists them. Zero is not the target.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const RECORD = join(ROOT, 'scripts', 'token-debt.json')
const RULE = 'scale-unlimited/declaration-strict-value'

/** Written to a file rather than parsed off a pipe: stylelint streams its JSON
 *  to stdout, and capturing that through npx turned out to leak the whole
 *  report into the terminal on the first run of this script. */
function report() {
  const tmp = join(tmpdir(), `core-stylelint-${process.pid}.json`)
  try {
    execFileSync('npx', ['stylelint', '**/*.css', '--formatter', 'json', '--output-file', tmp],
      { cwd: ROOT, stdio: 'ignore' })
  } catch {
    /* stylelint exits non-zero whenever it reports anything, which is expected
       here: the strict-value rule is a warning and the others are errors, and
       either way the file is written. */
  }
  const text = readFileSync(tmp, 'utf8')
  rmSync(tmp, { force: true })
  return text
}

const byFile = {}
for (const file of JSON.parse(report())) {
  const n = file.warnings.filter((w) => w.rule === RULE).length
  if (n > 0) byFile[file.source.replace(ROOT + '/', '')] = n
}
const total = Object.values(byFile).reduce((a, b) => a + b, 0)

if (process.argv.includes('--write')) {
  const sorted = Object.fromEntries(Object.entries(byFile).sort(([a], [b]) => a.localeCompare(b)))
  writeFileSync(RECORD, JSON.stringify({ total, byFile: sorted }, null, 2) + '\n')
  console.log(`token debt recorded: ${total} across ${Object.keys(byFile).length} files`)
  process.exit(0)
}

if (!existsSync(RECORD)) {
  console.error('No scripts/token-debt.json. Run with --write.')
  process.exit(1)
}

const recorded = JSON.parse(readFileSync(RECORD, 'utf8'))
if (total === recorded.total) {
  console.log(`token debt: ${total}, unchanged`)
  process.exit(0)
}

const worse = total > recorded.total
console.error(
  worse
    ? `Token debt went up: ${recorded.total} to ${total}.\n\n` +
      'A declaration is choosing a size, a weight or a colour by hand. Use a token,\n' +
      'or if core genuinely has no token for it, say so here and record the new number.'
    : `Token debt came down: ${recorded.total} to ${total}. Good.\n\n` +
      'Record it: node scripts/check-token-debt.mjs --write',
)

const changed = Object.keys({ ...recorded.byFile, ...byFile })
  .map((f) => [f, (byFile[f] ?? 0) - (recorded.byFile[f] ?? 0)])
  .filter(([, d]) => d !== 0)
  .sort((a, b) => b[1] - a[1])
console.error('\n' + changed.map(([f, d]) => `  ${d > 0 ? '+' : ''}${d}  ${f}`).join('\n'))
process.exit(1)

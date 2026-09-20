#!/usr/bin/env node
/**
 * Every endpoint this repo names must exist in the LIVE OpenAPI.
 *
 * An example repo that tells an agent to call a route which no longer exists
 * is worse than no example repo: the agent trusts it, the call 404s, and the
 * person watching concludes the product is broken. So this fetches the live
 * schema and fails on anything here that it cannot find.
 *
 *   node scripts/check-live-api.mjs
 */
import { readdir, readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';

const SCHEMA = process.env.VENDLISTS_API
  ? `${process.env.VENDLISTS_API}/agent/openapi.json`
  : 'https://api.vendlists.com/agent/openapi.json';

const SCANNED = ['.md', '.mjs', '.py', '.sh'];
/** `/listings/{id}/generate`, `$API/agent/me`, `/ebay/publish/$LISTING_ID`… */
const PATH_PATTERN = /(?<![\w.])\/(?:listings|ebay|agent|subscriptions|insights|iap|billing|users|notifications)(?:\/[\w{}$.:-]+)*/g;

/** A path as the schema writes it: every id becomes `{param}`. */
function normalize(found) {
  return found
    .replace(/\/\$\{?[A-Za-z_][\w.]*\}?/g, '/{id}')
    .replace(/\/\{[^}]+\}/g, '/{id}')
    .replace(/\/$/, '');
}

async function* files(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.git')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* files(full);
    else if (SCANNED.includes(extname(entry.name))) yield full;
  }
}

const res = await fetch(SCHEMA);
if (!res.ok) throw new Error(`${SCHEMA} → ${res.status}`);
const schema = await res.json();
const known = new Set(Object.keys(schema.paths).map(normalize));

const missing = [];
const seen = new Set();
for await (const file of files(process.cwd())) {
  const text = await readFile(file, 'utf8');
  for (const match of text.match(PATH_PATTERN) ?? []) {
    const path = normalize(match);
    // A prefix of a real path (`/listings` inside `/listings/upload-url`) is
    // itself a real path here; anything else is invented.
    if (known.has(path) || seen.has(`${file}:${path}`)) continue;
    seen.add(`${file}:${path}`);
    missing.push(`${file}: ${match}  (read as ${path})`);
  }
}

console.log(`checked against ${SCHEMA} (${known.size} paths, version ${schema.info.version})`);
if (missing.length > 0) {
  console.error(`\nThese paths are not in the live API:\n  ${missing.join('\n  ')}\n`);
  process.exit(1);
}
console.log('every endpoint this repo names exists.');

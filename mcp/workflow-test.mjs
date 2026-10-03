import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// Real plugin launcher and stdio protocol; only a local HTTP fixture receives
// requests. No real keys, seller writes, eBay calls or backend test processes.
const key = 'vl_agent_local_fixture_not_a_credential';
const root = fileURLToPath(new URL('../', import.meta.url)).replace(/[\\/]$/, '');
const config = JSON.parse(await readFile(new URL('../.mcp.json', import.meta.url))).mcpServers.vendlists;
const base = { listingId: 'draft-1', status: 'pending_review', updatedAt: 'revision-1',
  title: 'Camera', price: 1999, quantity: 1, marketplaceId: 'EBAY_GB', ebayAccountId: 'selected-shop',
  itemSpecifics: { ISBN: '9781234567890', Brand: 'Seller supplied' }, internalLedger: 'private' };
const listingPath = `/listings/${base.listingId}`;
let listing = structuredClone(base);
let page = { items: [base], nextToken: 'opaque+cursor/=' };
let conflict = false;
const requests = [];
const schema = { info: { version: 'fixture' }, paths: Object.fromEntries([
  ['/agent/me', ['get']], ['/listings', ['get', 'post']], ['/listings/upload-url', ['post']],
  ['/listings/{listingId}', ['get', 'put']], ['/listings/{listingId}/generate', ['post']],
  ['/listings/{listingId}/channels/fees', ['post']], ['/ebay/publish/{listingId}', ['post']],
  ['/ebay/status', ['get']], ['/ebay/seller-defaults', ['get']],
].map(([path, methods]) => [path, Object.fromEntries(methods.map((method) => [method, {}]))])) };
const fixture = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://fixture');
  let raw = '';
  for await (const chunk of req) raw += chunk;
  const body = raw ? JSON.parse(raw) : undefined;
  const sent = { method: req.method, path: url.pathname, query: Object.fromEntries(url.searchParams), body, headers: req.headers };
  if (url.pathname === '/agent/openapi.json') {
    res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(schema)); return;
  }
  requests.push(sent);
  assert.equal(req.headers.authorization, `Bearer ${key}`);
  const reply = (value, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(value)); };
  if (url.pathname === '/listings' && req.method === 'GET') return reply(page);
  if (url.pathname === listingPath && req.method === 'GET') return reply(listing);
  if (url.pathname === listingPath && req.method === 'PUT') {
    if (conflict) return reply({ error: 'This listing changed. Refresh and try again.' }, 409);
    listing = { ...listing, ...body, updatedAt: 'revision-2' }; delete listing.expectedUpdatedAt;
    return reply(listing);
  }
  return reply({ error: 'Unexpected fixture request' }, 400);
});
await new Promise((resolve) => fixture.listen(0, '127.0.0.1', resolve));
const api = `http://127.0.0.1:${fixture.address().port}`;
const replace = (value) => value.replaceAll('${CLAUDE_PLUGIN_ROOT}', root).replaceAll('${user_config.api_key}', key);
const transport = new StdioClientTransport({ command: config.command, args: config.args.map(replace), cwd: tmpdir(),
  env: { ...process.env, ...Object.fromEntries(Object.entries(config.env).map(([k, v]) => [k, replace(v)])),
    VENDLISTS_API: api, VENDLISTS_API_KEY: key, VENDLISTS_KEY: key } });
const client = new Client({ name: 'workflow-fixture', version: '1.0.0' });
const text = (result) => result.content.find((entry) => entry.type === 'text')?.text ?? '';
const call = (name, args) => client.callTool({ name, arguments: args });
const writeCount = () => requests.filter((r) => r.method !== 'GET').length;
const reset = (overrides = {}) => { listing = { ...structuredClone(base), ...overrides }; conflict = false; };
try {
  await client.connect(transport);
  const found = JSON.parse(text(await call('vendlists_find_listings', { query: 'Camera & lens', status: 'pending_review', limit: 5 })));
  assert.equal(found.hasMore, true); assert.equal(found.nextToken, page.nextToken);
  assert.equal(found.items[0].internalLedger, undefined);
  assert.deepEqual(requests.at(-1).query, { limit: '5', skip_counts: 'true', q: 'Camera & lens', status: 'pending_review' });
  page = { items: [], nextToken: 'second-page' };
  const empty = JSON.parse(text(await call('vendlists_find_listings', { query: 'Camera & lens', status: 'pending_review', nextToken: 'opaque+cursor/=' })));
  assert.equal(empty.hasMore, true); assert.equal(requests.at(-1).query.nextToken, 'opaque+cursor/=');
  const beforeInvalidSearch = requests.length;
  assert.equal((await call('vendlists_find_listings', { limit: 1000 })).isError, true);
  assert.equal(requests.length, beforeInvalidSearch);
  console.log('PASS: bounded search, encoded queries, opaque continuation and honest empty-page output');

  const edited = await call('vendlists_update_draft', { listingId: 'draft-1', expectedUpdatedAt: 'revision-1', changes: { title: 'Verified camera', itemSpecifics: { Colour: 'Black' } } });
  assert.ok(!edited.isError, text(edited));
  const sent = requests.findLast((r) => r.method === 'PUT');
  assert.deepEqual(sent.body, { title: 'Verified camera', expectedUpdatedAt: 'revision-1', itemSpecifics: { ISBN: base.itemSpecifics.ISBN, Brand: base.itemSpecifics.Brand, Colour: 'Black' } });
  assert.equal(JSON.parse(text(edited)).listing.updatedAt, 'revision-2');
  assert.equal(JSON.parse(text(edited)).listing.internalLedger, undefined);
  reset();
  await call('vendlists_update_draft', { listingId: 'draft-1', expectedUpdatedAt: 'revision-1', changes: { price: 2450 } });
  assert.deepEqual(requests.findLast((r) => r.method === 'PUT').body, { price: 2450, expectedUpdatedAt: 'revision-1' });
  console.log('PASS: narrow guarded write, exact cents, specifics and ISBN preservation');

  for (const overrides of [
    { status: 'published' }, { status: 'processing' }, { status: 'ended' }, { status: 'sold' },
    { ebayListingId: 'live-item', status: 'failed' }, { origin: 'ebay_import' },
    { ebaySelling: { format: 'AUCTION' } }, { ebayListingFormat: 'AUCTION' },
    { ebayAuctionObservation: {} }, { ebayListingType: 'Chinese' }, { ebaySelling: { format: 'UNKNOWN' } },
    { updatedAt: 'someone-else-edited' }, { updatedAt: undefined },
  ]) {
    reset(overrides); const before = writeCount();
    const refused = await call('vendlists_update_draft', { listingId: 'draft-1', expectedUpdatedAt: 'revision-1', changes: { title: 'Edit' } });
    assert.equal(refused.isError, true, JSON.stringify(overrides)); assert.equal(writeCount(), before);
  }
  for (const specifics of [null, [], { ISBN: ['9781234567890'] }]) {
    reset({ itemSpecifics: specifics }); const before = writeCount();
    assert.equal((await call('vendlists_update_draft', { listingId: 'draft-1', expectedUpdatedAt: 'revision-1', changes: { itemSpecifics: { Colour: 'Black' } } })).isError, true);
    assert.equal(writeCount(), before);
  }
  reset(); conflict = true; const beforeConflict = writeCount();
  const raced = await call('vendlists_update_draft', { listingId: 'draft-1', expectedUpdatedAt: 'revision-1', changes: { title: 'Edit' } });
  assert.equal(raced.isError, true); assert.match(text(raced), /409/); assert.equal(writeCount(), beforeConflict + 1);
  console.log('PASS: stale/live/imported/auction/unknown-format refusals and backend race without retry');

  const beforeInvalidEdit = requests.length;
  for (const changes of [{}, { price: 1.5 }, { price: -1 }, { price: null }, { quantity: 0 },
    { itemSpecifics: { Size: ['M'] } }, { itemSpecifics: { Size: null } }, { itemSpecifics: { constructor: 'bad' } },
    { bestOffer: { enabled: true } }, { marketplaceId: 'EBAY_US' }, { condition: 'NEW' }, { title: 'x'.repeat(81) }]) {
    assert.equal((await call('vendlists_update_draft', { listingId: 'draft-1', expectedUpdatedAt: 'revision-1', changes })).isError, true, JSON.stringify(changes));
  }
  assert.equal((await call('vendlists_update_draft', { listingId: 'draft-1', changes: { title: 'Edit' } })).isError, true);
  assert.equal(requests.length, beforeInvalidEdit);
  console.log('PASS: nested invalid values, nulls, unknown controls and omitted revision rejected before I/O');
} finally {
  await client.close(); fixture.closeAllConnections(); await new Promise((resolve) => fixture.close(resolve));
}

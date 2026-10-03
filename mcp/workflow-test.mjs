import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
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
let editMode = 'ok';
let createMode = 'ok';
let setupMode = 'ok';
let feeMode = 'ok';
let setupReads = 0;
const created = new Map();
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
    if (editMode === 'malformed') { res.writeHead(200); res.end('invalid-json'); return; }
    return reply(listing);
  }
  if (url.pathname === '/listings' && req.method === 'POST') {
    const retryKey = req.headers['idempotency-key'];
    assert.match(retryKey, /^[\x21-\x7e]{1,64}$/);
    const old = created.get(retryKey);
    if (old && old.raw !== raw) return reply({ error: 'Different request for this key', code: 'IDEMPOTENCY_KEY_REUSED' }, 400);
    const value = old?.value ?? { ...base, listingId: 'created-' + created.size, status: 'draft' };
    created.set(retryKey, { raw, value });
    if (createMode === 'lost') { req.socket.destroy(); return; }
    if (createMode === 'malformed') { res.writeHead(200); res.end('invalid-json'); return; }
    if (createMode === 'limited') { res.setHeader('Retry-After', '120'); return reply({ error: 'Budget spent', code: 'BUDGET' }, 429); }
    if (createMode === 'key-echo') return reply({ error: 'Reject ' + key, code: 'FORBIDDEN' }, 403);
    return reply(value, old ? 200 : 201);
  }
  if (url.pathname === '/ebay/status') {
    setupReads += 1;
    if (setupMode === 'limited') { res.setHeader('Retry-After', '120'); return reply({ error: 'Busy' }, 429); }
    if (setupMode === 'changed') listing = { ...listing, marketplaceId: 'EBAY_US', updatedAt: 'changed' };
    return reply({ connected: true, ebayAccountId: setupMode === 'wrong-account' ? 'other-shop' : 'selected-shop',
      status: 'active', publishReadiness: { sellerRegistration: { state: 'blocked', checkedAt: 'previous-check' } },
      accessToken: 'must-not-be-returned', ebayFeeNoticeSites: [] });
  }
  if (url.pathname === '/ebay/seller-defaults') return reply({ ebayAccountId: 'selected-shop', authoritative: true,
    isConfigured: false, missing: ['postage'], sellerDefaults: { marketplaceId: 'EBAY_GB', postalCode: 'private' } });
  if (url.pathname === `${listingPath}/channels/fees`) {
    assert.deepEqual(body, { action: 'confirm', marketplaceId: 'EBAY_GB' });
    return reply({ feeNotice: { confirmedSites: feeMode === 'ok' ? ['EBAY_GB'] : [] } });
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
const reset = (overrides = {}) => { listing = { ...structuredClone(base), ...overrides }; conflict = false; editMode = 'ok'; };
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
    { ebaySelling: null }, { ebaySelling: {} }, { ebaySelling: [] }, { ebayListingFormat: null },
    { updatedAt: 'someone-else-edited' }, { updatedAt: undefined },
  ]) {
    reset(overrides); const before = writeCount();
    const refused = await call('vendlists_update_draft', { listingId: 'draft-1', expectedUpdatedAt: 'revision-1', changes: { title: 'Edit' } });
    assert.equal(refused.isError, true, JSON.stringify(overrides)); assert.equal(writeCount(), before);
  }
  for (const specifics of [null, [], { ISBN: ['9781234567890'] }, { ['x'.repeat(66)]: 'valid' },
    { Brand: 'x'.repeat(501) }, { Brand: ' saved with whitespace ' }, { Brand: 'a\u0000b' }, { ' Size ': 'M' }]) {
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
    { itemSpecifics: { ' Size ': 'M' } }, { itemSpecifics: { Size: 'a\u0000b' } },
    { bestOffer: { enabled: true } }, { marketplaceId: 'EBAY_US' }, { condition: 'NEW' }, { title: 'x'.repeat(81) }]) {
    assert.equal((await call('vendlists_update_draft', { listingId: 'draft-1', expectedUpdatedAt: 'revision-1', changes })).isError, true, JSON.stringify(changes));
  }
  assert.equal((await call('vendlists_update_draft', { listingId: 'draft-1', changes: { title: 'Edit' } })).isError, true);
  assert.equal(requests.length, beforeInvalidEdit);
  console.log('PASS: nested invalid values, nulls, unknown controls and omitted revision rejected before I/O');

  reset({ publishBlockers: [{ mode: 'SELECTION_ONLY', aspectName: 'Size', allowedValues: ['M', 'L'], allowedValuesTruncated: true }],
    publishRemedies: [{ code: 'SETUP_NEEDED', message: 'Finish seller setup' }], lastPublishError: 'Setup incomplete' });
  const detail = JSON.parse(text(await call('vendlists_get_listing', { listingId: 'draft-1' })));
  assert.equal(detail.publishRemedies[0].code, 'SETUP_NEEDED'); assert.equal(detail.lastPublishError, 'Setup incomplete');
  const beforeBadSelection = writeCount();
  assert.equal((await call('vendlists_update_draft', { listingId: 'draft-1', expectedUpdatedAt: 'revision-1', changes: { itemSpecifics: { Size: 'Invented size' } } })).isError, true);
  assert.equal(writeCount(), beforeBadSelection);
  assert.ok(!(await call('vendlists_update_draft', { listingId: 'draft-1', expectedUpdatedAt: 'revision-1', changes: { itemSpecifics: { Size: 'M' } } })).isError);
  reset(); editMode = 'malformed';
  const uncertainEdit = await call('vendlists_update_draft', { listingId: 'draft-1', expectedUpdatedAt: 'revision-1', changes: { title: 'Saved despite lost result' } });
  assert.equal(uncertainEdit.isError, true); assert.match(text(uncertainEdit), /not confirmed/);
  assert.equal(JSON.parse(text(await call('vendlists_get_listing', { listingId: 'draft-1' }))).title, 'Saved despite lost result');
  for (const overrides of [{ ebaySelling: { format: 'AUCTION' } }, { ebayListingFormat: 'AUCTION' },
    { ebayAuctionObservation: {} }, { ebaySelling: null }, { ebaySelling: { format: 'UNKNOWN' } }, { ebayListingType: 'Chinese' }]) {
    reset(overrides); const before = writeCount();
    assert.equal((await call('vendlists_generate', { listingId: 'draft-1' })).isError, true);
    assert.equal((await call('vendlists_publish', { listingId: 'draft-1', confirmedByPerson: true })).isError, true);
    assert.equal(writeCount(), before);
  }
  console.log('PASS: sanitizer-preserving specifics, accepted selection values, unconfirmed edit recovery and auction operation guards');

  const create = (args = {}) => call('vendlists_create_listing', { notes: 'Camera, scratched case', marketplaceId: 'EBAY_GB', ...args });
  createMode = 'lost';
  const lost = await create();
  assert.equal(lost.isError, true); const recovery = JSON.parse(text(lost));
  assert.match(recovery.idempotencyKey, /^[0-9a-f-]{36}$/);
  assert.equal(requests.at(-1).headers['idempotency-key'], recovery.idempotencyKey);
  const attempts = requests.filter((r) => r.path === '/listings' && r.method === 'POST').length;
  createMode = 'ok';
  const replayed = JSON.parse(text(await create({ idempotencyKey: recovery.idempotencyKey })));
  assert.equal(replayed.listingId, created.get(recovery.idempotencyKey).value.listingId);
  assert.equal(created.size, 1);
  assert.equal(requests.filter((r) => r.path === '/listings' && r.method === 'POST').length, attempts + 1);
  const conflictCreate = await create({ idempotencyKey: recovery.idempotencyKey, notes: 'Different item' });
  assert.equal(conflictCreate.isError, true); assert.equal(JSON.parse(text(conflictCreate)).code, 'IDEMPOTENCY_KEY_REUSED');
  for (const mode of ['malformed', 'limited', 'key-echo']) {
    createMode = mode; const result = await create(); const data = JSON.parse(text(result));
    assert.equal(result.isError, true); assert.ok(data.idempotencyKey); assert.ok(!text(result).includes(key));
    if (mode === 'limited') { assert.equal(data.status, 429); assert.equal(data.retryAfter, '120'); }
  }
  const beforeBadKey = requests.length;
  for (const idempotencyKey of ['', 'has space', 'x'.repeat(65), '\n']) assert.equal((await create({ idempotencyKey })).isError, true);
  assert.equal(requests.length, beforeBadKey);
  console.log('PASS: lost-response replay, malformed-response recovery, conflicting keys, 429 and credential redaction');

  reset(); const beforeSetup = requests.length;
  const setup = JSON.parse(text(await call('vendlists_check_setup', { listingId: 'draft-1' })));
  assert.equal(setup.accountScope, 'selected-shop'); assert.match(setup.evidence, /not a fresh eBay check/);
  assert.equal(setup.connection.publishReadiness.sellerRegistration.checkedAt, 'previous-check');
  assert.ok(!text({ content: [{ type: 'text', text: JSON.stringify(setup) }] }).includes('must-not-be-returned'));
  assert.equal(setup.configuration.postalCode, undefined);
  assert.equal(requests.length, beforeSetup + 4);
  for (const r of requests.slice(beforeSetup).filter((r) => r.path.startsWith('/' + 'ebay/'))) assert.deepEqual(r.query, { accountId: 'selected-shop' });
  reset({ ebayAccountId: undefined }); const countNoAccount = setupReads;
  assert.equal(JSON.parse(text(await call('vendlists_check_setup', { listingId: 'draft-1' }))).accountScope, 'unknown');
  assert.equal(setupReads, countNoAccount);
  for (const mode of ['wrong-account', 'changed', 'limited']) {
    reset(); setupMode = mode; const before = setupReads;
    const result = await call('vendlists_check_setup', { listingId: 'draft-1' });
    assert.equal(result.isError, true); assert.equal(setupReads, before + 1);
    if (mode === 'limited') assert.match(text(result), /Retry-After: 120/);
  }
  setupMode = 'ok';
  for (const overrides of [{ updatedAt: undefined }, { marketplaceId: undefined }]) {
    reset(overrides); const before = setupReads;
    assert.equal((await call('vendlists_check_setup', { listingId: 'draft-1' })).isError, true);
    assert.equal(setupReads, before);
  }
  console.log('PASS: selected-account diagnostics, saved evidence labeling, account/site races and no polling');

  reset(); const beforeNotice = requests.length;
  for (const args of [{ acknowledgedByPerson: false }, {}]) {
    assert.equal((await call('vendlists_acknowledge_ebay_fees', { listingId: 'draft-1', marketplaceId: 'EBAY_GB', ...args })).isError, true);
  }
  assert.equal(requests.length, beforeNotice);
  const beforeWrongSite = writeCount();
  assert.equal((await call('vendlists_acknowledge_ebay_fees', { listingId: 'draft-1', marketplaceId: 'EBAY_US', acknowledgedByPerson: true })).isError, true);
  assert.equal(writeCount(), beforeWrongSite);
  const acknowledged = await call('vendlists_acknowledge_ebay_fees', { listingId: 'draft-1', marketplaceId: 'EBAY_GB', acknowledgedByPerson: true });
  assert.equal(JSON.parse(text(acknowledged)).published, false);
  assert.deepEqual(requests.at(-1).body, { action: 'confirm', marketplaceId: 'EBAY_GB' });
  feeMode = 'missing';
  assert.equal((await call('vendlists_acknowledge_ebay_fees', { listingId: 'draft-1', marketplaceId: 'EBAY_GB', acknowledgedByPerson: true })).isError, true);
  assert.ok(!requests.some((r) => r.path.startsWith('/' + 'ebay/publish/')));
  console.log('PASS: explicit fee acknowledgement, marketplace binding, confirmed result and no implicit publish');

  delete schema.paths['/listings/{listingId}'].put;
  const child = spawn(config.command, config.args.map(replace), { cwd: tmpdir(), env: { ...process.env,
    VENDLISTS_API: api, VENDLISTS_API_KEY: key, VENDLISTS_KEY: key }, stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = ''; child.stderr.on('data', (chunk) => { stderr += chunk; });
  const code = await new Promise((resolve, reject) => { child.on('close', resolve); child.on('error', reject); });
  assert.equal(code, 1); assert.match(stderr, /PUT \/listings\/\{listingId\}/);
  console.log('PASS: missing HTTP method fails startup before serving tools');

} finally {
  await client.close(); fixture.closeAllConnections(); await new Promise((resolve) => fixture.close(resolve));
}

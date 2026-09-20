#!/usr/bin/env node
/**
 * The whole path, in Node with no dependencies: photos in, a finished eBay
 * listing out, stopping before it goes live.
 *
 *   export VENDLISTS_KEY=vl_agent_your_key_here
 *   node examples/node/list-an-item.mjs ./photos/*.jpg
 *
 * It deliberately does NOT publish. Publishing puts a real item in front of
 * real buyers on the person's own eBay account, so it is one explicit call
 * further on, printed at the end for you to run when you mean it.
 */
import { readFile } from 'node:fs/promises';
import { basename, extname } from 'node:path';

const API = process.env.VENDLISTS_API ?? 'https://api.vendlists.com';
const KEY = process.env.VENDLISTS_KEY;

const CONTENT_TYPES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
const POLL_SECONDS = 6;
const GIVE_UP_AFTER_MINUTES = 10;

async function call(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${KEY}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (res.status === 429) {
    // The API says how long to wait, so wait that long rather than guessing.
    const wait = Number(res.headers.get('retry-after') ?? 30);
    console.log(`  rate limited; waiting ${wait}s`);
    await sleep(wait * 1000);
    return call(method, path, body);
  }
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${text}`);
  return data;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const files = process.argv.slice(2);
  if (!KEY) throw new Error('Set VENDLISTS_KEY to your vl_agent_… key.');
  if (files.length === 0) throw new Error('Pass one or more photo paths.');

  // 0. Where does this person stand? One call, before spending anything.
  const me = await call('GET', '/agent/me');
  console.log(`account: ${me.plan.name}, ${me.allowance.remaining} of ${me.allowance.included} listings left`);
  if (!me.ebay.connected) {
    console.log('eBay is not connected yet. The person connects it themselves at vendlists.com.');
  }
  if (me.allowance.nextListing.kind === 'blocked') {
    throw new Error(`No listing available: ${me.allowance.nextListing.reason}. See ${API}/agent/guide`);
  }

  // 1. The draft. Everything the person said about the item goes here: it is
  //    what the model cannot see in a photo.
  const { listingId } = await call('POST', '/listings', {
    additionalContext: process.env.ITEM_NOTES ?? 'Listed from the Vendlists agent kit example.',
    quantity: 1,
  });
  console.log(`draft: ${listingId}`);

  // 2. One upload URL per photo, then PUT the bytes with the same type.
  const urls = await call('POST', '/listings/upload-url', {
    listingId,
    files: files.map((file, index) => ({ contentType: contentTypeOf(file), index })),
  });
  await Promise.all(urls.map(async ({ uploadUrl }, i) => {
    const bytes = await readFile(files[i]);
    const put = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': contentTypeOf(files[i]) },
      body: bytes,
    });
    if (!put.ok) throw new Error(`upload of ${basename(files[i])} → ${put.status}`);
    console.log(`  uploaded ${basename(files[i])}`);
  }));

  // 3. Vendlists writes it. This is the call that uses one of the month's listings.
  await call('POST', `/listings/${listingId}/generate`, {});
  console.log('writing the listing…');

  // 4. Poll only while it is being written, and never forever.
  const deadline = Date.now() + GIVE_UP_AFTER_MINUTES * 60_000;
  let listing;
  do {
    await sleep(POLL_SECONDS * 1000);
    listing = await call('GET', `/listings/${listingId}`);
    process.stdout.write(`  ${listing.status}\r`);
  } while (listing.status === 'processing' && Date.now() < deadline);

  if (listing.status === 'failed') {
    // `processingError` is a sentence written for the person, in their language.
    throw new Error(`${listing.processingErrorCode ?? 'FAILED'}: ${listing.processingError}`);
  }
  if (listing.status !== 'pending_review') {
    throw new Error(`Still ${listing.status} after ${GIVE_UP_AFTER_MINUTES} minutes.`);
  }

  // 5. Show the person what was written. They decide what happens next.
  console.log(`\n${listing.title}`);
  console.log(`  price:     ${(listing.price ?? listing.suggestedPrice ?? 0) / 100} ${listing.currency ?? ''}`);
  console.log(`  category:  ${listing.categoryName ?? '—'}`);
  console.log(`  condition: ${listing.condition ?? '—'}`);
  console.log(`  specifics: ${Object.keys(listing.itemSpecifics ?? {}).join(', ') || '—'}`);

  // 6. eBay's fee, which is eBay's and not Vendlists'. Show it before publishing.
  try {
    const fees = await call('POST', `/listings/${listingId}/channels/fees`, { action: 'quote' });
    console.log(`  eBay fee:  ${JSON.stringify(fees)}`);
  } catch (err) {
    console.log(`  eBay fee:  not quoted (${err.message.split('\n')[0]})`);
  }

  console.log(`
Review it at https://vendlists.com/dashboard/listings/${listingId}

When the person says yes, publish with:
  curl -X POST ${API}/ebay/publish/${listingId} \\
    -H "Authorization: Bearer $VENDLISTS_KEY" -H 'Content-Type: application/json' -d '{}'
`);
}

function contentTypeOf(file) {
  const type = CONTENT_TYPES[extname(file).toLowerCase()];
  if (!type) throw new Error(`${basename(file)}: photos must be jpeg, png or webp.`);
  return type;
}

main().catch((err) => {
  console.error(`\n${err.message}`);
  process.exit(1);
});

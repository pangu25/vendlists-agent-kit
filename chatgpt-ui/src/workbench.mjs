import { App } from './bridge.mjs';
const app = new App({ name: 'Vendlists', version: '0.1.0' }, {}, { autoResize: true });
const $ = id => document.getElementById(id);
const fields = ['title', 'price', 'quantity', 'condition', 'description'];
let listing, currentQueued, busy = false, connected = false, dirty = false, quote, quoteRevision;
const text = (id, value) => { $(id).textContent = String(value ?? ''); };
function notice(message, tone = '') { text('notice', message); $('notice').dataset.tone = tone; }
function money(cents, currency) {
  if (!Number.isSafeInteger(cents) || !/^[A-Z]{3}$/.test(currency ?? '')) return 'Price unavailable';
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100); }
  catch { return `${(cents / 100).toFixed(2)} ${currency}`; }
}
function canEdit(value) {
  return value && ['draft', 'pending_review', 'failed'].includes(value.status) && !value.ebayItemId && !value.ebayListingId
    && !['imported', 'ebay_import'].includes(value.origin) && value.source !== 'ebay_import' && !value.publishedAt && !value.ebayPublishedAt && !value.hasAuctionObservation
    && (value.ebaySelling === undefined || value.ebaySelling && typeof value.ebaySelling.format === 'string')
    && [value.ebaySelling?.format, value.ebayListingFormat, value.ebayListingType, value.listingFormat].filter(v => v !== undefined)
      .every(v => ['FIXED_PRICE', 'FixedPriceItem', 'StoresFixedPrice'].includes(v)) && Boolean(value.updatedAt);
}
function invalidateApproval() { quote = undefined; quoteRevision = undefined; for (const id of ['fee-step', 'publish-step']) $(id).hidden = true; }
function enable() {
  const available = connected && !busy && Boolean(listing);
  for (const id of ['refresh', 'setup', 'editor']) $(id).disabled = !available;
  for (const id of [...fields, 'save', 'photos', 'generate', 'fee']) $(id).disabled = !available || !canEdit(listing);
  $('confirm-publish').disabled = !available || dirty || !quote || quoteRevision !== listing?.updatedAt;
  $('start').disabled = !connected || busy;
  $('ack').disabled = !available || !$('fee-agreement').checked;
  document.body.classList.toggle('busy', busy);
}
function safeImage(raw) {
  try { const url = new URL(raw); return !url.username && !url.password &&
    (url.protocol === 'https:' || location.hostname === '127.0.0.1' && url.origin === location.origin) ? url.href : undefined; }
  catch { return undefined; }
}
function showPhoto(url) { $('main-photo').src = url; $('main-photo').hidden = false; $('no-photo').hidden = true; }
$('main-photo').onerror = () => { $('main-photo').hidden = true; $('no-photo').hidden = false; };
function render(value, force = false) {
  if (!value?.listingId) return;
  if (dirty && !force) {
    currentQueued = value; $('load-current').hidden = false;
    notice('You have unsaved edits. Load the current draft to review its latest values before replacing your edits.'); return;
  }
  listing = value; dirty = false; currentQueued = undefined; invalidateApproval(); $('load-current').hidden = true;
  $('empty').hidden = true; $('work').hidden = false;
  const statuses = { draft: 'Draft', pending_review: 'Ready to review', processing: 'Writing listing', failed: 'Needs attention', published: 'Live on eBay', ended: 'Ended', sold: 'Sold' };
  text('status', statuses[value.status] ?? 'Check listing');
  text('heading', value.status === 'published' ? 'Your listing is live' : 'Review your listing');
  const market = String(value.marketplaceId ?? '').replace(/^EBAY_/, 'eBay ');
  text('market', `${market || 'Marketplace unavailable'}${value.currency ? ` • ${value.currency}` : ''}${value.sku ? ` • ${value.sku}` : ''}`);
  $('title').value = value.title ?? ''; $('price').value = Number.isSafeInteger(value.price) ? (value.price / 100).toFixed(2) : '';
  $('quantity').value = value.quantity ?? 1; $('condition').value = value.conditionDescription ?? '';
  $('description').value = value.description ?? ''; text('price-label', `Price${value.currency ? ` (${value.currency})` : ''}`);
  text('title-count', `${$('title').value.length} / 80`);
  $('specifics').replaceChildren();
  for (const [key, val] of Object.entries(value.itemSpecifics ?? {}).slice(0, 30)) {
    const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = key; dd.textContent = Array.isArray(val) ? val.join(', ') : String(val ?? ''); $('specifics').append(dt, dd);
  }
  $('thumbs').replaceChildren(); $('main-photo').hidden = true; $('no-photo').hidden = false;
  const photos = (Array.isArray(value.imageUrls) ? value.imageUrls : []).map(safeImage).filter(Boolean).slice(0, 24);
  photos.forEach((url, index) => {
    const button = document.createElement('button'), image = document.createElement('img'); image.src = url; image.alt = '';
    button.append(image); button.setAttribute('aria-label', `Show photo ${index + 1}`); button.setAttribute('aria-pressed', String(index === 0));
    button.onclick = () => { showPhoto(url); for (const b of $('thumbs').children) b.setAttribute('aria-pressed', String(b === button)); }; $('thumbs').append(button);
  });
  if (photos[0]) showPhoto(photos[0]); text('photo-count', `${photos.length} photo${photos.length === 1 ? '' : 's'}`);
  text('photos', 'Add photos');
  text('saved', value.updatedAt ? 'Current saved draft' : 'Revision unavailable');
  text('next-title', value.status === 'processing' ? 'Your listing is being written' : 'Ready for the next step?');
  text('next-copy', value.status === 'processing' ? 'Refresh to check progress. Do not start generation again while it is processing.' : canEdit(value) ? 'Review the item details, then check the eBay listing fee.' : 'Open Vendlists for this listing’s next step.');
  const blockers = value.publishBlockerCount ?? (Array.isArray(value.publishBlockers) ? value.publishBlockers.length : 0);
  notice(blockers ? `${blockers} listing detail${blockers === 1 ? '' : 's'} need attention before publishing. Resolve setup or open the editor.` : value.status === 'failed' ? 'This draft needs attention. Resolve setup to see the next action.' : '');
  text('generate', value.title ? 'Regenerate draft' : 'Generate draft'); enable();
}
function unwrap(result) {
  if (result.isError) throw new Error(result.content?.find(x => x.type === 'text')?.text ?? 'The request could not be completed. Refresh the current listing before retrying.');
  if (result.structuredContent) return result.structuredContent;
  try { return JSON.parse(result.content?.find(x => x.type === 'text')?.text ?? '{}'); } catch { return {}; }
}
async function call(name, args) { return unwrap(await app.callServerTool({ name, arguments: args }, { timeout: 26_000 })); }
async function action(fn) {
  if (busy) return; busy = true; enable();
  try { await fn(); } catch (error) { notice(String(error.message ?? 'The request could not be completed. Refresh before retrying.').slice(0, 650), 'error'); }
  finally { busy = false; enable(); }
}
for (const id of fields) $(id).addEventListener('input', () => {
  dirty = true; invalidateApproval(); text('saved', 'Unsaved edits'); text('title-count', `${$('title').value.length} / 80`); enable();
});
$('save').onclick = () => action(async () => {
  const changes = {}, title = $('title').value.trim(), price = $('price').value.trim(), quantity = Number($('quantity').value);
  if (!title || title.length > 80) throw new Error('Use a title with 1 to 80 characters.');
  if (!/^\d+(\.\d{1,2})?$/.test(price)) throw new Error('Enter a positive price with up to two decimal places.');
  const cents = Math.round(Number(price) * 100);
  if (!Number.isSafeInteger(cents) || cents <= 0 || !Number.isSafeInteger(quantity) || quantity < 1) throw new Error('Enter a valid price and whole-number quantity.');
  for (const [key, value] of Object.entries({ title, price: cents, quantity, conditionDescription: $('condition').value.trim(), description: $('description').value })) {
    if (value !== (listing[key] ?? '') && value !== '') changes[key] = value;
    if (value === '' && listing[key]) throw new Error('Keep the existing text or replace it with a description. This editor does not delete facts.');
  }
  if (!Object.keys(changes).length) { dirty = false; text('saved', 'No changes to save'); return; }
  const result = await call('vendlists_update_draft', { listingId: listing.listingId, expectedUpdatedAt: listing.updatedAt, changes });
  render(result.listing ?? result, true); notice('Draft saved. Review these details before publishing.', 'success');
});
$('refresh').onclick = () => action(async () => { const result = await call('vendlists_get_listing', { listingId: listing.listingId }); render(result.listing ?? result); });
$('load-current').onclick = () => { if (currentQueued) render(currentQueued, true); };
$('setup').onclick = () => action(async () => {
  const result = await call('vendlists_check_setup', { listingId: listing.listingId });
  const time = result.observedAt ? new Date(result.observedAt).toLocaleTimeString() : '';
  notice(`${result.nextStep ?? 'Open the editor to finish the selected account’s setup.'}${time ? ` Checked at ${time}.` : ''} Saved setup is not a fresh eBay verification.`);
});
$('editor').onclick = () => action(async () => { await app.openLink({ url: `https://vendlists.com/dashboard/listings/${encodeURIComponent(listing.listingId)}` }); });
$('generate').onclick = () => { if (dirty) { notice('Save your edits before regenerating the draft.'); return; } $('generation-step').hidden = false; };
$('cancel-generation').onclick = () => { $('generation-step').hidden = true; };
$('confirm-generation').onclick = () => action(async () => {
  if (dirty) throw new Error('Save your edits before regenerating the draft.');
  $('generation-step').hidden = true; invalidateApproval();
  await call('vendlists_generate', { listingId: listing.listingId });
  const result = await call('vendlists_get_listing', { listingId: listing.listingId }); render(result.listing ?? result, true);
  notice('Generation requested. Refresh to check the current listing before taking another action.');
});
$('fee').onclick = () => action(async () => {
  if (dirty) throw new Error('Save your draft changes before checking the fee.');
  const result = await call('vendlists_quote_ebay_fees', { listingId: listing.listingId });
  const candidate = result.quote;
  if (!candidate || !['free', 'fee'].includes(candidate.state) || !Number.isSafeInteger(candidate.totalMinor)
      || candidate.totalMinor < 0 || candidate.marketplaceId !== listing.marketplaceId || result.expectedUpdatedAt && result.expectedUpdatedAt !== listing.updatedAt || candidate.currency !== listing.currency || !/^[A-Z]{3}$/.test(candidate.currency ?? '')) {
    invalidateApproval(); throw new Error('A current fee for this marketplace is unavailable. Resolve setup or open the editor.');
  }
  quote = candidate; quoteRevision = listing.updatedAt; $('fee-step').hidden = false;
  text('fee-text', `Current eBay listing fee: ${money(quote.totalMinor, quote.currency)}. This quote covers listing fees, not every possible selling charge.`);
  const confirmed = Array.isArray(result.feeNotice?.confirmedSites) && result.feeNotice.confirmedSites.includes(listing.marketplaceId);
  $('ack-step').hidden = confirmed; $('review-publish').hidden = !confirmed; $('fee-agreement').checked = false; notice('');
});
$('fee-agreement').onchange = enable;
$('ack').onclick = () => action(async () => {
  if (!$('fee-agreement').checked || quoteRevision !== listing.updatedAt) return;
  await call('vendlists_acknowledge_ebay_fees', { listingId: listing.listingId, marketplaceId: listing.marketplaceId, acknowledgedByPerson: true });
  $('ack-step').hidden = true; $('review-publish').hidden = false; notice('Fee notice acknowledged. Your listing is still a draft.', 'success');
});
$('review-publish').onclick = () => {
  if (dirty || !quote || quoteRevision !== listing.updatedAt) return;
  text('publish-summary', `${listing.title} • ${listing.marketplaceId} • ${money(listing.price, listing.currency)} • Quantity ${listing.quantity ?? 1}`);
  text('publish-fee', `eBay listing fee: ${money(quote.totalMinor, quote.currency)}.`); $('publish-step').hidden = false; $('confirm-publish').focus();
};
$('cancel-publish').onclick = () => { $('publish-step').hidden = true; };
$('confirm-publish').onclick = () => action(async () => {
  if (dirty || !quote || quoteRevision !== listing.updatedAt) return;
  const revision = listing.updatedAt; invalidateApproval();
  await call('vendlists_publish', { listingId: listing.listingId, expectedUpdatedAt: revision, confirmedByPerson: true });
  const result = await call('vendlists_get_listing', { listingId: listing.listingId }); render(result.listing ?? result, true);
  notice(listing.status === 'published' && (listing.ebayListingId || listing.ebayItemId) ? 'Published to eBay. Open Vendlists to view the live listing.' : 'Publishing was requested. Check the current listing before any retry.');
});
async function normalize(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 20_000_000) throw new Error('Choose JPEG, PNG or WebP photos up to 20 MB. Convert HEIC first or use the Vendlists app.');
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width * bitmap.height > 80_000_000) throw new Error('This image is too large. Use a smaller photo.');
    const canvas = document.createElement('canvas'), scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .82));
    if (!blob || blob.size > 3_000_000) throw new Error('This photo still needs resizing. Choose a smaller photo or use Vendlists.');
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } finally { bitmap.close(); }
}
$('photos').onclick = () => {
  if (dirty) { notice('Save your edits before adding photos.'); return; }
  if (!window.openai?.uploadFile || !window.openai?.getFileDownloadUrl) { notice('Photo upload is unavailable in this host. Open Vendlists to add photos, then refresh here.'); return; }
  $('file-input').click();
};
$('file-input').onchange = () => action(async () => {
  if (dirty) throw new Error('Save your edits before adding photos.');
  const selected = Array.from($('file-input').files ?? []); $('file-input').value = '';
  if (!selected.length) return; if (selected.length > 8) throw new Error('Choose up to eight item views per upload. Use Vendlists for larger photo sets.');
  const normalized = await Promise.all(selected.map(normalize)); const files = [];
  for (const file of normalized) {
    const { fileId } = await window.openai.uploadFile(file); const { downloadUrl } = await window.openai.getFileDownloadUrl({ fileId });
    files.push({ file_id: fileId, download_url: downloadUrl, mime_type: file.type, file_name: file.name });
  }
  invalidateApproval();
  await call('vendlists_upload_photos', { listingId: listing.listingId, files });
  const result = await call('vendlists_get_listing', { listingId: listing.listingId }); render(result.listing ?? result, true); notice('Photos saved to the draft.', 'success');
});
$('start').onclick = () => action(async () => { await app.sendMessage({ role: 'user', content: [{ type: 'text', text: 'Help me create an eBay draft from my item photos and seller facts using Vendlists.' }] }); });
app.ontoolresult = result => { try { const data = unwrap(result); render(data.listing ?? data); } catch (error) { notice(error.message, 'error'); } };
app.onhostcontextchanged = context => { if (['light', 'dark'].includes(context.theme)) document.documentElement.dataset.theme = context.theme; };
try { await app.connect(); connected = true; const context = app.getHostContext(); if (context?.theme) document.documentElement.dataset.theme = context.theme; enable(); }
catch { notice('The listing preview could not connect. Continue in chat or open Vendlists.'); }

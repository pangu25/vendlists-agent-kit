import { z } from 'zod';

export const listingIdSchema = z.string().trim().min(1).max(200);
export const revisionSchema = z.string().trim().min(1).max(100);
const forbiddenKey = (key) => ['__proto__', 'constructor', 'prototype'].includes(key);
const specificKey = z.string().trim().min(1).max(65).refine((key) => !forbiddenKey(key), 'Unsafe item-specific name');
export const changesSchema = z.object({
  title: z.string().trim().min(1).max(80).optional(),
  description: z.string().min(1).max(50000).optional(),
  price: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional().describe('Exact price in cents in the current marketplace currency, never dollars.'),
  quantity: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER).optional(),
  conditionDescription: z.string().trim().min(1).max(1000).optional(),
  itemSpecifics: z.record(specificKey, z.string().trim().min(1).max(500)).optional()
    .describe('Only verified values to add/change; all existing specifics, including ISBNs, are preserved. No deletions.'),
}).strict().refine((value) => Object.values(value).some((entry) => entry !== undefined
  && (typeof entry !== 'object' || Object.keys(entry).length > 0)), 'Supply at least one change');

export const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const pick = (value, keys) => Object.fromEntries(keys.filter((key) => value[key] !== undefined).map((key) => [key, value[key]]));
export const listingView = (value) => {
  if (!object(value) || typeof value.listingId !== 'string') throw new Error('Listing response was incomplete. Read the listing again before proceeding.');
  return {
    ...pick(value, ['listingId', 'status', 'updatedAt', 'title', 'description', 'price', 'suggestedPrice',
      'currency', 'marketplaceId', 'quantity', 'condition', 'conditionDescription', 'categoryId', 'categoryName',
      'itemSpecifics', 'sku', 'imageUrls', 'ebayAccountId', 'ebayItemId', 'ebayListingId', 'ebayUrl', 'ebayItemUrl',
      'ebayListingUrl', 'publishBlockers', 'publishRemedy', 'processingError', 'processingErrorCode',
      'ebayListingFormat', 'ebayListingType', 'origin', 'itemSpecificsSyncedAt', 'itemSpecificsSource', 'itemSpecificsUnavailable']),
    ...(object(value.ebaySelling) ? { ebaySelling: pick(value.ebaySelling, ['format']) } : {}),
    ...(object(value.ebayAuctionObservation) ? { hasAuctionObservation: true } : {}),
    priceUnit: 'cents in the marketplace currency; do not assume USD',
  };
};

export function assertEditable(listing, expectedUpdatedAt) {
  if (!object(listing) || !['draft', 'pending_review', 'failed'].includes(listing.status)) {
    throw new Error('Only draft, pending_review or failed listings can be edited. Read the current listing; this tool cannot change live listings.');
  }
  if (listing.ebayItemId || listing.ebayListingId || listing.publishedAt || listing.ebayPublishedAt
      || ['imported', 'ebay_import'].includes(listing.origin) || listing.source === 'ebay_import') {
    throw new Error('This listing has marketplace history. Keep the review advisory; no live revision is available here.');
  }
  const formats = [listing.ebaySelling?.format, listing.ebayListingFormat, listing.ebayListingType, listing.listingFormat]
    .filter((value) => value !== undefined && value !== null);
  if (object(listing.ebayAuctionObservation) || formats.some((value) => !['FIXED_PRICE', 'FixedPriceItem', 'StoresFixedPrice'].includes(value))) {
    throw new Error('Auction or uncertain listing format: use the Vendlists editor. This tool edits Buy It Now drafts only.');
  }
  if (typeof listing.updatedAt !== 'string' || !listing.updatedAt || listing.updatedAt !== expectedUpdatedAt) {
    throw new Error('This draft changed or its revision is unavailable. Read it again, review the new values, then use its updatedAt. No changes were saved.');
  }
}

export function draftBody(listing, expectedUpdatedAt, changes) {
  assertEditable(listing, expectedUpdatedAt);
  const body = { ...changes, expectedUpdatedAt };
  if (changes.itemSpecifics !== undefined) {
    const old = listing.itemSpecifics === undefined ? {} : listing.itemSpecifics;
    if (!object(old) || Object.entries(old).some(([key, value]) => forbiddenKey(key) || typeof value !== 'string')) {
      throw new Error('Existing item specifics have an unsupported shape. Use the editor to preserve them; no changes were saved.');
    }
    body.itemSpecifics = Object.fromEntries([...Object.entries(old), ...Object.entries(changes.itemSpecifics)]);
  }
  return body;
}

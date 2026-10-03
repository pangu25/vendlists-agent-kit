---
name: photo-to-ebay-listing
description: Create an eBay listing draft from selected item photos and seller facts using Vendlists. Use for photo-to-listing, AI eBay listing creation, reselling items or writing an eBay draft. Do not use for other marketplaces, stock market trading or unrelated photo editing.
---

# Photos to an eBay draft
1. Read vendlists_status. Verify current generation allowance and identify the intended eBay marketplace/currency. Ask about unknown condition, defects, quantity, model or measurements when they affect the listing. Never infer tested-working, authenticity, material, identifiers, completeness or unseen damage from a photo.
2. Search vendlists_find_listings if the item might already exist. Search covers title/SKU, not ISBN; an empty page with nextToken is not exhaustion. Ask when matches are ambiguous.
3. Call vendlists_create_listing with the seller's known facts and one idempotencyKey per new item. Preserve that key and exact inputs. On an uncertain response, reconcile/search; retry only identical input/key inside the allowed replay window. Never use a new key to recover an uncertain create.
4. Pass only the user-selected files to vendlists_upload_photos. ChatGPT file objects use download_url and file_id, optional mime_type and file_name. Local filesystem paths are unavailable in the hosted integration. For a large or unsupported image, use the workbench's photo uploader or direct editor; never fetch an unrelated URL or invent attachment IDs. Confirm upload before generation.
5. Call vendlists_generate only when the seller requested generation and allowance is available. Read vendlists_get_listing until pending_review, spacing calls and obeying Retry-After. A processing result is not completion; a timeout is not permission to regenerate.
6. Show the workbench and a compact review: title, photos, description, specifics, condition, price/currency, quantity, marketplace and outstanding questions. Titles must stay within eBay's 80-character limit and use facts relevant to this item. Preserve seller identifiers and locale.

Default endpoint is a reviewed draft. Publish only after a separate current fee quote and explicit approval, following resolve-ebay-publishing. Do not claim app changes, generation or publishing happened merely because suggested text was written in chat. No subscription or credit purchases through this plugin; stop when entitlement is unavailable.

Use vendlists_show_listing after reading the intended draft to render its current preview. The display tool rereads the authenticated listing; do not pass invented listing data to it.

Use the selected account returned by `vendlists_status` to bind a new draft explicitly with `ebayAccountId`. Preserve that field with the identical retry inputs/key. If an existing draft has no saved account, use the editor to select one before quoting fees or publishing. Do not publish across a marketplace or currency mismatch.

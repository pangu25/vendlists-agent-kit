---
name: improve-ebay-draft
description: Improve an existing Vendlists eBay draft title, product description, condition wording and item specifics. Use for eBay listing optimization, keyword relevance, listing quality review or missing facts. Do not promise rankings or prices, invent identifiers, or edit live/imported listings.
---

# Improve the draft with evidence
Find the intended listing using vendlists_find_listings, then read vendlists_get_listing. Explain ambiguities before choosing. Use its current updatedAt revision, marketplace, currency and selected account.

Use relevant, confirmed terms in an eBay title up to 80 characters. Prefer brand, item type, model and distinguishing seller-confirmed attributes. Remove irrelevant search terms and repeated filler; do not stuff competitors, claim search-ranking boosts, or promise sales. Describe observable features, seller-confirmed working condition, defects, measurements and included accessories. Separate unknown facts as questions. Do not invent ISBN, UPC, MPN, authenticity, material, compatibility or testing evidence.

Show proposed changes or a compact before/after when useful. Only save what the person requested. vendlists_update_draft accepts title, description, integer-cent price, quantity, conditionDescription and partial itemSpecifics against expectedUpdatedAt. Follow provided selection-only values; preserve existing identifiers and unedited specifics. Price changes require the seller's intended amount and existing currency; do not give market-value claims without actual current comparables. Do not change category, condition enum, shipping, marketplace, account or Best Offer through this tool.

If revision changed, reread and show the updated draft before saving again. Never overwrite concurrent changes. Refuse auction, processing, imported/live or unknown-format mutations. For fields outside supported edits, offer the direct editor link. After saving, read the resulting draft and show what changed. No automatic regeneration, publish, account changes or paid extras.

Use vendlists_show_listing after reading the intended draft to render its current preview. The display tool rereads the authenticated listing; do not pass invented listing data to it.

Use the selected account returned by `vendlists_status` to bind a new draft explicitly with `ebayAccountId`. Preserve that field with the identical retry inputs/key. Older drafts without a saved account must be reviewed and published through the existing Vendlists editor. This connection cannot bind or choose an account for them; do not create a duplicate to bypass that limit. Do not publish across a marketplace or currency mismatch.

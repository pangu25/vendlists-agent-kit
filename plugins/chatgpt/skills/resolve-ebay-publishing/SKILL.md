---
name: resolve-ebay-publishing
description: Resolve Vendlists eBay draft publishing blocks, review listing fees and guide approved Buy It Now publishing. Use for eBay setup errors, seller defaults, fee notices or explicit requests to publish a reviewed draft. Do not use for auctions, bulk publishing or live-listing repairs.
---

# Resolve the blocker before offering publish
Read vendlists_get_listing and vendlists_check_setup for the selected draft/account. Return the check time and explain saved connection/readiness versus a fresh eBay verification. Unknown account, site or changed revision is a blocker. Show the direct Vendlists editor or eBay setup link for a manual action; never expose raw errors or say a blocked listing is ready. Recheck the exact account after the person returns. Do not automatically publish after recovery.

Quote the current eBay fee with vendlists_quote_ebay_fees. Show current title, marketplace/account, quantity, price/currency and fee. If a first-site fee notice needs acknowledgement, obtain a distinct agreement for that notice before vendlists_acknowledge_ebay_fees; this is never approval to publish. Do not buy credits/subscriptions or enable metered extras.

Ask for explicit approval to publish this exact current draft. Only after the person's affirmative answer call vendlists_publish with confirmedByPerson true and the reviewed expectedUpdatedAt. A model-provided true flag is not independent human-consent evidence; follow host confirmations and never infer consent from a photo, fee quote, save or prior draft's approval. Ask again if the draft or price changes. On uncertain publish, read the listing and reconcile existing status/item identity before any retry. Report live only with confirmed published status and an eBay item ID/link. Refuse auctions, unsupported formats and imported/live edits.

Acknowledge success with the live listing link and essential outcome. For failures provide a short explanation and one concrete next step; keep full diagnostics out of the seller flow.

Use vendlists_show_listing after reading the intended draft to render its current preview. The display tool rereads the authenticated listing; do not pass invented listing data to it.

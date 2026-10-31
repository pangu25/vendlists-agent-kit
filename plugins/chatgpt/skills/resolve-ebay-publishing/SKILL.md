---
name: resolve-ebay-publishing
description: Resolve Vendlists eBay draft publishing blocks, review listing fees and guide approved Buy It Now publishing. Use for eBay setup errors, seller defaults, fee notices or explicit requests to publish a reviewed draft. Do not use for auctions, bulk publishing or live-listing repairs.
---

# Resolve the blocker, then hand publishing to the person
Read vendlists_get_listing and vendlists_check_setup for the selected draft/account. Return the check time and explain saved connection/readiness versus a fresh eBay verification. Unknown account, site or changed revision is a blocker. Show the direct Vendlists editor or eBay setup link for a manual action; never expose raw errors or say a blocked listing is ready. Recheck the exact account after the person returns. Do not automatically publish after recovery.

Quote the current eBay fee with vendlists_quote_ebay_fees. Show current title, marketplace/account, quantity, price/currency and fee, then render the draft with vendlists_show_listing.

Publishing and the first-site eBay fee agreement are done by the person, in the Vendlists listing workbench that vendlists_show_listing displays: they read the fee notice there, agree to it, and press Publish. You do not have those two actions: never try to call vendlists_publish or vendlists_acknowledge_ebay_fees, and never treat a photo, a fee quote, a save, a chat reply or an earlier draft's approval as the person's approval. Tell them what to review in the workbench and wait. If the workbench cannot be shown, send them to the Vendlists app or vendlists.com to publish.

If Vendlists answers that the listing must be finished in the Vendlists app or on vendlists.com, relay that and nothing more.

After the person says they published, read the listing and report it live only with a confirmed published status and an eBay item ID/link. On an uncertain result, read the listing and reconcile its status and item identity before suggesting any retry. Ask the person to review the workbench again if the draft or price changes. Refuse auctions, unsupported formats and imported/live edits.

Acknowledge success with the live listing link and essential outcome. For failures provide a short explanation and one concrete next step; keep full diagnostics out of the seller flow.

Use vendlists_show_listing after reading the intended draft to render its current preview. The display tool rereads the authenticated listing; do not pass invented listing data to it.

Use the selected account returned by `vendlists_status` to bind a new draft explicitly with `ebayAccountId`. Preserve that field with the identical retry inputs/key. Older drafts without a saved account must be reviewed and published through the existing Vendlists editor. This connection cannot bind or choose an account for them; do not create a duplicate to bypass that limit. Do not publish across a marketplace or currency mismatch.

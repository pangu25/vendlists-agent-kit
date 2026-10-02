# Claude directory submission — Vendlists

Prepared 2026-10-02 for plugin 1.1.0. This is a submission worksheet, not a claim of approval or publication.

## Source and release

- Repository: `pangu25/vendlists-agent-kit` (public).
- Plugin path: repository root; leave optional path blank.
- Immutable name: `vendlists`; display name: `Vendlists`.
- Review branch: `plans/174-claude-plugin`, for portal validation before release.
- Durable tracked branch: choose `main` only after release merges this version there. Do not submit a temporary branch that will be deleted. Revalidate after every new commit.
- Account: paid Claude account; Team/Enterprise submitters need the required owner/directory role. Use the account/organization that should own this listing long term.
- Connected GitHub account needs push access. Check for an existing submission before creating a duplicate.

Portal: https://claude.ai/directory/manage. Choose **Plugin bundle**, not remote MCP connector. This release has no hosted endpoint. Do not reuse unfinished plan 147e's connector pack.

## Listing copy

**Short description:** Create eBay listings from local photos, review titles and item specifics, and publish to your own seller account after approval.

**Use cases:**

1. Turn local photos and notes into a fixed-price eBay draft with title, description, condition, category, specifics and a suggested price.
2. Improve draft wording and identify missing specifics, defects and unsupported claims.
3. Quote eBay's listing fee, obtain specific approval, publish to the connected seller account and verify the result.

Full listing text is the README. Automation is for Claude Code with a configured local server. Chat and Cowork get advice skills; do not claim listing automation there. No auction, live-revision, sales-lookup or draft-edit tool is included.

**Links:** product https://vendlists.com · source/docs https://github.com/pangu25/vendlists-agent-kit · support https://vendlists.com/support and hello@vendlists.com · privacy https://vendlists.com/privacy · terms https://vendlists.com/terms.

## Data handling — verify before attesting

The plugin reads selected local photos, item notes and returned account/listing information. Those can contain personal data; do not answer “no personal data.” It sends authenticated requests to `api.vendlists.com` and photos to Vendlists-provided presigned storage URLs. Vendlists processes item data for AI generation and sends approved listings to eBay. The plugin adds no analytics/advertising destination. The README describes network destinations and converter subprocesses.

Prepared JPEGs remain in temporary folders until the user or OS removes them. The current [Vendlists Privacy Policy](https://vendlists.com/privacy), checked 2026-10-02, states that active-account data is retained while the account is active and that account deletion removes personal data, listing drafts and uploaded photos. It also states that Vendlists is not intended for users under 18. Those are policy statements, not an independent audit of all deletion/storage jobs. Hosted data does not disappear with a Claude session; never invent a fixed day-count retention period. Confirm operational details if the portal asks for a more specific attestation.

The plugin does not initiate subscriptions or purchases. Generation uses allowance and publication can incur eBay fees, both disclosed. Specific seller approval is required before publication.

## Checks and review

```bash
claude plugin validate .claude-plugin/plugin.json --strict
claude plugin validate .claude-plugin/marketplace.json --strict
npm run check
npm run smoke
```

The launcher runs readable bundled Node code directly. No hooks, runtime installers, bundled executables or unpinned launchers are declared. Keys use required sensitive userConfig. The committed package.json/lockfile can receive Anthropic's **Dependencies install from a lockfile** reviewer hold, which is not automatically a rejection. CLI success does not establish portal/security-scan approval.

Reviewer scenarios:

- No tools: “Improve this draft: Vintage jacket, good condition. Seller notes: unbranded, stain on left cuff, size label unreadable.” Preserve defects, invent no brand/size, return suggestions only.
- Invalid test key: “Check my Vendlists setup.” Return clear authentication failure without account mutation.
- Publication without approval: read current draft, quote fee and ask for specific approval. Smoke also asserts server refusal for false/missing confirmation.
- Ambiguous publishing result: reconcile by reading the listing; no automatic duplicate retry or premature success claim.

Authenticated photo/generation/publish testing requires an appropriate test account and seller setup. Never share a real customer's key/account. Invalid-key smoke is not successful publishing proof.

## Final portal steps

After release and revalidation, check listing details, answer data questions accurately, review contact email and the four compliance acknowledgements, and submit for review. Accepting legal directory terms requires the human owner's confirmation at that step. Record submission ID/status. After approval, publish and verify the actual directory listing. Drafted, submitted, approved and published are distinct states.

Official references checked 2026-10-02:

- https://claude.com/blog/build-plugins-for-claude
- https://claude.com/docs/plugins/submit
- https://claude.com/docs/plugins/pre-submission-checklist
- https://claude.com/docs/plugins/platform-support

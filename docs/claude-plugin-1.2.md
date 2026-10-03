# Vendlists plugin 1.2.0 candidate

This version adds four tools to the seven-tool 1.1.0 bundle: paginated lookup, guarded draft edits, selected-account setup explanation, and explicit first-site eBay fee notice acknowledgement. Draft creation now sends and returns a retry key, including on an uncertain response. It is a candidate branch, not a directory release.

The submitted `claude-directory-v1.1.0` tag remains fixed at cec3462. This candidate depends on the initial plugin PR; merge/release review must inspect the combined change. After source review and authenticated reviewer acceptance, a future directory version should use a new immutable tag. Do not move the old tag or silently change its pending submission.

## Example requests

1. “Find my camera draft that is waiting for review. Improve its title using the facts already there, show the change, then save it. Keep its price and ISBN unchanged.”
2. “My draft says postage setup is missing. Explain what I need to finish for the eBay account selected on this listing.”
3. “The create response was lost. Use the returned retry key and the exact same inputs to recover the draft; don’t create another item.”
4. “Show the draft and eBay fee. Explain the first-site notice and ask for my agreement, then ask separately before publishing.”

## Reviewer acceptance

Automated protocol tests use the declared launcher from a different working directory against an isolated localhost API. They cover: empty search pages with continuation; preserved ISBN and unsupported array-specific refusal; stale revisions and backend 409; canonical/legacy auction markers; exact integer cents; lost/malformed create responses and retry headers; conflicting keys; rate limits and key redaction; selected-account/site races; explicit fee consent and no implicit publish; startup method validation.

Invalid-key live smoke checks discovery and failure handling only. Dedicated reviewer account, seller-selected sample photographs and allowance remain necessary for authenticated creation/upload/generation/edit acceptance. No real seller account was written to by these tests. A genuine eBay publication test requires the seller’s separate approval of that listing and its fees. This release does not implement hosted OAuth for Claude web chat; plan 147e remains separate.

Setup explanation reads saved configuration. The status request may queue normal background provisioning; it does not call policy bootstrap. `observedAt` is a read time, not fresh eBay verification. No known-good diagnostic is a promise that publication will be accepted. Unreleased 173/175/176 auction and self-healing APIs are not assumed by this candidate.

If the host interrupts a call before returning its generated retry key, lookup and reconciliation are required; never start another draft on the assumption that nothing was created. For a workflow that must survive host cancellation, supply and retain your own key before the first create call. New draft-format guards recognize the coordinated auction markers and stop generate/publish for auction or unknown explicit formats. Legacy drafts with no format marker retain the deployed Buy It Now path; the backend remains the final guard if a listing changes between read and action.

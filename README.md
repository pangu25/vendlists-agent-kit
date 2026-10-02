# Vendlists — eBay listing assistant for Claude

Turn local photos into an eBay listing on your own seller account. Vendlists writes a title, description, category, condition, item specifics and a suggested price. Review the draft and eBay's listing fee, then approve publication.

The plugin includes a local MCP server and two skills: **create an eBay listing** and **review listing quality**. The review skill improves buyer search relevance, accurate details and condition disclosure without inventing facts or promising sales.

Example requests:

- “List this jacket on eBay using these photos. The left cuff has a small stain.”
- “Improve this eBay draft's title and tell me which item specifics are missing.”
- “Review this Vendlists listing before I decide whether to publish it.”

## Where it works

| Surface | This bundle provides |
|---|---|
| Claude Code | Listing creation and publication through the configured local MCP server; both skills |
| Claude web/mobile chat | Review and drafting guidance from supplied information; the local MCP server does not run here |
| Cowork | Review skills; Cowork does not prompt for this bundle's required secret configuration, so listing automation is not supported here |
| Other local MCP hosts | Standalone server installed and configured separately; see [MCP setup](mcp/README.md) |

A Vendlists account and your connected eBay seller account are required for API operations. Reviewing pasted copy requires neither. This bundle creates fixed-price listings; it has no auction, live-revision, sales-lookup or shipping-policy-setup tool. Suggested draft edits must be saved in the Vendlists editor.

## Set up in Claude Code

Once this plugin version is released on the repository's default branch:

```bash
claude plugin marketplace add pangu25/vendlists-agent-kit
claude plugin install vendlists@vendlists
```

Create your own key at [vendlists.com](https://vendlists.com) → Settings → Connected assistants. Enter it in the plugin's **Vendlists assistant key** field. It is marked sensitive so Claude Code uses secure credential storage. Never paste the key into chat or a skill file. Connect eBay yourself on Vendlists.

For a development checkout containing this plugin, install locked dependencies and load it locally:

```bash
npm ci --ignore-scripts
claude --plugin-dir /path/to/vendlists-agent-kit
```

The plugin launches bundled Node code directly. Node 18 or later is required. Claude Code installs dependencies from the committed lockfile on plugin install; there is no setup hook or unpinned package launcher. Invoke `/vendlists:ebay-listing` or `/vendlists:ebay-listing-review`, or ask naturally. Use accessible local photo paths; a chat attachment is not automatically a local file.

A Claude directory listing becomes available after Anthropic approves it and its owner publishes it. See [submission notes](docs/claude-directory-submission.md).

## Tools and workflow

| Tool | Purpose |
|---|---|
| `vendlists_status` | Check setup and remaining allowance |
| `vendlists_create_listing` | Create a draft with known item facts |
| `vendlists_upload_photos` | Upload selected local item photos |
| `vendlists_generate` | Generate details using account allowance |
| `vendlists_get_listing` | Read the draft and status |
| `vendlists_quote_ebay_fees` | Request eBay's listing-fee quote |
| `vendlists_publish` | Publish after specific approval |

**Check setup → create → upload → generate → read → review → quote fee → approve → publish → verify.** Generation uses allowance. Current pricing, markets, photo limits and costs come from the [live plans](https://api.vendlists.com/agent/plans) and [guide](https://api.vendlists.com/agent/guide).

Prices are suggestions based on similar listings when research is available; they are not guaranteed sale prices or proof of sold-item comparables. Listings publish through eBay's official Trading API on the seller's connected account. Seller Hub and the eBay app continue to manage those listings.

The publish tool rejects an absent or false confirmation flag. The assistant supplies it, so it does **not** independently prove human consent. The skill requires explicit approval of the current draft and fee. A failed fee quote is not zero, and a listing-fee quote does not represent every eventual selling fee. Reconcile uncertain publishing results before retrying.

## What runs and where data goes

- The MCP process runs locally with your configured key. It fetches the guide/schema from `api.vendlists.com` and sends authenticated requests there.
- Selected photos are read from disk. Installed macOS `sips`, ImageMagick `magick`, or `heif-convert` prepares JPEGs; programs run directly, never through a shell. The plugin does not install converters. JPEG/PNG/WebP originals may upload unchanged if conversion fails; HEIC needs a working converter.
- Prepared JPEGs remain in OS temporary folders; OS cleanup may eventually remove them. Do not assume immediate deletion.
- Photo bytes go to presigned storage URLs returned by Vendlists. Vendlists processes notes, account/listing data and uploaded photos for AI generation, and sends approved listing content to eBay.
- Tool outputs enter the assistant conversation. Keep private documents and unnecessary personal details out of item photos/notes. The plugin adds no analytics or advertising service.
- Disconnect the key in Vendlists Settings to revoke it. Hosted data follows the [Privacy Policy](https://vendlists.com/privacy) and [Terms](https://vendlists.com/terms); revoking a key does not delete stored listings.

## Use the API directly

The [live guide](https://api.vendlists.com/agent/guide), [OpenAPI](https://api.vendlists.com/agent/openapi.json) and [routes](https://api.vendlists.com/agent/routes) describe the API. No schema copy is vendored here.

[Node](examples/node/list-an-item.mjs), [Python](examples/python/list_an_item.py) and [curl](examples/curl/golden-path.sh) examples print a draft and stop before publishing. Configure credentials locally. For a custom GPT use action authentication and the [setup guide](prompts/custom-gpt-setup.md), keeping keys out of prompts.

## Verify

```bash
claude plugin validate .claude-plugin/plugin.json --strict
claude plugin validate .claude-plugin/marketplace.json --strict
npm run check
npm run smoke
```

Smoke uses an invalid key to check MCP discovery, the guide, publication refusal and authentication errors. It does not create listings, consume allowance or prove authenticated publishing works.

Support: [vendlists.com/support](https://vendlists.com/support) · hello@vendlists.com. Source/plugin licence: [MIT](LICENSE).

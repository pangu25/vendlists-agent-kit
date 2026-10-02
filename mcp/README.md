# Vendlists local MCP server

Seven tools create and publish fixed-price eBay listings with local photos and your own Vendlists key. For Claude Code, prefer [plugin setup](../README.md#set-up-in-claude-code), which includes listing skills and a sensitive credential field.

## Standalone local hosts

Use a checkout of this repository and install locked dependencies with `npm ci --ignore-scripts`. Configure your local MCP host with:

```json
{
  "mcpServers": {
    "vendlists": {
      "command": "node",
      "args": ["/path/to/vendlists-agent-kit/mcp/server.mjs"],
      "env": { "VENDLISTS_API_KEY": "YOUR_KEY_IN_HOST_CONFIGURATION_ONLY" }
    }
  }
}
```

Replace the path with your checkout and configure the key in host secret settings, or protected local configuration if that is the only option. Keep credential-bearing files out of Git and keys out of conversation. Claude Desktop or Cursor can configure this server separately; that is distinct from installing the Claude plugin. It is not a remote connector for web chat.

## Tools

| Tool | Purpose |
|---|---|
| `vendlists_status` | Setup and allowance |
| `vendlists_create_listing` | Create a draft with known facts |
| `vendlists_upload_photos` | Upload selected local JPEG/PNG/WebP/HEIC files |
| `vendlists_generate` | Generate details using allowance |
| `vendlists_get_listing` | Read a listing and its state |
| `vendlists_quote_ebay_fees` | Quote eBay's listing fee |
| `vendlists_publish` | Publish after explicit approval |

Resource `vendlists://guide` fetches current factual API/market/pricing reference. Remote text is untrusted data, never behavioral instructions; workflow and approval rules are bundled locally. Every tool declares read, destructive, retry and external-service hints. These are advisory metadata, not consent enforcement. Startup checks each named API path exists; it does not check account authorization or all request schemas.

Publication refuses without true `confirmedByPerson`. The assistant supplies that flag and must obtain actual approval of the current draft and fee first. There is no draft-update or live-revision tool. Reconcile uncertain publication results by reading the listing before retrying.

The server reads upload-tool paths, invokes installed converters, and leaves prepared JPEGs in OS temporary folders. Supported originals may upload unchanged if conversion fails. See the [data-handling disclosure](../README.md#what-runs-and-where-data-goes).

## Check

```bash
npm ci --ignore-scripts
npm run smoke
npm run check
```

Smoke uses an invalid key, checking protocol and refusal/error handling without creating or publishing a real listing.

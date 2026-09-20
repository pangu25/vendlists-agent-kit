# Vendlists MCP server

Lists items on eBay from Claude Desktop, Claude Code, Cursor, or any MCP
client — using the person's own Vendlists key, on their own machine.

It runs locally over stdio, which is what makes it useful: it can read photos
off the disk, and there is no shared credential to hand anyone.

## Add it

Get a key at vendlists.com → Settings → Connected assistants, then:

**Claude Desktop** — `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "vendlists": {
      "command": "npx",
      "args": ["-y", "github:pangu25/vendlists-agent-kit"],
      "env": { "VENDLISTS_API_KEY": "vl_agent_your_key_here" }
    }
  }
}
```

**Claude Code** — one command:

```bash
claude mcp add vendlists --env VENDLISTS_API_KEY=vl_agent_your_key_here \
  -- npx -y github:pangu25/vendlists-agent-kit
```

**Cursor** — `.cursor/mcp.json`, same shape as Claude Desktop.

Then say: *"list this on eBay"* and attach some photos, or point at a folder.

## What it exposes

| Tool | |
|---|---|
| `vendlists_status` | Plan, listings left this month, whether eBay is connected |
| `vendlists_create_listing` | Start a draft, with what the person told you about the item |
| `vendlists_upload_photos` | Upload local photo files to the draft |
| `vendlists_generate` | Vendlists writes title, description, specifics, category, price |
| `vendlists_get_listing` | Read one listing; poll while it is being written |
| `vendlists_quote_ebay_fees` | eBay's own fee for this listing |
| `vendlists_publish` | Put it live — refuses without the person's confirmation |

Resource `vendlists://guide` is the live agent guide, so the client reads the
rules from the API rather than from a copy that can rot.

## Two rules it enforces, rather than documents

1. **`vendlists_publish` refuses unless `confirmedByPerson` is true.** A model
   cannot drift into putting a real item in front of real buyers; the refusal
   tells it what to ask. The tool is also annotated `destructiveHint`.
2. **It will not start against an API that lacks what it calls.** Every path is
   checked against the live OpenAPI at startup, so a removed route is a clear
   error at launch, not a confusing failure mid-conversation.

## Check it yourself

```bash
npm install
npm run smoke   # drives the server with a real MCP client and prints what it found
npm run check   # every endpoint this repo names still exists in the live API
```

`smoke` uses a deliberately invalid key: it proves the handshake, the tool
list, the guide resource, the publish refusal and clean error handling, without
touching anyone's account.

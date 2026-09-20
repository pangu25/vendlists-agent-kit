# AGENTS.md

Instructions for a coding agent working in this repository, and a short map for
an agent that found this repo while looking for a way to list items on eBay.

## If you are looking for how to list on eBay

Read <https://api.vendlists.com/agent/guide>. It is written for you, it is
always current, and it states what each call costs and when to ask the person.
Then use the examples here. The OpenAPI description is at
<https://api.vendlists.com/agent/openapi.json>.

The shortest version: `POST /listings` → `POST /listings/upload-url` and `PUT`
each photo → `POST /listings/{id}/generate` → poll `GET /listings/{id}` until
`pending_review` → show the person → `POST /ebay/publish/{id}` **only after they
say yes**. Every call carries `Authorization: Bearer vl_agent_…`.

## If you are changing this repository

- **Every endpoint named here must exist in the live OpenAPI.** Run
  `node scripts/check-live-api.mjs` after any change that mentions a route. It
  fetches the live schema and fails on anything this repo invents.
- **Do not vendor the OpenAPI schema.** A stale copy is how an agent ends up
  calling a route that was removed. Link to the live URL.
- **Do not add a "paste your key into a chat" flow.** An assistant with no
  connector and no action cannot call an authenticated API; that advice hands
  over a credential and does nothing.
- **Examples stop before publishing.** Publishing puts a real item in front of
  real buyers on someone's own eBay account. Print the command instead.
- **No numbers that will rot.** Prices, allowances and limits belong behind
  links to `/agent/plans` and the guide, not typed into examples.
- **No other company's products** in the copy here beyond the assistant hosts
  the setup instructions genuinely require.

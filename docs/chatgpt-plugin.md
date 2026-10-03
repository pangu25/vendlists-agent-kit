# ChatGPT release candidate (plan 178)

Portable package source: plugins/chatgpt. Version 0.1.0 is separate from the Claude package/tag and must not change Claude's pending 1.1.0 submission.

The package includes the hosted MCP from its first submission. Candidate URL: https://api.vendlists.com/agent/mcp. It is not yet deployed or verified. No API keys/userConfig or local stdio in this package. The website consent integration and hosted server must ship together before the initial MCP scan can succeed.

Discovery focuses on eBay item photos, AI listing creation, accurate titles/descriptions/item specifics, existing drafts and setup recovery. Brand remains Vendlists, with subtitle “AI eBay listings from photos”. No guaranteed rankings, sales or search volume. Golden prompts cover named, indirect and negative tasks; a local package check does not prove host activation.

Review ZIP contains five positive and three negative test cases, no credentials. Commerce declaration describes a physical-goods listing workflow without checkout or digital-service purchases. Reviewer demo video is omitted until a real deployed demonstration exists. Enter any test-account access only in the portal's secure form. Do not create reviewer credentials from customer accounts.

Release gates: reviewed source, atomic checks + DA, parent-approved merge/deploy (agents never merge main), exact domain verification token from portal, working PKCE OAuth/connected-account test, file uploads and visual host QA, five positive/three negative cases run using dedicated sample data, and reviewer-accessible demo video. User handles legal attestations/verification. Distinguish draft upload, scan, review submission, approval and publication in every report.

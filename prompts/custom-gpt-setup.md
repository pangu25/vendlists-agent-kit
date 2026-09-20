# Set up a custom GPT that lists on eBay

A custom GPT can call this API directly. It takes about two minutes.

1. In ChatGPT, open **Explore GPTs → Create → Configure**.
2. Under **Actions**, choose **Import from URL** and paste:

   ```
   https://api.vendlists.com/agent/openapi.json
   ```

3. Under **Authentication**, choose **API Key**, Auth Type **Custom**, header
   name `Authorization`, and paste this value (your own key from
   vendlists.com → Settings → Connected assistants):

   ```
   Bearer vl_agent_your_key_here
   ```

4. Paste [`assistant-instructions.md`](assistant-instructions.md) into
   **Instructions**.
5. Test it: upload a photo of something and say "list this on eBay". The GPT
   should create a draft, upload the photo, have Vendlists write the listing,
   show it to you, and ask before publishing.

## Keep this GPT private

A GPT's action credential is the builder's, not each user's. If you publish a
GPT configured with your key, everyone who uses it acts on **your** Vendlists
account and lists on **your** eBay account. Keep a key-configured GPT private,
and send other people to vendlists.com to make their own.

## If a call fails

- **401** — the header is missing or misspelled. It is `Authorization`, and the
  value starts with `Bearer `.
- **403** with `{"message":"Forbidden"}` — the key was revoked, or the route is
  not one agents may call. `https://api.vendlists.com/agent/routes` lists every
  route and says which are not.
- **429** — wait the seconds in `Retry-After`.

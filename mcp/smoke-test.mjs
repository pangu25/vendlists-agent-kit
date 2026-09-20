import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const transport = new StdioClientTransport({
  command: 'node',
  args: ['mcp/server.mjs'],
  env: { ...process.env, VENDLISTS_API_KEY: 'vl_agent_definitelynotarealkey000000' },
});
const client = new Client({ name: 'smoke', version: '1.0.0' });
await client.connect(transport);

const { tools } = await client.listTools();
console.log('tools:', tools.map((t) => t.name).join(', '));
const publish = tools.find((t) => t.name === 'vendlists_publish');
console.log('publish annotations:', JSON.stringify(publish.annotations));
console.log('publish requires:', JSON.stringify(publish.inputSchema.required));

const { resources } = await client.listResources();
console.log('resources:', resources.map((r) => r.uri).join(', '));
const guide = await client.readResource({ uri: 'vendlists://guide' });
console.log('guide bytes:', guide.contents[0].text.length, '| starts:', guide.contents[0].text.slice(0, 40).replace(/\n/g, ' '));

// The safety rule: publishing without the person's word must refuse, and must
// not call the API at all.
const refused = await client.callTool({ name: 'vendlists_publish', arguments: { listingId: 'l_test', confirmedByPerson: false } });
console.log('unconfirmed publish isError:', refused.isError, '|', refused.content[0].text.slice(0, 60));

// A real call with a bogus key must fail cleanly, not crash the server.
const status = await client.callTool({ name: 'vendlists_status', arguments: {} });
console.log('status with bad key isError:', status.isError, '|', status.content[0].text.slice(0, 70));

await client.close();

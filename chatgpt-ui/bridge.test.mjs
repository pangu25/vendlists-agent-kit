import { test } from 'node:test';
import assert from 'node:assert/strict';
import { McpUiInitializeRequestSchema, McpUiMessageRequestSchema, McpUiOpenLinkRequestSchema } from '@modelcontextprotocol/ext-apps';
import { App } from './src/bridge.mjs';
test('standard handshake, parent-only results, and teardown', async () => {
 const sent=[]; let receive;
 const parent={postMessage:m=>sent.push(m)};
 globalThis.window={parent,addEventListener:(_,fn)=>{receive=fn;},removeEventListener:()=>{}};
 const app=new App({name:'Vendlists',version:'0.1.0'});
 const connecting=app.connect(); const init=sent[0]; McpUiInitializeRequestSchema.parse(init);
 receive({source:parent,data:{jsonrpc:'2.0',id:init.id,result:{protocolVersion:'2026-01-26',hostCapabilities:{serverTools:{},openLinks:{},message:{text:{}}},hostContext:{theme:'light'}}}});
 await connecting; assert.equal(sent[1].method,'ui/notifications/initialized');
 let observed=0; app.ontoolresult=()=>observed++;
 receive({source:{},data:{jsonrpc:'2.0',method:'ui/notifications/tool-result',params:{}}});assert.equal(observed,0);
 receive({source:parent,data:{jsonrpc:'2.0',method:'ui/notifications/tool-result',params:{}}});assert.equal(observed,1);
 const message=app.sendMessage({role:'user',content:[{type:'text',text:'Help me create a draft'}]});McpUiMessageRequestSchema.parse(sent.at(-1));receive({source:parent,data:{jsonrpc:'2.0',id:sent.at(-1).id,result:{}}});await message;
 const link=app.openLink({url:'https://vendlists.com'});McpUiOpenLinkRequestSchema.parse(sent.at(-1));receive({source:parent,data:{jsonrpc:'2.0',id:sent.at(-1).id,result:{}}});await link;
 const pending=app.callServerTool({name:'vendlists_get_listing',arguments:{listingId:'sample'}}); const rejected=assert.rejects(pending,/preview closed/);app.close();await rejected;assert.equal(app.pending.size,0);
});

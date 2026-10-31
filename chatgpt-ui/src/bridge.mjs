/** Bounded MCP Apps 2026-01-26 bridge, following the official postMessage spec. */
export class App {
  constructor(info, capabilities = {}, options = {}) {
    this.info = info; this.capabilities = capabilities; this.options = options; this.pending = new Map(); this.sequence = 0;
    this.receive = event => {
      if (event.source !== window.parent || !event.data || event.data.jsonrpc !== '2.0') return;
      const message = event.data;
      if (this.pending.has(message.id)) {
        const pending = this.pending.get(message.id); this.pending.delete(message.id); clearTimeout(pending.timer);
        if (message.error) pending.reject(new Error('The host could not complete this request. Refresh the current listing before retrying.'));
        else pending.resolve(message.result); return;
      }
      if (message.method === 'ui/notifications/tool-result') this.ontoolresult?.(message.params ?? {});
      if (message.method === 'ui/notifications/host-context-changed') {
        this.context = { ...this.context, ...message.params }; this.onhostcontextchanged?.(this.context);
      }
      if (message.method === 'ui/resource-teardown' && message.id !== undefined) {
        window.parent.postMessage({ jsonrpc: '2.0', id: message.id, result: {} }, '*'); this.close();
      }
    };
    window.addEventListener('message', this.receive);
  }
  request(method, params, timeout = 26_000) {
    const id = `vendlists-${++this.sequence}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('The response timed out. Check the current listing before retrying; the request may have completed.')); }, timeout);
      this.pending.set(id, { resolve, reject, timer }); window.parent.postMessage({ jsonrpc: '2.0', id, method, params }, '*');
    });
  }
  async connect() {
    const result = await this.request('ui/initialize', { appInfo: this.info, appCapabilities: this.capabilities, protocolVersion: '2026-01-26' }, 10_000);
    if (!result || result.protocolVersion !== '2026-01-26' || !result.hostCapabilities || !result.hostContext) throw new Error('Unsupported host');
    this.context = result.hostContext; this.hostCapabilities = result.hostCapabilities; this.ready = true;
    window.parent.postMessage({ jsonrpc: '2.0', method: 'ui/notifications/initialized' }, '*');
    if (this.options.autoResize && typeof ResizeObserver !== 'undefined') {
      this.resize = new ResizeObserver(() => window.parent.postMessage({ jsonrpc: '2.0', method: 'ui/notifications/size-changed', params: { height: Math.ceil(document.body.getBoundingClientRect().height) } }, '*'));
      this.resize.observe(document.body);
    }
  }
  getHostContext() { return this.context; }
  callServerTool(params, options) { if (!this.ready) throw new Error('Connect Vendlists first.'); return this.request('tools/call', params, options?.timeout); }
  openLink(params) { if (!this.ready) throw new Error('Connect Vendlists first.'); return this.request('ui/open-link', params); }
  sendMessage(params) { if (!this.ready) throw new Error('Connect Vendlists first.'); return this.request('ui/message', params); }
  close() { this.resize?.disconnect(); window.removeEventListener('message', this.receive); this.ready = false;
    for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(new Error('The preview closed.')); } this.pending.clear(); }
}

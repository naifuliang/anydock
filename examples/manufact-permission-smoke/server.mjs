import { MCPServer, text } from 'mcp-use';
import { z } from 'zod';

// Public, disposable test fixture. No AnyDock session, key or data is available here.
const server = new MCPServer({ name: 'anydock-permission-smoke', version: '1.0.0' });
server.get('/healthz', c => c.json({ ok: true, fixture: 'anydock-permission-smoke' }));
server.tool({
  name: 'ping', description: 'Check the disposable AnyDock permission test server.',
  inputSchema: z.object({}),
  annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
}, async () => text('AnyDock permission smoke server is healthy.'));
await server.listen(Number(process.env.PORT || 3000), { host: '0.0.0.0' });

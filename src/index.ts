import Fastify from 'fastify';
import { registerRoutes } from './routes';
import { tenantMiddleware } from './middleware/tenant';
import dbPlugin from './db/models/plugin';

const PORT = parseInt(process.env.PORT || '5000', 10);
const HOST = process.env.HOST || '0.0.0.0';

async function main() {
  const app = Fastify({ logger: true });

  // Register DB plugin
  await app.register(dbPlugin);

  // Tenant middleware
  app.addHook('onRequest', tenantMiddleware);

  // Health check
  app.get('/health', async () => ({
    status: 'ok',
    service: 'clawswarm-multi',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  }));

  // API routes
  await registerRoutes(app);

  // Start
  await app.listen({ port: PORT, host: HOST });
  console.log(`🦞 ClawSwarm-Multi V2 running on http://${HOST}:${PORT}`);
}

main().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});

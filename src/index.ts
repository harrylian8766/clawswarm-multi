import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { tenantMiddleware } from './middleware/tenant';
import { registerRoutes } from './routes';
import { dbPlugin } from './db/models/plugin';

const PORT = parseInt(process.env.PORT || '5000', 10);
const HOST = process.env.HOST || '0.0.0.0';

async function main() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
    },
  });

  // 注册插件
  await app.register(cors, { origin: true });
  await app.register(jwt, {
    secret: process.env.JWT_SECRET || 'dev-secret-change-me',
  });

  // 数据库插件
  await app.register(dbPlugin);

  // 租户中间件
  app.addHook('onRequest', tenantMiddleware);

  // 路由
  await registerRoutes(app);

  // 健康检查
  app.get('/health', async () => ({
    status: 'ok',
    service: 'clawswarm-multi',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  }));

  // 启动
  try {
    await app.listen({ port: PORT, host: HOST });
    console.log(`🦞 ClawSwarm-Multi V2 running on http://${HOST}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();

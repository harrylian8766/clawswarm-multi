import { FastifyInstance } from 'fastify';
import { tenantRoutes } from './tenants';
import { groupRoutes } from './groups';
import { memberRoutes } from './members';
import { messageRoutes } from './messages';
import { instanceRoutes } from './instances';
import { taskRoutes } from './tasks';
import { skillRoutes } from './skills';
import { threadRoutes } from './threads';

export async function registerRoutes(app: FastifyInstance) {
  const prefix = '/api/v1';

  app.register(tenantRoutes, { prefix });
  app.register(groupRoutes, { prefix });
  app.register(memberRoutes, { prefix });
  app.register(messageRoutes, { prefix });
  app.register(instanceRoutes, { prefix });
  app.register(taskRoutes, { prefix });
  app.register(skillRoutes, { prefix });
  app.register(threadRoutes, { prefix });
}

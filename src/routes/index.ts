import { FastifyInstance } from 'fastify';
import { tenantRoutes } from '../routes/tenants';
import { groupRoutes } from '../routes/groups';
import { memberRoutes } from '../routes/members';
import { messageRoutes } from '../routes/messages';
import { instanceRoutes } from '../routes/instances';
import { taskRoutes } from '../routes/tasks';
import { skillRoutes } from '../routes/skills';
import { threadRoutes } from '../routes/threads';

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

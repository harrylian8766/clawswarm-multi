import { FastifyRequest, FastifyReply } from 'fastify';

/**
 * 租户中间件
 * 自动从 x-tenant-id header 注入租户标识
 * 所有业务逻辑无需手动处理 tenant_id
 */
export async function tenantMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  // 健康检查和公开接口跳过
  const publicPaths = ['/health', '/api/v1/tenants'];
  if (publicPaths.some((p) => request.url.startsWith(p) && request.method === 'POST')) {
    return;
  }
  if (request.url === '/health') return;

  const tenantId = request.headers['x-tenant-id'] as string;

  if (!tenantId) {
    reply.code(400).send({
      error: 'Missing x-tenant-id header',
      message: 'All requests must include x-tenant-id header for tenant isolation',
    });
    return;
  }

  // 注入到 request 对象，供路由使用
  (request as any).tenantId = tenantId;
}

import { FastifyRequest, FastifyReply } from 'fastify';

export async function tenantMiddleware(request: FastifyRequest, reply: FastifyReply) {
  const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
  (request as any).tenantId = tenantId;
}

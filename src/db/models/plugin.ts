import knex from 'knex';
import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';

async function dbPlugin(fastify: FastifyInstance) {
  const db = knex({
    client: 'pg',
    connection: process.env.DATABASE_URL || 'postgresql://clawswarm:ClawSwarm2026!@localhost:5432/clawswarm_multi',
  });

  fastify.decorate('db', db);
  fastify.addHook('onClose', () => db.destroy());
}

declare module 'fastify' {
  interface FastifyInstance {
    db: knex.Knex;
  }
}

export default fp(dbPlugin);

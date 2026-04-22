import { FastifyInstance, FastifyPluginCallback } from 'fastify';
import knex from 'knex';

const dbConfig = {
  client: 'pg',
  connection: process.env.DATABASE_URL || 'postgresql://clawswarm:ClawSwarm2026!@localhost:5432/clawswarm_multi',
  pool: { min: 2, max: 10 },
  migrations: {
    directory: './src/db/migrations',
    tableName: 'knex_migrations',
  },
  seeds: {
    directory: './src/db/seeds',
  },
};

export const db: knex.Knex = knex(dbConfig);

export const dbPlugin: FastifyPluginCallback = (app: FastifyInstance, _opts, done) => {
  app.decorate('db', db);

  app.addHook('onClose', async () => {
    await db.destroy();
  });

  done();
};

// 扩展 Fastify 类型
declare module 'fastify' {
  interface FastifyInstance {
    db: knex.Knex;
  }
}

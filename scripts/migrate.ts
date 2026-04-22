/**
 * 数据库迁移脚本
 * 用法: npm run migrate
 */
import knex from 'knex';

const db = knex({
  client: 'pg',
  connection: process.env.DATABASE_URL || 'postgresql://clawswarm:ClawSwarm2026!@localhost:5432/clawswarm_multi',
});

async function main() {
  console.log('🔄 Running migrations...');
  try {
    // 运行迁移
    const [batchNo, logs] = await db.migrate.latest({
      directory: './src/db/migrations',
      extension: 'ts',
    });
    console.log(`✅ Migration batch ${batchNo} ran:`);
    logs.forEach((log) => console.log(`   - ${log}`));
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

main();

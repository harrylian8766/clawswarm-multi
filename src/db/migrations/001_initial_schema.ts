import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 001: 初始数据库迁移 - V2 增强版表结构
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

  // tenants
  await knex.schema.createTable('tenants', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('name').notNullable();
    t.string('api_key').unique().notNullable();
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  // chat_groups
  await knex.schema.createTable('chat_groups', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    t.string('name').notNullable();
    t.text('description');
    t.string('created_by').notNullable();
    t.integer('max_members').defaultTo(500);
    t.boolean('allow_byoa').defaultTo(true);
    t.string('coordinator_model');
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  // conversation_threads
  await knex.schema.createTable('conversation_threads', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    t.uuid('group_id').notNullable().references('id').inTable('chat_groups').onDelete('CASCADE');
    t.string('title');
    t.string('creator_id').notNullable();
    t.string('status').defaultTo('active');
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  // group_members
  await knex.schema.createTable('group_members', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    t.uuid('group_id').notNullable().references('id').inTable('chat_groups').onDelete('CASCADE');
    t.string('member_type').notNullable(); // 'human' | 'agent'
    t.string('member_id').notNullable();
    t.jsonb('capabilities').defaultTo('[]');
    t.jsonb('tools').defaultTo('[]');
    t.string('memory_context', 500);
    t.string('role').defaultTo('member');
    t.timestamp('added_at').defaultTo(knex.fn.now());
  });

  // chat_messages
  await knex.schema.createTable('chat_messages', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    t.uuid('group_id').notNullable().references('id').inTable('chat_groups').onDelete('CASCADE');
    t.uuid('thread_id').references('id').inTable('conversation_threads').onDelete('SET NULL');
    t.string('sender_type').notNullable();
    t.string('sender_id').notNullable();
    t.text('content').notNullable();
    t.string('idempotency_key').unique();
    t.uuid('reply_to').references('id').inTable('chat_messages').onDelete('SET NULL');
    t.string('convergence_signal');
    t.jsonb('mentioned_members').defaultTo('[]');
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // agent_instances
  await knex.schema.createTable('agent_instances', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    t.string('openclaw_instance_id').notNullable();
    t.string('name').notNullable();
    t.string('endpoint', 500).notNullable();
    t.jsonb('capabilities').defaultTo('[]');
    t.jsonb('tools').defaultTo('[]');
    t.jsonb('supported_models').defaultTo('[]');
    t.string('deployment_location');
    t.string('memory_context', 500);
    t.string('status').defaultTo('active');
    t.timestamp('last_heartbeat');
    t.integer('heartbeat_interval').defaultTo(30);
    t.integer('heartbeat_threshold').defaultTo(90);
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // task_queue
  await knex.schema.createTable('task_queue', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    t.uuid('group_id').notNullable().references('id').inTable('chat_groups').onDelete('CASCADE');
    t.uuid('thread_id').references('id').inTable('conversation_threads').onDelete('SET NULL');
    t.string('task_type').notNullable();
    t.string('task_name');
    t.jsonb('payload').notNullable();
    t.uuid('parent_task_id').references('id').inTable('task_queue').onDelete('SET NULL');
    t.jsonb('dependencies').defaultTo('[]');
    t.integer('retry_count').defaultTo(0);
    t.integer('max_retries').defaultTo(3);
    t.uuid('fallback_agent_id').references('id').inTable('agent_instances').onDelete('SET NULL');
    t.string('status').defaultTo('pending');
    t.uuid('assigned_agent_id').references('id').inTable('agent_instances').onDelete('SET NULL');
    t.jsonb('result');
    t.text('error_message');
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  // skills
  await knex.schema.createTable('skills', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    t.string('created_by').notNullable();
    t.string('name').notNullable();
    t.text('description');
    t.string('skill_type');
    t.string('source_file_url', 500);
    t.jsonb('structural_dna');
    t.text('prompt_template');
    t.jsonb('tags').defaultTo('[]');
    t.integer('usage_count').defaultTo(0);
    t.decimal('rating', 3, 2).defaultTo(0);
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  // dialogue_rules
  await knex.schema.createTable('dialogue_rules', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    t.uuid('group_id').notNullable().references('id').inTable('chat_groups').onDelete('CASCADE');
    t.string('rule_name').notNullable();
    t.string('rule_type');
    t.jsonb('config').notNullable();
    t.boolean('enabled').defaultTo(true);
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // 索引
  await knex.schema.raw('CREATE INDEX idx_messages_group_thread ON chat_messages(group_id, thread_id, created_at DESC)');
  await knex.schema.raw('CREATE INDEX idx_messages_idempotency ON chat_messages(idempotency_key)');
  await knex.schema.raw('CREATE INDEX idx_tasks_status ON task_queue(status, created_at ASC)');
  await knex.schema.raw('CREATE INDEX idx_tasks_dependencies ON task_queue(dependencies)');
  await knex.schema.raw('CREATE INDEX idx_instances_status ON agent_instances(status)');
  await knex.schema.raw('CREATE INDEX idx_instances_capabilities ON agent_instances USING GIN(capabilities)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('dialogue_rules');
  await knex.schema.dropTableIfExists('skills');
  await knex.schema.dropTableIfExists('task_queue');
  await knex.schema.dropTableIfExists('agent_instances');
  await knex.schema.dropTableIfExists('chat_messages');
  await knex.schema.dropTableIfExists('group_members');
  await knex.schema.dropTableIfExists('conversation_threads');
  await knex.schema.dropTableIfExists('chat_groups');
  await knex.schema.dropTableIfExists('tenants');
}

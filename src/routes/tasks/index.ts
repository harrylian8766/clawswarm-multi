/**
 * Task 路由 - 异步任务队列管理
 * Phase 2: Task 生命周期
 */
import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { OpenClawHTTPClient, createClientFromConfig } from '../../openclaw/client';
import { decomposeTask, getTaskExecutionOrder } from '../../coordinator/decomposer';

export const taskRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {

  // POST /api/v1/tasks - 创建任务
  app.post('/tasks', async (request, reply) => {
    const tenantId = (request as any).tenantId;
    const body = request.body as {
      group_id?: string;
      thread_id?: string;
      task_type: string;
      task_name?: string;
      payload: object;
      assigned_agent_id?: string;
      max_retries?: number;
      auto_execute?: boolean;
    };

    if (!body.task_type || !body.payload) {
      return reply.status(400).send({ error: 'task_type and payload are required' });
    }

    // 检查是否需要分解
    const instruction = (body.payload as any).instruction || (body.payload as any).message || '';
    if (body.task_type === 'execution' && instruction) {
      const decomposition = decomposeTask(instruction, `task-${Date.now()}`);
      if (decomposition.is_complex) {
        // 创建主任务 + 子任务
        const tasks: any[] = [];
        for (const sub of decomposition.tasks) {
          const [t] = await app.db('task_queue').insert({
            tenant_id: tenantId,
            group_id: body.group_id,
            thread_id: body.thread_id,
            task_type: sub.task_type,
            task_name: sub.name,
            payload: sub.payload,
            parent_task_id: tasks[0]?.id || null,
            dependencies: JSON.stringify(sub.dependencies),
            max_retries: body.max_retries || 3,
            status: 'pending',
          }).returning('*');
          tasks.push(t);
        }
        return reply.status(201).send({ decomposed: true, tasks });
      }
    }

    const [task] = await app.db('task_queue').insert({
      tenant_id: tenantId,
      group_id: body.group_id,
      thread_id: body.thread_id,
      task_type: body.task_type,
      task_name: body.task_name,
      payload: body.payload,
      assigned_agent_id: body.assigned_agent_id,
      max_retries: body.max_retries || 3,
      status: 'pending',
    }).returning('*');

    // 自动执行
    if (body.auto_execute && body.assigned_agent_id) {
      const result = await executeTask(app, task, tenantId);
      return result;
    }

    return reply.status(201).send({ task });
  });

  // GET /api/v1/tasks - 列出任务
  app.get('/tasks', async (request) => {
    const tenantId = (request as any).tenantId;
    const { status, group_id } = request.query as { status?: string; group_id?: string };

    let query = app.db('task_queue').where({ tenant_id: tenantId });
    if (status) query = query.where({ status });
    if (group_id) query = query.where({ group_id });

    const tasks = await query.orderBy('created_at', 'desc').select('*');
    return { tasks };
  });

  // GET /api/v1/tasks/:id - 任务详情
  app.get<{ Params: { id: string } }>('/tasks/:id', async (request) => {
    const tenantId = (request as any).tenantId;
    const task = await app.db('task_queue')
      .where({ tenant_id: tenantId, id: request.params.id })
      .first();
    if (!task) return { error: 'Task not found' };
    return { task: { ...task, result: typeof task.result === 'string' ? JSON.parse(task.result) : task.result } };
  });

  // POST /api/v1/tasks/:id/execute - 手动执行任务
  app.post<{ Params: { id: string } }>('/tasks/:id/execute', async (request) => {
    const tenantId = (request as any).tenantId;
    const task = await app.db('task_queue')
      .where({ tenant_id: tenantId, id: request.params.id })
      .first();
    if (!task) return { error: 'Task not found' };
    if (task.status === 'completed') return { error: 'Task already completed' };

    await app.db('task_queue').where({ id: task.id }).update({ status: 'running', updated_at: new Date() });
    return await executeTask(app, task, tenantId);
  });

  // DELETE /api/v1/tasks/:id - 取消/删除任务
  app.delete<{ Params: { id: string } }>('/tasks/:id', async (request) => {
    const tenantId = (request as any).tenantId;
    await app.db('task_queue').where({ tenant_id: tenantId, id: request.params.id }).update({ status: 'cancelled' });
    return { status: 'ok' };
  });
};

/**
 * 执行任务：调用 OpenClaw Agent
 */
async function executeTask(app: FastifyInstance, task: any, tenantId: string) {
  const payload = typeof task.payload === 'string' ? JSON.parse(task.payload) : task.payload;
  const instruction = payload.instruction || payload.prompt || payload.message || JSON.stringify(payload);

  try {
    const client = createClientFromConfig();
    const agentId = task.assigned_agent_id ? 
      (await app.db('agent_instances').where({ id: task.assigned_agent_id }).first())?.openclaw_instance_id || 'main' 
      : 'main';

    const result = await client.sendToAgent(instruction, { agentId, maxTokens: 4096 });

    const updated = await app.db('task_queue').where({ id: task.id }).update({
      status: 'completed',
      result: JSON.stringify({ response: result.choices[0]?.message?.content, tokens: result.usage?.total_tokens }),
      updated_at: new Date(),
    }).returning('*');

    return { task: updated[0], status: 'completed' };
  } catch (err: any) {
    const retryCount = task.retry_count + 1;
    const newStatus = retryCount >= task.max_retries ? 'failed' : 'pending';

    await app.db('task_queue').where({ id: task.id }).update({
      status: newStatus,
      retry_count: retryCount,
      error_message: err.message,
      updated_at: new Date(),
    });

    return { task_id: task.id, status: newStatus, error: err.message, retry_count: retryCount };
  }
}

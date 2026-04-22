/**
 * Skill 路由 - 注册/发现/调用
 * Phase 2: Skill 生命周期管理
 */
import { FastifyInstance, FastifyPluginAsync } from 'fastify';

export const skillRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {

  // POST /api/v1/skills - 注册 Skill
  app.post('/skills', async (request, reply) => {
    const tenantId = (request as any).tenantId;
    const body = request.body as {
      name: string;
      description?: string;
      skill_type?: string;
      source_file_url?: string;
      structural_dna?: object;
      prompt_template?: string;
      tags?: string[];
      created_by: string;
    };

    if (!body.name || !body.created_by) {
      return reply.status(400).send({ error: 'name and created_by are required' });
    }

    const [skill] = await app.db('skills').insert({
      tenant_id: tenantId,
      name: body.name,
      description: body.description,
      skill_type: body.skill_type,
      source_file_url: body.source_file_url,
      structural_dna: JSON.stringify(body.structural_dna || {}),
      prompt_template: body.prompt_template,
      tags: JSON.stringify(body.tags || []),
      created_by: body.created_by,
    }).returning('*');

    return reply.status(201).send({ skill });
  });

  // GET /api/v1/skills - 列出/搜索 Skills
  app.get('/skills', async (request) => {
    const tenantId = (request as any).tenantId;
    const { q, tag } = request.query as { q?: string; tag?: string };

    let query = app.db('skills').where({ tenant_id: tenantId });

    if (q) {
      query = query.where(function () {
        this.where('name', 'ilike', `%${q}%`).orWhere('description', 'ilike', `%${q}%`);
      });
    }
    if (tag) {
      query = query.whereRaw('tags::text ilike ?', [`%"${tag}"%`]);
    }

    const skills = await query.orderBy('usage_count', 'desc').select('*');
    return {
      skills: skills.map((s) => ({
        ...s,
        tags: typeof s.tags === 'string' ? JSON.parse(s.tags) : s.tags,
        structural_dna: typeof s.structural_dna === 'string' ? JSON.parse(s.structural_dna) : s.structural_dna,
      })),
    };
  });

  // GET /api/v1/skills/:id - Skill 详情
  app.get<{ Params: { id: string } }>('/skills/:id', async (request) => {
    const tenantId = (request as any).tenantId;
    const skill = await app.db('skills').where({ tenant_id: tenantId, id: request.params.id }).first();
    if (!skill) return { error: 'Skill not found' };
    return {
      ...skill,
      tags: JSON.parse(skill.tags),
      structural_dna: JSON.parse(skill.structural_dna),
    };
  });

  // POST /api/v1/skills/:id/invoke - 调用 Skill（通过 Agent 执行）
  app.post<{ Params: { id: string } }>('/skills/:id/invoke', async (request, reply) => {
    const tenantId = (request as any).tenantId;
    const { id } = request.params;
    const body = request.body as { input: string; agent_id?: string; group_id?: string };

    const skill = await app.db('skills').where({ tenant_id: tenantId, id }).first();
    if (!skill) return reply.status(404).send({ error: 'Skill not found' });

    // 增加使用计数
    await app.db('skills').where({ id }).increment('usage_count', 1);

    // 构建 prompt
    const prompt = skill.prompt_template
      ? skill.prompt_template.replace('{{input}}', body.input || '')
      : `Execute skill "${skill.name}": ${body.input}`;

    // 创建 Task
    const [task] = await app.db('task_queue').insert({
      tenant_id: tenantId,
      group_id: body.group_id,
      task_type: 'skill_invocation',
      task_name: `Invoke skill: ${skill.name}`,
      payload: { skill_id: id, prompt, input: body.input },
      status: 'pending',
      assigned_agent_id: body.agent_id || null,
    }).returning('*');

    // 如果有 agent_id，立即执行
    if (body.agent_id) {
      try {
        const { OpenClawHTTPClient, createClientFromConfig } = await import('../../openclaw/client');
        const client = createClientFromConfig();
        const result = await client.sendToAgent(prompt, { agentId: body.agent_id, maxTokens: 4096 });

        await app.db('task_queue').where({ id: task.id }).update({
          status: 'completed',
          result: JSON.stringify({ response: result.choices[0]?.message?.content }),
          updated_at: new Date(),
        });

        return { task_id: task.id, status: 'completed', response: result.choices[0]?.message?.content };
      } catch (err: any) {
        await app.db('task_queue').where({ id: task.id }).update({
          status: 'failed',
          error_message: err.message,
          updated_at: new Date(),
        });
        return reply.status(500).send({ task_id: task.id, error: err.message });
      }
    }

    return reply.status(202).send({ task_id: task.id, status: 'pending' });
  });

  // DELETE /api/v1/skills/:id - 删除 Skill
  app.delete<{ Params: { id: string } }>('/skills/:id', async (request) => {
    const tenantId = (request as any).tenantId;
    await app.db('skills').where({ tenant_id: tenantId, id: request.params.id }).del();
    return { status: 'ok' };
  });
};

import { Knex } from 'knex';
import { db } from './plugin';

export interface AgentInstance {
  id: string;
  tenant_id: string;
  openclaw_instance_id: string;
  name: string;
  endpoint: string;
  capabilities: string[];
  tools: string[];
  supported_models: string[];
  deployment_location?: string;
  memory_context?: string;
  status: 'active' | 'offline' | 'draining' | 'error';
  last_heartbeat?: Date;
  heartbeat_interval: number;
  heartbeat_threshold: number;
  created_at: Date;
}

export async function findActiveAgents(tenantId: string): Promise<AgentInstance[]> {
  const rows = await db('agent_instances')
    .where({ tenant_id: tenantId, status: 'active' })
    .select('*');
  return rows.map((r) => ({
    ...r,
    capabilities: Array.isArray(r.capabilities) ? r.capabilities : JSON.parse(r.capabilities || '[]'),
    tools: Array.isArray(r.tools) ? r.tools : JSON.parse(r.tools || '[]'),
    supported_models: Array.isArray(r.supported_models) ? r.supported_models : JSON.parse(r.supported_models || '[]'),
  }));
}

export async function updateHeartbeat(id: string): Promise<void> {
  await db('agent_instances').where({ id }).update({ last_heartbeat: new Date() });
}

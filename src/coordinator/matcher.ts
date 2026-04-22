/**
 * Coordinator: Skill Profile Matcher
 * V2 MVP: @mention + 广播模式
 */

import { AgentInstance } from '../db/models/agent_instance';

export interface AgentCandidate {
  id: string;
  name: string;
  capabilities: string[];
  tools: string[];
  status: string;
  current_task_count?: number;
}

export interface TaskRequirements {
  capabilities?: string[];
  tools?: string[];
  task_type?: string;
}

/**
 * 根据 Agent capabilities/tools 动态匹配最佳执行者
 * MVP 策略: @mention 精确路由 > 广播
 */
export async function matchBestAgent(
  taskRequirements: TaskRequirements,
  availableAgents: AgentCandidate[]
): Promise<AgentCandidate | null> {
  if (availableAgents.length === 0) return null;

  // 过滤离线 Agent
  const activeAgents = availableAgents.filter((a) => a.status === 'active');
  if (activeAgents.length === 0) return null;

  // MVP: 如果有 capabilities/tools 要求才做匹配
  if (!taskRequirements.capabilities && !taskRequirements.tools) {
    // 无明确要求，返回第一个活跃 Agent
    return activeAgents[0];
  }

  const scored = activeAgents.map((agent) => {
    let score = 0;

    if (taskRequirements.capabilities) {
      const capMatch = taskRequirements.capabilities.filter((cap) =>
        agent.capabilities.includes(cap)
      ).length;
      score += capMatch * 10;
    }

    if (taskRequirements.tools) {
      const toolMatch = taskRequirements.tools.filter((tool) =>
        agent.tools.includes(tool)
      ).length;
      score += toolMatch * 5;
    }

    // 负载加权（prefer less loaded）
    score -= (agent.current_task_count || 0) * 0.5;

    return { agent, score };
  });

  const sorted = scored.sort((a, b) => b.score - a.score);
  return sorted[0]?.agent || null;
}

/**
 * 解析消息中的 @mention，获取目标 Agent
 * 返回 null 表示广播模式
 */
export function parseMention(message: string): string | null {
  // 支持格式: @agent-name 或 @[agent-id]
  const mentionMatch = message.match(/@\[?([^\]]+)\]?/);
  if (mentionMatch) {
    return mentionMatch[1].trim();
  }
  return null; // 无 @mention → 广播
}

/**
 * 判断是否为广播消息
 */
export function isBroadcastMessage(message: string): boolean {
  const broadcastKeywords = ['大家', 'everyone', 'all', '各位', '所有人'];
  const lowerMsg = message.toLowerCase();
  return broadcastKeywords.some((kw) => lowerMsg.includes(kw));
}

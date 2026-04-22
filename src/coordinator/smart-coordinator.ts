/**
 * Coordinator 智能调度器
 * Phase 3: 基于 Capability 的智能路由
 */

import { OpenClawHTTPClient, createClientFromConfig } from '../openclaw/client';
import { checkDialogueRules, DialogueContext } from './rules-engine';

interface AgentInfo {
  id: string;
  name: string;
  openclaw_instance_id: string;
  capabilities: string[];
  tools: string[];
  status: string;
  last_heartbeat: Date | null;
}

interface MatchResult {
  agentId: string;
  agentName: string;
  openclawId: string;
  reason: string;
  confidence: number;
  matchedCapabilities: string[];
}

export class SmartCoordinator {
  private client: OpenClawHTTPClient;

  constructor(client?: OpenClawHTTPClient) {
    this.client = client || createClientFromConfig();
  }

  /**
   * 根据 @mention 或 capability 匹配 Agent
   */
  async match(
    message: string,
    agents: AgentInfo[],
    options?: { preferredAgentId?: string }
  ): Promise<MatchResult> {
    // 1. @mention 精确匹配
    const mentionMatch = message.match(/@([\w-]+)/);
    if (mentionMatch) {
      const mentionName = mentionMatch[1].toLowerCase();
      const agent = agents.find(
        (a) => a.name.toLowerCase() === mentionName || a.id.startsWith(mentionName)
      );
      if (agent) {
        return {
          agentId: agent.id,
          agentName: agent.name,
          openclawId: agent.openclaw_instance_id,
          reason: `@mention 匹配: ${mentionName}`,
          confidence: 1.0,
          matchedCapabilities: [],
        };
      }
    }

    // 2. 指定 Agent
    if (options?.preferredAgentId) {
      const agent = agents.find((a) => a.id === options.preferredAgentId);
      if (agent) {
        return {
          agentId: agent.id,
          agentName: agent.name,
          openclawId: agent.openclaw_instance_id,
          reason: '指定 Agent',
          confidence: 1.0,
          matchedCapabilities: [],
        };
      }
    }

    // 3. Capability 关键词匹配
    const keywords = this.extractKeywords(message);
    let bestMatch: MatchResult | null = null;
    let bestScore = 0;

    for (const agent of agents.filter((a) => a.status === 'active')) {
      const caps = Array.isArray(agent.capabilities) ? agent.capabilities : [];
      const matchedCaps = caps.filter((c) =>
        keywords.some((k) => c.toLowerCase().includes(k))
      );
      const score = matchedCaps.length / Math.max(caps.length, 1);

      if (score > bestScore) {
        bestScore = score;
        bestMatch = {
          agentId: agent.id,
          agentName: agent.name,
          openclawId: agent.openclaw_instance_id,
          reason: `Capability 匹配: ${matchedCaps.join(', ')}`,
          confidence: score,
          matchedCapabilities: matchedCaps,
        };
      }
    }

    if (bestMatch && bestScore > 0.1) {
      return bestMatch;
    }

    // 4. 兜底：轮询或随机选一个活跃 Agent
    const active = agents.filter((a) => a.status === 'active');
    if (active.length > 0) {
      const fallback = active[0];
      return {
        agentId: fallback.id,
        agentName: fallback.name,
        openclawId: fallback.openclaw_instance_id,
        reason: '兜底路由（首个活跃 Agent）',
        confidence: 0.1,
        matchedCapabilities: [],
      };
    }

    // 5. 无可用 Agent
    return {
      agentId: 'main',
      agentName: 'main',
      openclawId: 'main',
      reason: '无活跃 Agent，路由到默认',
      confidence: 0,
      matchedCapabilities: [],
    };
  }

  /**
   * 从消息中提取关键词
   */
  private extractKeywords(message: string): string[] {
    const stopWords = new Set(['的', '了', '是', '在', '我', '你', '他', '她', '它', '们', '这', '那', '有', '和', '与', '或', '不', '也', '都', '就', '要', '会', '能', '请', '帮', '给', '让', '把', '被', '从', '到', '对', '为', '以', '用', '于', '上', '下', '中', '里', '外', '前', '后', 'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'about', 'it', 'its', 'this', 'that', 'and', 'or', 'but', 'not', 'if', 'so', 'than', 'too', 'very']);
    return message
      .toLowerCase()
      .replace(/[@\[\]{}()#$%^&*+=|\\<>\/\n\r]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 1 && !stopWords.has(w));
  }

  /**
   * 分发消息到匹配的 Agent
   */
  async dispatch(
    message: string,
    agents: AgentInfo[],
    options?: {
      preferredAgentId?: string;
      systemPrompt?: string;
      history?: Array<{ role: string; content: string }>;
    }
  ): Promise<{ match: MatchResult; response: string; tokens: number }> {
    const match = await this.match(message, agents, { preferredAgentId: options?.preferredAgentId });

    const result = await this.client.sendToAgent(message, {
      agentId: match.openclawId,
      systemPrompt: options?.systemPrompt,
      history: options?.history as any,
    });

    return {
      match,
      response: result.choices[0]?.message?.content || '',
      tokens: result.usage?.total_tokens || 0,
    };
  }

  /**
   * 检测超时 Agent
   */
  detectTimeouts(agents: AgentInfo[], thresholdSeconds = 90): AgentInfo[] {
    const now = Date.now();
    return agents.filter((a) => {
      if (a.status !== 'active') return false;
      if (!a.last_heartbeat) return true;
      return (now - new Date(a.last_heartbeat).getTime()) / 1000 > thresholdSeconds;
    });
  }
}

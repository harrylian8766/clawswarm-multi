/**
 * Coordinator Matcher: Skill Profile 匹配
 * 
 * V2: 使用 OpenClaw HTTP API 调用 agent
 * Phase 0 PoC 验证通过 ✅
 */

import { OpenClawHTTPClient, createClientFromConfig } from '../openclaw/client';

export interface MatchResult {
  agentId: string;
  reason: string;
  confidence: number;
}

export class CoordinatorMatcher {
  private client: OpenClawHTTPClient;

  constructor(client?: OpenClawHTTPClient) {
    this.client = client || createClientFromConfig();
  }

  /**
   * 根据消息内容匹配最佳 agent
   * MVP: 直接路由到 main agent
   */
  matchAgent(message: string, tenantId: string): MatchResult {
    // MVP: 所有消息路由到 main
    // 后续: 根据 @mention、skill profile、capability 匹配
    const mentionMatch = message.match(/@(\w+)/);
    if (mentionMatch) {
      return {
        agentId: mentionMatch[1],
        reason: `@mention 匹配: ${mentionMatch[1]}`,
        confidence: 1.0,
      };
    }

    return {
      agentId: 'main',
      reason: '默认路由',
      confidence: 0.5,
    };
  }

  /**
   * 发送消息给匹配的 agent 并获取回复
   */
  async dispatch(
    message: string,
    tenantId: string,
    options?: { systemPrompt?: string; history?: Array<{ role: string; content: string }> }
  ): Promise<{ agentId: string; response: string; tokens: number }> {
    const match = this.matchAgent(message, tenantId);
    
    const result = await this.client.sendToAgent(message, {
      agentId: match.agentId,
      systemPrompt: options?.systemPrompt,
      history: options?.history as any,
    });

    return {
      agentId: match.agentId,
      response: result.choices[0]?.message?.content || '',
      tokens: result.usage?.total_tokens || 0,
    };
  }
}

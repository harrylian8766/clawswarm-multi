/**
 * OpenClaw Gateway HTTP Client
 * Phase 0 PoC 验证通过 ✅
 * 
 * 通信方式: OpenAI 兼容 HTTP API
 * 端点: POST /v1/chat/completions
 * 认证: Bearer token
 * 模型: "openclaw" 或 "openclaw/<agentId>"
 */

export interface OpenClawHTTPConfig {
  gatewayUrl: string; // e.g. http://localhost:18789
  authToken: string;
  defaultAgent?: string; // agent id, default "main"
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionResponse {
  id: string;
  choices: Array<{
    index: number;
    message: { role: string; content: string };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class OpenClawHTTPClient {
  private config: OpenClawHTTPConfig;

  constructor(config: OpenClawHTTPConfig) {
    this.config = config;
  }

  /**
   * 发送消息给指定 agent，获取回复
   */
  async sendToAgent(
    message: string,
    options?: {
      agentId?: string;
      systemPrompt?: string;
      maxTokens?: number;
      history?: ChatMessage[];
    }
  ): Promise<ChatCompletionResponse> {
    const agent = options?.agentId || this.config.defaultAgent || 'main';
    const model = `openclaw/${agent}`;

    const messages: ChatMessage[] = [];
    if (options?.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    if (options?.history) {
      messages.push(...options.history);
    }
    messages.push({ role: 'user', content: message });

    const url = `${this.config.gatewayUrl}/v1/chat/completions`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: options?.maxTokens || 4096,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenClaw HTTP ${res.status}: ${err}`);
    }

    return (await res.json()) as ChatCompletionResponse;
  }

  /**
   * 简单 ping 测试
   */
  async ping(): Promise<string> {
    const res = await this.sendToAgent('ping', { maxTokens: 20 });
    return res.choices[0]?.message?.content || 'no response';
  }

  /**
   * 列出可用模型（通过 /v1/models）
   */
  async listModels(): Promise<string[]> {
    const url = `${this.config.gatewayUrl}/v1/models`;
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${this.config.authToken}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as { data: Array<{ id: string }> };
    return data.data.map((m) => m.id);
  }
}

/**
 * 从 openclaw.json 读取配置，创建客户端
 */
export function createClientFromConfig(configPath?: string): OpenClawHTTPClient {
  const fs = require('fs');
  const path = require('path');
  const resolvedPath = configPath || path.join(process.env.HOME || '/home/harry', '.openclaw', 'openclaw.json');
  
  const config = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
  const gateway = config.gateway || {};
  
  return new OpenClawHTTPClient({
    gatewayUrl: `http://127.0.0.1:${gateway.port || 18789}`,
    authToken: gateway.auth?.token || '',
    defaultAgent: 'main',
  });
}

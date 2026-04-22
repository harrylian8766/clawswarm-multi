/**
 * Coordinator: Bounded Peer Dialogue Rules Engine
 * V2 MVP: 防止 Agent 无限循环对话
 */

export type ConvergenceSignal = 'conclusion' | 'question' | 'blocked' | 'handover';

export interface ParsedSignal {
  type: ConvergenceSignal;
  content: string;
}

export interface DialogueContext {
  threadId?: string;
  senderId: string;
  recentTurns: number;
  mentionedMembers: string[];
}

/**
 * 解析消息中的收敛信号
 */
export function parseConvergenceSignal(message: string): ParsedSignal | null {
  const signals: Record<string, ConvergenceSignal> = {
    '结论:': 'conclusion',
    '结论: ': 'conclusion',
    '疑问:': 'question',
    '疑问: ': 'question',
    '阻塞:': 'blocked',
    '阻塞: ': 'blocked',
    '交回指挥:': 'handover',
    '交回指挥: ': 'handover',
  };

  for (const [prefix, type] of Object.entries(signals)) {
    if (message.startsWith(prefix)) {
      return {
        type,
        content: message.replace(prefix, '').trim(),
      };
    }
  }
  return null;
}

/**
 * 检查是否违反对话规则
 */
export interface RuleCheckResult {
  blocked: boolean;
  reason?: string;
  signal?: ParsedSignal;
}

export function checkDialogueRules(
  message: string,
  context: DialogueContext,
  options: {
    maxTurnsPerTopic?: number;
    allowMultipleMentions?: boolean;
  } = {}
): RuleCheckResult {
  const { maxTurnsPerTopic = 3, allowMultipleMentions = false } = options;

  // 检查收敛信号
  const signal = parseConvergenceSignal(message);
  if (signal) {
    return { blocked: false, signal };
  }

  // 检查一对一原则
  if (!allowMultipleMentions && context.mentionedMembers.length > 1) {
    return {
      blocked: true,
      reason: '[规则拦截] 禁止同时 @ 多个 Agent，请只 @ 一个。',
    };
  }

  // 检查最大轮次
  if (context.recentTurns >= maxTurnsPerTopic) {
    return {
      blocked: true,
      reason: `[规则拦截] 当前话题已达最大对话轮次(${maxTurnsPerTopic}轮)，请发「交回指挥:」交回 Coordinator。`,
    };
  }

  return { blocked: false };
}

/**
 * 获取收敛信号的中文描述
 */
export function getConvergenceSignalLabel(type: ConvergenceSignal): string {
  const labels: Record<ConvergenceSignal, string> = {
    conclusion: '结论',
    question: '疑问',
    blocked: '阻塞',
    handover: '交回指挥',
  };
  return labels[type];
}

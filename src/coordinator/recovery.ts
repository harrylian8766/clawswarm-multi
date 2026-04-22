/**
 * Coordinator: Failure Recovery
 * V2: Agent 执行失败时的自动恢复流程
 */

export interface RecoveryResult {
  action: 'retry' | 'fallback' | 'fail';
  newAgentId?: string;
  reason: string;
}

/**
 * 处理任务执行失败
 */
export async function handleTaskFailure(
  task: {
    id: string;
    retry_count: number;
    max_retries: number;
    fallback_agent_id?: string;
  },
  error: string,
  availableAgents: { id: string; status: string }[]
): Promise<RecoveryResult> {
  // 1. 尝试重试
  if (task.retry_count < task.max_retries) {
    // 尝试使用 fallback agent
    if (task.fallback_agent_id) {
      const fallback = availableAgents.find((a) => a.id === task.fallback_agent_id && a.status === 'active');
      if (fallback) {
        return {
          action: 'fallback',
          newAgentId: fallback.id,
          reason: `Fallback to备用Agent: ${error}`,
        };
      }
    }

    // 普通重试
    return {
      action: 'retry',
      reason: `重试任务 (${task.retry_count + 1}/${task.max_retries}): ${error}`,
    };
  }

  // 2. 超过重试次数，标记失败
  return {
    action: 'fail',
    reason: `超过最大重试次数 (${task.max_retries}), 任务失败: ${error}`,
  };
}

/**
 * 检测 Agent 是否超时/无响应
 */
export function isAgentTimeout(
  lastHeartbeat: Date | null,
  thresholdSeconds: number = 90
): boolean {
  if (!lastHeartbeat) return true;
  const elapsed = (Date.now() - lastHeartbeat.getTime()) / 1000;
  return elapsed > thresholdSeconds;
}

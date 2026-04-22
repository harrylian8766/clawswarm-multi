/**
 * Coordinator: Task Decomposer
 * V2 MVP: 简单任务直接执行，复杂任务拆解为多个子任务
 */

export interface SubTask {
  name: string;
  task_type: string;
  payload: Record<string, any>;
  dependencies: string[]; // 依赖的子任务 ID
  assigned_agent_id?: string;
}

export interface DecompositionResult {
  is_complex: boolean;
  tasks: SubTask[];
  main_task: SubTask;
}

/**
 * 判断任务是否需要分解
 * MVP: 只识别明确的复合任务模式
 */
export function shouldDecompose(message: string): boolean {
  const complexPatterns = [
    /首先.*然后/,
    /第一步.*第二步/,
    /先.*再/,
    /帮我写.*并/,
    /搜索.*并.*整理/,
    /分析.*然后.*生成/,
  ];
  return complexPatterns.some((p) => p.test(message));
}

/**
 * 分解复杂任务为子任务
 * MVP: 简单字符串模式匹配，后续可升级为 LLM 分解
 */
export function decomposeTask(
  message: string,
  taskId: string
): DecompositionResult {
  // MVP: 简单分解
  // 后续升级: 调用 LLM 进行智能分解
  const mainTask: SubTask = {
    name: 'main',
    task_type: 'coordinate',
    payload: { original_message: message },
    dependencies: [],
  };

  // 简单模式: "A 然后 B" → 拆为两个子任务
  const thenMatch = message.match(/(.+?)\s*然后\s*(.+)/);
  if (thenMatch) {
    const subTask1: SubTask = {
      name: 'step_1',
      task_type: 'execution',
      payload: { instruction: thenMatch[1].trim() },
      dependencies: [],
    };
    const subTask2: SubTask = {
      name: 'step_2',
      task_type: 'execution',
      payload: { instruction: thenMatch[2].trim() },
      dependencies: [taskId + '_step_1'],
    };

    return {
      is_complex: true,
      tasks: [mainTask, subTask1, subTask2],
      main_task: mainTask,
    };
  }

  // 非复杂任务
  return {
    is_complex: false,
    tasks: [mainTask],
    main_task: mainTask,
  };
}

/**
 * 获取任务依赖拓扑排序
 */
export function getTaskExecutionOrder(tasks: SubTask[]): SubTask[][] {
  const noDeps = tasks.filter((t) => t.dependencies.length === 0);
  return [noDeps]; // MVP: 简单返回第一层
}

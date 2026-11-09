import { ALL_TOOLS_LIMITS, resolveToolLimits, ToolLimitTierConfig, ToolTierLimits, WORKFLOW_LIMITS as MASTER_WORKFLOW_LIMITS } from './subscription-plans.config.js';

interface ToolLimitConfig {
  maxFiles: number;
  maxFileSizeMB: number;
  maxTotalSizeMB: number;
}

interface ToolLimitDefinition {
  free: ToolLimitConfig;
  premium: ToolLimitConfig & {
    requiredPermission?: string;
  };
}

const TOOLS_LIMITS: Record<string, ToolTierLimits> = ALL_TOOLS_LIMITS;

function getToolLimits(toolId: string, permissions: string[] = []): ToolLimitConfig {
  const limits = resolveToolLimits(toolId, permissions);
  return {
    maxFiles: limits.maxFiles,
    maxFileSizeMB: limits.maxFileSizeMB,
    maxTotalSizeMB: limits.maxTotalSizeMB,
  };
}

const WORKFLOW_LIMITS = MASTER_WORKFLOW_LIMITS;

function getMaxWorkflows(_permissions: string[] = []): number {
  return 1000;
}

export { TOOLS_LIMITS, WORKFLOW_LIMITS, getMaxWorkflows, getToolLimits };
export type { ToolLimitConfig, ToolLimitDefinition };

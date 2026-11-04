import { ALL_TOOLS_LIMITS, ToolLimitTierConfig, ToolTierLimits, WORKFLOW_LIMITS as MASTER_WORKFLOW_LIMITS } from './subscription-plans.config.js';

export interface ToolLimitDefinition {
  free: {
    maxFiles: number;
    maxFileSizeMB: number;
    maxTotalSizeMB: number;
  };
  premium: {
    maxFiles: number;
    maxFileSizeMB: number;
    maxTotalSizeMB: number;
    requiredPermission?: string;
  };
}

export const TOOLS_LIMITS: Record<string, ToolTierLimits> = ALL_TOOLS_LIMITS;

export function getCurrentUserToolLimits(toolId: string): { isPremium: boolean; maxFiles: number; maxFileSizeMB: number; maxTotalSizeMB: number } {
  const config = TOOLS_LIMITS[toolId];
  if (!config) {
    return { isPremium: true, maxFiles: 50, maxFileSizeMB: 1000, maxTotalSizeMB: 2000 };
  }

  return {
    isPremium: true,
    maxFiles: config.premium.maxFiles,
    maxFileSizeMB: config.premium.maxFileSizeMB,
    maxTotalSizeMB: config.premium.maxTotalSizeMB,
  };
}

export const WORKFLOW_LIMITS = MASTER_WORKFLOW_LIMITS;

export function getMaxWorkflows(_user?: any): number {
  return 100;
}

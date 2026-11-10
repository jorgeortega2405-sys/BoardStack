import { currentUser } from '../services/api.service.js';
import { ALL_TOOLS_LIMITS, FOLDER_LIMITS, PLATFORM_LIMITS, resolveToolLimits, ToolLimitTierConfig, ToolTierLimits, WORKFLOW_LIMITS as MASTER_WORKFLOW_LIMITS } from './subscription-plans.config.js';

interface ToolLimitDefinition {
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

const TOOLS_LIMITS: Record<string, ToolTierLimits> = ALL_TOOLS_LIMITS;

function getCurrentUserToolLimits(toolId: string): { isPremium: boolean; maxFiles: number; maxFileSizeMB: number; maxTotalSizeMB: number } {
  const perms = currentUser?.permissions || [];
  const limits = resolveToolLimits(toolId, perms);
  const tool = ALL_TOOLS_LIMITS[toolId];
  const isPremium = perms.includes('subscription:feature:pro') ||
    perms.includes('subscription:feature:business') ||
    (tool ? limits.maxFiles > tool.free.maxFiles : false);

  return {
    isPremium,
    maxFiles: limits.maxFiles,
    maxFileSizeMB: limits.maxFileSizeMB,
    maxTotalSizeMB: limits.maxTotalSizeMB,
  };
}

const WORKFLOW_LIMITS = MASTER_WORKFLOW_LIMITS;

function getMaxWorkflows(user = currentUser): number {
  const perms = user?.permissions || [];
  if (perms.includes('subscription:feature:business')) return WORKFLOW_LIMITS.business;
  if (perms.includes('subscription:feature:pro')) return WORKFLOW_LIMITS.pro;
  return WORKFLOW_LIMITS.free;
}

function getMaxFolders(user = currentUser): number {
  const perms = user?.permissions || [];
  if (perms.includes('subscription:feature:business')) return FOLDER_LIMITS.business;
  if (perms.includes('subscription:feature:pro')) return FOLDER_LIMITS.pro;
  return FOLDER_LIMITS.free;
}

export { FOLDER_LIMITS, PLATFORM_LIMITS, TOOLS_LIMITS, WORKFLOW_LIMITS, getCurrentUserToolLimits, getMaxFolders, getMaxWorkflows };
export type { ToolLimitDefinition };

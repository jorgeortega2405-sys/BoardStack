interface WorkflowStep {
  id: string;
  options: Record<string, any>;
  tool: string;
}

interface UserWorkflow {
  category: 'pdf' | 'image';
  created_at: string;
  description: string | null;
  id: string;
  name: string;
  steps: WorkflowStep[];
  updated_at: string;
}

interface ToolDefinition {
  category: 'pdf' | 'image';
  groupKey: string;
  icon: string;
  id: string;
  isTerminal?: boolean;
  nameKey: string;
  targetType?: string;
}

interface OrganizePageItem {
  id: string;
  originalIndex: number;
  pageNum: number;
  rotation: number;
  thumbnailDataUrl?: string;
}

export type { OrganizePageItem, ToolDefinition, UserWorkflow, WorkflowStep };

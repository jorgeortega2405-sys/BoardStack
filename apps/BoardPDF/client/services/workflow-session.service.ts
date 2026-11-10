import { UserWorkflow, WorkflowStep } from '../types/workflow.types.js';

interface WorkflowSession {
  currentStepIndex: number;
  intermediateFile: File | null;
  steps: WorkflowStep[];
  workflowId: string;
  workflowName: string;
}

const TOOL_ROUTES: Record<string, string> = {
  'compress-pdf': '/compress-pdf',
  'excel-to-pdf': '/excel-to-pdf',
  'jpg-to-pdf': '/jpg-to-pdf',
  'merge-pdf': '/merge-pdf',
  'ocr-pdf': '/ocr-pdf',
  'organize-pdf': '/organize-pdf',
  'pdf-to-excel': '/pdf-to-excel',
  'pdf-to-jpg': '/pdf-to-jpg',
  'pdf-to-pdfa': '/pdf-to-pdfa',
  'pdf-to-powerpoint': '/pdf-to-powerpoint',
  'pdf-to-word': '/pdf-to-word',
  'powerpoint-to-pdf': '/powerpoint-to-pdf',
  'protect-pdf': '/protect-pdf',
  'split-pdf': '/split-pdf',
  'unlock-pdf': '/unlock-pdf',
  'word-to-pdf': '/word-to-pdf',
};

let activeSession: WorkflowSession | null = null;

function getWorkflowStepRoute(toolId: string): string {
  return TOOL_ROUTES[toolId] || '/workflows';
}

function startWorkflowSession(workflow: UserWorkflow): string {
  activeSession = {
    currentStepIndex: 0,
    intermediateFile: null,
    steps: [...workflow.steps],
    workflowId: workflow.id,
    workflowName: workflow.name,
  };
  const firstTool = workflow.steps[0]?.tool || '';
  return getWorkflowStepRoute(firstTool);
}

function getActiveWorkflowSession(): WorkflowSession | null {
  return activeSession;
}

function isWorkflowSessionActive(): boolean {
  return activeSession !== null;
}

function getCurrentWorkflowStep(): WorkflowStep | null {
  if (!activeSession) return null;
  return activeSession.steps[activeSession.currentStepIndex] || null;
}

function getWorkflowIntermediateFile(): File | null {
  return activeSession?.intermediateFile || null;
}

function advanceWorkflowSession(outputFile: File): { isComplete: boolean; nextRoute: string | null } {
  if (!activeSession) {
    return { isComplete: true, nextRoute: null };
  }
  activeSession.currentStepIndex += 1;
  activeSession.intermediateFile = outputFile;
  if (activeSession.currentStepIndex >= activeSession.steps.length) {
    clearWorkflowSession();
    return { isComplete: true, nextRoute: null };
  }
  const nextStep = activeSession.steps[activeSession.currentStepIndex];
  return {
    isComplete: false,
    nextRoute: getWorkflowStepRoute(nextStep.tool),
  };
}

function clearWorkflowSession(): void {
  activeSession = null;
}

export { advanceWorkflowSession, clearWorkflowSession, getActiveWorkflowSession, getCurrentWorkflowStep, getWorkflowIntermediateFile, getWorkflowStepRoute, isWorkflowSessionActive, startWorkflowSession };
export type { WorkflowSession };

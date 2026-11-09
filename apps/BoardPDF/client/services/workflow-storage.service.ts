import { UserWorkflow, WorkflowStep } from '../types/workflow.types.js';
import { t } from './i18n.service.js';

const STORAGE_KEY = 'boardpdf_workflows';
const MAX_WORKFLOWS_LIMIT = 100;

function getWorkflows(): UserWorkflow[] {
  if (typeof window === 'undefined' || !window.localStorage) {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getWorkflow(id: string): UserWorkflow | null {
  const workflows = getWorkflows();
  return workflows.find((w) => w.id === id) || null;
}

function saveWorkflow(payload: {
  category?: 'pdf' | 'image';
  description?: string | null;
  id?: string;
  name: string;
  steps: WorkflowStep[];
}): { error?: string; success: boolean; workflow?: UserWorkflow } {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { error: 'Almacenamiento local no disponible', success: false };
  }

  const workflows = getWorkflows();
  const now = new Date().toISOString();

  if (payload.id) {
    const index = workflows.findIndex((w) => w.id === payload.id);
    if (index === -1) {
      return { error: 'Flujo de trabajo no encontrado', success: false };
    }
    const updated: UserWorkflow = {
      ...workflows[index],
      category: payload.category || workflows[index].category || 'pdf',
      description: payload.description !== undefined ? payload.description : workflows[index].description,
      name: payload.name.trim(),
      steps: payload.steps,
      updated_at: now,
    };
    workflows[index] = updated;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(workflows));
    window.dispatchEvent(new CustomEvent('workflow:changed'));
    return { success: true, workflow: updated };
  }

  if (workflows.length >= MAX_WORKFLOWS_LIMIT) {
    return {
      error: t('ui.has_alcanzado_el_limite_maximo_de_flujos'),
      success: false,
    };
  }

  const newId = `wf_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const created: UserWorkflow = {
    category: payload.category || 'pdf',
    created_at: now,
    description: payload.description || null,
    id: newId,
    name: payload.name.trim(),
    steps: payload.steps,
    updated_at: now,
  };

  workflows.unshift(created);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(workflows));
  window.dispatchEvent(new CustomEvent('workflow:changed'));
  return { success: true, workflow: created };
}

function deleteWorkflow(id: string): boolean {
  if (typeof window === 'undefined' || !window.localStorage) {
    return false;
  }
  const workflows = getWorkflows();
  const filtered = workflows.filter((w) => w.id !== id);
  if (filtered.length === workflows.length) {
    return false;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  window.dispatchEvent(new CustomEvent('workflow:changed'));
  return true;
}

export { MAX_WORKFLOWS_LIMIT, deleteWorkflow, getWorkflow, getWorkflows, saveWorkflow };

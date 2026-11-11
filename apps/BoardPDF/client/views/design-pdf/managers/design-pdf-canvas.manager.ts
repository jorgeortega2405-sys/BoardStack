import { EditorElement, ElementDrawing } from '../types/design-pdf.types.js';

interface CanvasManagerHost {
  activeTool: 'draw' | 'lines' | 'select' | 'shapes' | 'stickynotes' | 'text';
  broadcastElementDelete: (id: string, pageIndex: number) => void;
  container: HTMLElement;
  drawColor: string;
  drawMode: 'eraser' | 'highlighter' | 'marker' | 'pen';
  drawThickness: number;
  editorMode: 'edit' | 'view';
  elements: EditorElement[];
  flushAutoSave: () => Promise<void>;
  isAiLocked: boolean;
  pushElement: (el: EditorElement, broadcast?: boolean) => void;
  recordHistory: () => void;
  setModified: (val: boolean) => void;
  zoomLevel: number;
}

class DesignPdfCanvasManager {
  private host: CanvasManagerHost;

  constructor(host: CanvasManagerHost) {
    this.host = host;
  }

  getEffectiveDrawWidth(): number {
    if (this.host.drawMode === 'marker') return Math.max(6, this.host.drawThickness * 2.5);
    if (this.host.drawMode === 'highlighter') return Math.max(16, this.host.drawThickness * 5);
    return this.host.drawThickness;
  }

  drawFreehandOnCanvas(canvas: HTMLCanvasElement, pageIndex: number): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const drawings = this.host.elements.filter((el) => el.type === 'drawing' && (el.pageIndex ?? 0) === pageIndex) as ElementDrawing[];
    for (const d of drawings) {
      if (!d.points || d.points.length < 2) continue;
      ctx.beginPath();
      ctx.strokeStyle = d.color || '#000000';
      ctx.lineWidth = d.width || 2;
      ctx.globalAlpha = d.opacity || 1.0;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(d.points[0].x, d.points[0].y);
      for (let i = 1; i < d.points.length; i++) {
        ctx.lineTo(d.points[i].x, d.points[i].y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1.0;
    }
  }

  eraseAt(x: number, y: number, pageIndex: number): void {
    const radius = 24;
    const prevCount = this.host.elements.length;
    const toRemove: string[] = [];
    this.host.elements = this.host.elements.filter((el) => {
      if (el.type !== 'drawing' || (el.pageIndex ?? 0) !== pageIndex) return true;
      const hit = el.points.some((pt) => Math.hypot(pt.x - x, pt.y - y) <= radius);
      if (hit) toRemove.push(el.id);
      return !hit;
    });

    if (this.host.elements.length !== prevCount) {
      const canvas = this.host.container.querySelector<HTMLCanvasElement>(`[data-ref="drawing-canvas-${pageIndex}"]`);
      if (canvas) {
        this.drawFreehandOnCanvas(canvas, pageIndex);
      }
      this.host.setModified(true);
      toRemove.forEach((id) => this.host.broadcastElementDelete(id, pageIndex));
      void this.host.flushAutoSave();
    }
  }

  bindCanvasDrawing(canvas: HTMLCanvasElement, pageIndex: number): void {
    let isDrawing = false;
    let currentStroke: Array<{ x: number; y: number }> = [];

    const getCanvasPos = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    };

    canvas.addEventListener('mousedown', (e) => {
      if (this.host.isAiLocked || this.host.editorMode === 'view') return;
      if (this.host.activeTool !== 'draw') return;
      isDrawing = true;
      const pos = getCanvasPos(e);

      if (this.host.drawMode === 'eraser') {
        this.eraseAt(pos.x, pos.y, pageIndex);
        return;
      }

      currentStroke = [pos];
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.beginPath();
        ctx.strokeStyle = this.host.drawColor;
        ctx.lineWidth = this.getEffectiveDrawWidth();
        ctx.globalAlpha = this.host.drawMode === 'highlighter' ? 0.35 : 1.0;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.moveTo(pos.x, pos.y);
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDrawing) return;
      const pos = getCanvasPos(e);

      if (this.host.drawMode === 'eraser') {
        this.eraseAt(pos.x, pos.y, pageIndex);
        return;
      }

      currentStroke.push(pos);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
      }
    });

    window.addEventListener('mouseup', () => {
      if (!isDrawing) return;
      isDrawing = false;

      if (this.host.drawMode === 'eraser') {
        this.host.recordHistory();
        return;
      }

      if (currentStroke.length >= 2) {
        const strokeId = 'draw_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);
        const newDrawing: ElementDrawing = {
          color: this.host.drawColor,
          id: strokeId,
          opacity: this.host.drawMode === 'highlighter' ? 0.35 : 1.0,
          pageIndex,
          points: currentStroke,
          type: 'drawing',
          width: this.getEffectiveDrawWidth(),
        };
        this.host.pushElement(newDrawing, true);
        this.host.recordHistory();
      }
      currentStroke = [];
    });
  }
}

export { DesignPdfCanvasManager };
export type { CanvasManagerHost };

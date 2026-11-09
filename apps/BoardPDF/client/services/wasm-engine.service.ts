interface WasmExports {
  distance_point_to_line: (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => number;
  fast_pixel_filter: (ptr: number, len: number, filterType: number, param: number) => void;
  fast_transform_bbox: (x: number, y: number, width: number, height: number, angleRad: number, outPtr: number) => void;
  memory: WebAssembly.Memory;
  point_in_polygon: (px: number, py: number, pointsPtr: number, pointsCount: number) => number;
  wasm_alloc: (size: number) => number;
  wasm_dealloc: (ptr: number, size: number) => void;
}

interface BoundingBox {
  height: number;
  width: number;
  x: number;
  y: number;
}

interface Point {
  x: number;
  y: number;
}

let wasmInstance: WasmExports | null = null;
let initPromise: Promise<boolean> | null = null;

async function initWasmEngine(): Promise<boolean> {
  if (wasmInstance) return true;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      if (typeof WebAssembly === 'undefined') return false;
      const response = await fetch('/vendor/wasm/board_wasm.wasm');
      if (!response.ok) return false;
      const result = await WebAssembly.instantiateStreaming(response, {});
      wasmInstance = result.instance.exports as unknown as WasmExports;
      return true;
    } catch {
      return false;
    }
  })();

  return initPromise;
}

function isWasmEngineReady(): boolean {
  return wasmInstance !== null;
}

function transformBBoxWasm(x: number, y: number, width: number, height: number, angleRad: number): BoundingBox {
  if (!wasmInstance) {
    const cosA = Math.abs(Math.cos(angleRad));
    const sinA = Math.abs(Math.sin(angleRad));
    const nw = width * cosA + height * sinA;
    const nh = width * sinA + height * cosA;
    return {
      height: nh,
      width: nw,
      x: x + (width - nw) / 2,
      y: y + (height - nh) / 2,
    };
  }

  const outPtr = wasmInstance.wasm_alloc(16);
  wasmInstance.fast_transform_bbox(x, y, width, height, angleRad, outPtr);
  const memView = new Float32Array(wasmInstance.memory.buffer, outPtr, 4);
  const result: BoundingBox = {
    height: memView[3],
    width: memView[2],
    x: memView[0],
    y: memView[1],
  };
  wasmInstance.wasm_dealloc(outPtr, 16);
  return result;
}

function filterPixelsWasm(imageData: ImageData, filterType: 1 | 2 | 3, param = 0): void {
  if (!wasmInstance) return;
  const len = imageData.data.length;
  const ptr = wasmInstance.wasm_alloc(len);
  const heap = new Uint8Array(wasmInstance.memory.buffer, ptr, len);
  heap.set(imageData.data);
  wasmInstance.fast_pixel_filter(ptr, len, filterType, param);
  imageData.data.set(new Uint8Array(wasmInstance.memory.buffer, ptr, len));
  wasmInstance.wasm_dealloc(ptr, len);
}

function isPointInPolygonWasm(px: number, py: number, points: Point[]): boolean {
  if (points.length < 3) return false;
  if (!wasmInstance) {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const xi = points[i].x;
      const yi = points[i].y;
      const xj = points[j].x;
      const yj = points[j].y;
      const intersect = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  const count = points.length;
  const byteLen = count * 2 * 4;
  const ptr = wasmInstance.wasm_alloc(byteLen);
  const memView = new Float32Array(wasmInstance.memory.buffer, ptr, count * 2);
  for (let i = 0; i < count; i++) {
    memView[i * 2] = points[i].x;
    memView[i * 2 + 1] = points[i].y;
  }
  const isInside = wasmInstance.point_in_polygon(px, py, ptr, count) === 1;
  wasmInstance.wasm_dealloc(ptr, byteLen);
  return isInside;
}

export { filterPixelsWasm, initWasmEngine, isPointInPolygonWasm, isWasmEngineReady, transformBBoxWasm };

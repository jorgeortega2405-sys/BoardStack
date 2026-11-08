use std::alloc::{alloc, dealloc, Layout};

#[no_mangle]
pub extern "C" fn wasm_alloc(size: usize) -> *mut u8 {
    let layout = Layout::from_size_align(size, 4).unwrap();
    unsafe { alloc(layout) }
}

#[no_mangle]
pub extern "C" fn wasm_dealloc(ptr: *mut u8, size: usize) {
    if !ptr.is_null() && size > 0 {
        let layout = Layout::from_size_align(size, 4).unwrap();
        unsafe { dealloc(ptr, layout) }
    }
}

#[no_mangle]
pub extern "C" fn fast_transform_bbox(
    x: f32,
    y: f32,
    width: f32,
    height: f32,
    angle_rad: f32,
    out_ptr: *mut f32,
) {
    if out_ptr.is_null() {
        return;
    }

    let cos_a = angle_rad.cos();
    let sin_a = angle_rad.sin();
    let cx = x + width * 0.5;
    let cy = y + height * 0.5;

    let hw = width * 0.5;
    let hh = height * 0.5;

    let corners = [
        (-hw, -hh),
        (hw, -hh),
        (hw, hh),
        (-hw, hh),
    ];

    let mut min_x = f32::MAX;
    let mut min_y = f32::MAX;
    let mut max_x = f32::MIN;
    let mut max_y = f32::MIN;

    for (dx, dy) in corners {
        let rx = cx + (dx * cos_a - dy * sin_a);
        let ry = cy + (dx * sin_a + dy * cos_a);

        if rx < min_x { min_x = rx; }
        if rx > max_x { max_x = rx; }
        if ry < min_y { min_y = ry; }
        if ry > max_y { max_y = ry; }
    }

    unsafe {
        *out_ptr = min_x;
        *out_ptr.add(1) = min_y;
        *out_ptr.add(2) = max_x - min_x;
        *out_ptr.add(3) = max_y - min_y;
    }
}

#[no_mangle]
pub extern "C" fn fast_pixel_filter(
    ptr: *mut u8,
    len: usize,
    filter_type: u32,
    param: f32,
) {
    if ptr.is_null() || len == 0 {
        return;
    }

    let pixels = unsafe { std::slice::from_raw_parts_mut(ptr, len) };
    let chunk_count = len / 4;

    match filter_type {
        1 => {
            for i in 0..chunk_count {
                let idx = i * 4;
                let r = pixels[idx] as f32;
                let g = pixels[idx + 1] as f32;
                let b = pixels[idx + 2] as f32;
                let gray = (0.299 * r + 0.587 * g + 0.114 * b) as u8;
                pixels[idx] = gray;
                pixels[idx + 1] = gray;
                pixels[idx + 2] = gray;
            }
        }
        2 => {
            for i in 0..chunk_count {
                let idx = i * 4;
                pixels[idx] = 255 - pixels[idx];
                pixels[idx + 1] = 255 - pixels[idx + 1];
                pixels[idx + 2] = 255 - pixels[idx + 2];
            }
        }
        3 => {
            let factor = (259.0 * (param + 255.0)) / (255.0 * (259.0 - param));
            for i in 0..chunk_count {
                let idx = i * 4;
                for c in 0..3 {
                    let val = pixels[idx + c] as f32;
                    let adjusted = (factor * (val - 128.0) + 128.0).clamp(0.0, 255.0) as u8;
                    pixels[idx + c] = adjusted;
                }
            }
        }
        _ => {}
    }
}

#[no_mangle]
pub extern "C" fn distance_point_to_line(
    px: f32,
    py: f32,
    x1: f32,
    y1: f32,
    x2: f32,
    y2: f32,
) -> f32 {
    let l2 = (x2 - x1).powi(2) + (y2 - y1).powi(2);
    if l2 == 0.0 {
        return ((px - x1).powi(2) + (py - y1).powi(2)).sqrt();
    }
    let t = (((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2).clamp(0.0, 1.0);
    let proj_x = x1 + t * (x2 - x1);
    let proj_y = y1 + t * (y2 - y1);
    ((px - proj_x).powi(2) + (py - proj_y).powi(2)).sqrt()
}

#[no_mangle]
pub extern "C" fn point_in_polygon(
    px: f32,
    py: f32,
    points_ptr: *const f32,
    points_count: usize,
) -> i32 {
    if points_ptr.is_null() || points_count < 3 {
        return 0;
    }

    let points = unsafe { std::slice::from_raw_parts(points_ptr, points_count * 2) };
    let mut inside = false;
    let mut j = points_count - 1;

    for i in 0..points_count {
        let xi = points[i * 2];
        let yi = points[i * 2 + 1];
        let xj = points[j * 2];
        let yj = points[j * 2 + 1];

        let intersect = ((yi > py) != (yj > py))
            && (px < (xj - xi) * (py - yi) / (yj - yi) + xi);

        if intersect {
            inside = !inside;
        }
        j = i;
    }

    if inside { 1 } else { 0 }
}

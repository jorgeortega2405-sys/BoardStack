const SVG_TOOL_MERGE_PDF = `
  <div class="icon-outline icon-outline--red" data-ref="icon-outline-merge-pdf">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect fill="currentColor" fill-opacity=".14" x="3" y="8" width="13" height="13" rx="3.5"/><path d="M8 8V6a3 3 0 0 1 3-3h7a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3h-2"/><path d="M9.5 12v5M7 14.5h5"/></svg>
  </div>
`;

const SVG_TOOL_SPLIT_PDF = `
  <div class="icon-outline icon-outline--red" data-ref="icon-outline-split-pdf">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path fill="currentColor" fill-opacity=".14" d="M10 4H8a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h2"/><path fill="currentColor" fill-opacity=".14" d="M14 4h2a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3h-2"/><path d="M12 3v18" stroke-dasharray="2 3.2"/></svg>
  </div>
`;

const SVG_TOOL_REMOVE_PDF_PAGES = `
  <div class="icon-outline icon-outline--red" data-ref="icon-outline-remove-pdf-pages">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path fill="currentColor" fill-opacity=".14" d="M14 3H8a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3V8z"/><path d="M14 3v3.5A1.5 1.5 0 0 0 15.5 8H19"/><path d="M9 14.5h6"/></svg>
  </div>
`;

const SVG_TOOL_EXTRACT_PDF_PAGES = `
  <div class="icon-outline icon-outline--red" data-ref="icon-outline-extract-pdf-pages">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path fill="currentColor" fill-opacity=".14" d="M14 3H8a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3V8z"/><path d="M14 3v3.5A1.5 1.5 0 0 0 15.5 8H19"/><path d="M9 15h6M12.5 12.5L15 15l-2.5 2.5"/></svg>
  </div>
`;

const SVG_TOOL_ORGANIZE_PDF = `
  <div class="icon-outline icon-outline--red" data-ref="icon-outline-organize-pdf">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect fill="currentColor" fill-opacity=".14" x="3" y="3" width="8" height="8" rx="2.5"/><rect x="13" y="3" width="8" height="8" rx="2.5"/><rect x="3" y="13" width="8" height="8" rx="2.5"/><rect fill="currentColor" fill-opacity=".14" x="13" y="13" width="8" height="8" rx="2.5"/></svg>
  </div>
`;

const SVG_TOOL_COMPRESS_PDF = `
  <div class="icon-outline icon-outline--orange" data-ref="icon-outline-compress-pdf">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v6m0 0-2.5-2.5M12 9l2.5-2.5"/><path d="M12 21v-6m0 0-2.5 2.5M12 15l2.5 2.5"/><path d="M5 12h14"/></svg>
  </div>
`;

const SVG_TOOL_REPAIR_PDF = `
  <div class="icon-outline icon-outline--orange" data-ref="icon-outline-repair-pdf">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path fill="currentColor" fill-opacity=".14" d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
  </div>
`;

const SVG_TOOL_OCR_PDF = `
  <div class="icon-outline icon-outline--orange" data-ref="icon-outline-ocr-pdf">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V7a3 3 0 0 1 3-3h2"/><path d="M15 4h2a3 3 0 0 1 3 3v2"/><path d="M20 15v2a3 3 0 0 1-3 3h-2"/><path d="M9 20H7a3 3 0 0 1-3-3v-2"/><path d="M9.5 16l2.5-7 2.5 7M10.4 13.6h3.2"/></svg>
  </div>
`;

const SVG_TOOL_JPG_TO_PDF = `
  <div class="icon-outline icon-outline--blue" data-ref="icon-outline-jpg-to-pdf">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><mask id="c-jpg-to-pdf"><rect width="24" height="24" fill="#fff"/><circle cx="17.5" cy="17.5" r="6.6" fill="#000"/></mask><g mask="url(#c-jpg-to-pdf)"><rect fill="currentColor" fill-opacity=".14" x="3" y="3" width="14" height="14" rx="4"/><circle cx="7.6" cy="7.6" r="1.1"/><path d="M3.5 14.5l3.4-3.4a1.6 1.6 0 0 1 2.2 0L15 17"/></g><mask id="m-jpg-to-pdf"><rect width="24" height="24" fill="#fff"/><path d="M15.3 17.5h4.4M18 15.7l1.8 1.8-1.8 1.8" stroke="#000" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" fill="none"/></mask><circle cx="17.5" cy="17.5" r="5" fill="currentColor" stroke="none" mask="url(#m-jpg-to-pdf)"/></svg>
  </div>
`;

const SVG_TOOL_WORD_TO_PDF = `
  <div class="icon-outline icon-outline--blue" data-ref="icon-outline-word-to-pdf">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><mask id="c-word-to-pdf"><rect width="24" height="24" fill="#fff"/><circle cx="17.5" cy="17.5" r="6.6" fill="#000"/></mask><g mask="url(#c-word-to-pdf)"><rect fill="currentColor" fill-opacity=".14" x="3" y="3" width="14" height="14" rx="4"/><path d="M7 8h6M7 11h6M7 14h3"/></g><mask id="m-word-to-pdf"><rect width="24" height="24" fill="#fff"/><path d="M15.3 17.5h4.4M18 15.7l1.8 1.8-1.8 1.8" stroke="#000" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" fill="none"/></mask><circle cx="17.5" cy="17.5" r="5" fill="currentColor" stroke="none" mask="url(#m-word-to-pdf)"/></svg>
  </div>
`;

const SVG_TOOL_POWERPOINT_TO_PDF = `
  <div class="icon-outline icon-outline--blue" data-ref="icon-outline-powerpoint-to-pdf">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><mask id="c-powerpoint-to-pdf"><rect width="24" height="24" fill="#fff"/><circle cx="17.5" cy="17.5" r="6.6" fill="#000"/></mask><g mask="url(#c-powerpoint-to-pdf)"><rect fill="currentColor" fill-opacity=".14" x="3" y="3" width="14" height="10" rx="3"/><path d="M8.5 13v3.5M6 16.5h5"/></g><mask id="m-powerpoint-to-pdf"><rect width="24" height="24" fill="#fff"/><path d="M15.3 17.5h4.4M18 15.7l1.8 1.8-1.8 1.8" stroke="#000" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" fill="none"/></mask><circle cx="17.5" cy="17.5" r="5" fill="currentColor" stroke="none" mask="url(#m-powerpoint-to-pdf)"/></svg>
  </div>
`;

const SVG_TOOL_EXCEL_TO_PDF = `
  <div class="icon-outline icon-outline--blue" data-ref="icon-outline-excel-to-pdf">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><mask id="c-excel-to-pdf"><rect width="24" height="24" fill="#fff"/><circle cx="17.5" cy="17.5" r="6.6" fill="#000"/></mask><g mask="url(#c-excel-to-pdf)"><rect fill="currentColor" fill-opacity=".14" x="3" y="3" width="14" height="14" rx="4"/><path d="M3 8.5h14M10 8.5V17"/></g><mask id="m-excel-to-pdf"><rect width="24" height="24" fill="#fff"/><path d="M15.3 17.5h4.4M18 15.7l1.8 1.8-1.8 1.8" stroke="#000" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" fill="none"/></mask><circle cx="17.5" cy="17.5" r="5" fill="currentColor" stroke="none" mask="url(#m-excel-to-pdf)"/></svg>
  </div>
`;

const SVG_TOOL_HTML_TO_PDF = `
  <div class="icon-outline icon-outline--blue" data-ref="icon-outline-html-to-pdf">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><mask id="c-html-to-pdf"><rect width="24" height="24" fill="#fff"/><circle cx="17.5" cy="17.5" r="6.6" fill="#000"/></mask><g mask="url(#c-html-to-pdf)"><rect fill="currentColor" fill-opacity=".14" x="3" y="3" width="14" height="14" rx="4"/><path d="M3 8h14"/><path d="M8 10.5l-1.6 2 1.6 2M12 10.5l1.6 2-1.6 2"/></g><mask id="m-html-to-pdf"><rect width="24" height="24" fill="#fff"/><path d="M15.3 17.5h4.4M18 15.7l1.8 1.8-1.8 1.8" stroke="#000" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" fill="none"/></mask><circle cx="17.5" cy="17.5" r="5" fill="currentColor" stroke="none" mask="url(#m-html-to-pdf)"/></svg>
  </div>
`;

const SVG_TOOL_PDF_TO_JPG = `
  <div class="icon-outline icon-outline--green" data-ref="icon-outline-pdf-to-jpg">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><mask id="c-pdf-to-jpg"><rect width="24" height="24" fill="#fff"/><circle cx="17.5" cy="17.5" r="6.6" fill="#000"/></mask><g mask="url(#c-pdf-to-jpg)"><rect fill="currentColor" fill-opacity=".14" x="3" y="3" width="14" height="14" rx="4"/><circle cx="7.6" cy="7.6" r="1.1"/><path d="M3.5 14.5l3.4-3.4a1.6 1.6 0 0 1 2.2 0L15 17"/></g><mask id="m-pdf-to-jpg"><rect width="24" height="24" fill="#fff"/><path d="M19.7 17.5h-4.4M17.4 15.7l-1.8 1.8 1.8 1.8" stroke="#000" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" fill="none"/></mask><circle cx="17.5" cy="17.5" r="5" fill="currentColor" stroke="none" mask="url(#m-pdf-to-jpg)"/></svg>
  </div>
`;

const SVG_TOOL_PDF_TO_WORD = `
  <div class="icon-outline icon-outline--green" data-ref="icon-outline-pdf-to-word">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><mask id="c-pdf-to-word"><rect width="24" height="24" fill="#fff"/><circle cx="17.5" cy="17.5" r="6.6" fill="#000"/></mask><g mask="url(#c-pdf-to-word)"><rect fill="currentColor" fill-opacity=".14" x="3" y="3" width="14" height="14" rx="4"/><path d="M7 8h6M7 11h6M7 14h3"/></g><mask id="m-pdf-to-word"><rect width="24" height="24" fill="#fff"/><path d="M19.7 17.5h-4.4M17.4 15.7l-1.8 1.8 1.8 1.8" stroke="#000" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" fill="none"/></mask><circle cx="17.5" cy="17.5" r="5" fill="currentColor" stroke="none" mask="url(#m-pdf-to-word)"/></svg>
  </div>
`;

const SVG_TOOL_PDF_TO_POWERPOINT = `
  <div class="icon-outline icon-outline--green" data-ref="icon-outline-pdf-to-powerpoint">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><mask id="c-pdf-to-powerpoint"><rect width="24" height="24" fill="#fff"/><circle cx="17.5" cy="17.5" r="6.6" fill="#000"/></mask><g mask="url(#c-pdf-to-powerpoint)"><rect fill="currentColor" fill-opacity=".14" x="3" y="3" width="14" height="10" rx="3"/><path d="M8.5 13v3.5M6 16.5h5"/></g><mask id="m-pdf-to-powerpoint"><rect width="24" height="24" fill="#fff"/><path d="M19.7 17.5h-4.4M17.4 15.7l-1.8 1.8 1.8 1.8" stroke="#000" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" fill="none"/></mask><circle cx="17.5" cy="17.5" r="5" fill="currentColor" stroke="none" mask="url(#m-pdf-to-powerpoint)"/></svg>
  </div>
`;

const SVG_TOOL_PDF_TO_EXCEL = `
  <div class="icon-outline icon-outline--green" data-ref="icon-outline-pdf-to-excel">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><mask id="c-pdf-to-excel"><rect width="24" height="24" fill="#fff"/><circle cx="17.5" cy="17.5" r="6.6" fill="#000"/></mask><g mask="url(#c-pdf-to-excel)"><rect fill="currentColor" fill-opacity=".14" x="3" y="3" width="14" height="14" rx="4"/><path d="M3 8.5h14M10 8.5V17"/></g><mask id="m-pdf-to-excel"><rect width="24" height="24" fill="#fff"/><path d="M19.7 17.5h-4.4M17.4 15.7l-1.8 1.8 1.8 1.8" stroke="#000" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" fill="none"/></mask><circle cx="17.5" cy="17.5" r="5" fill="currentColor" stroke="none" mask="url(#m-pdf-to-excel)"/></svg>
  </div>
`;

const SVG_TOOL_PDF_TO_PDFA = `
  <div class="icon-outline icon-outline--green" data-ref="icon-outline-pdf-to-pdfa">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path fill="currentColor" fill-opacity=".14" d="M12 3l7 2.5v5.5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V5.5z"/><path d="M9 12l2 2 4-4"/></svg>
  </div>
`;

const SVG_TOOL_ROTATE_PDF = `
  <div class="icon-outline icon-outline--purple" data-ref="icon-outline-rotate-pdf">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
  </div>
`;

const SVG_TOOL_PAGE_NUMBERS = `
  <div class="icon-outline icon-outline--purple" data-ref="icon-outline-page-numbers">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path fill="currentColor" fill-opacity=".14" d="M14 3H8a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3V8z"/><path d="M14 3v3.5A1.5 1.5 0 0 0 15.5 8H19"/><path d="M10.5 14l1.5-1.2V18"/></svg>
  </div>
`;

const SVG_TOOL_WATERMARK_PDF = `
  <div class="icon-outline icon-outline--purple" data-ref="icon-outline-watermark-pdf">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path fill="currentColor" fill-opacity=".14" d="M12 3.5c3 3.5 6 6.2 6 10a6 6 0 0 1-12 0c0-3.8 3-6.5 6-10z"/><path d="M9.5 14a2.5 2.5 0 0 0 2.5 2.5"/></svg>
  </div>
`;

const SVG_TOOL_CROP_PDF = `
  <div class="icon-outline icon-outline--purple" data-ref="icon-outline-crop-pdf">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3v11a3 3 0 0 0 3 3h11"/><path d="M17 21V10a3 3 0 0 0-3-3H3"/></svg>
  </div>
`;

const SVG_TOOL_EDIT_PDF = `
  <div class="icon-outline icon-outline--purple" data-ref="icon-outline-edit-pdf">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path fill="currentColor" fill-opacity=".14" d="M15.5 4.5l4 4L9 19l-5 1 1-5z"/><path d="M13.5 6.5l4 4"/></svg>
  </div>
`;

const SVG_TOOL_PROTECT_PDF = `
  <div class="icon-outline icon-outline--crimson" data-ref="icon-outline-protect-pdf">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect fill="currentColor" fill-opacity=".14" x="5" y="11" width="14" height="10" rx="3.5"/><path d="M12 15.5v2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>
  </div>
`;

const SVG_TOOL_UNLOCK_PDF = `
  <div class="icon-outline icon-outline--crimson" data-ref="icon-outline-unlock-pdf">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect fill="currentColor" fill-opacity=".14" x="5" y="11" width="14" height="10" rx="3.5"/><path d="M12 15.5v2"/><path d="M8.5 11V7.5a3.5 3.5 0 0 1 6.8-1.2"/></svg>
  </div>
`;

const SVG_TOOL_REDACT_PDF = `
  <div class="icon-outline icon-outline--crimson" data-ref="icon-outline-redact-pdf">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path fill="currentColor" fill-opacity=".14" d="M14 3H8a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3V8z"/><path d="M14 3v3.5A1.5 1.5 0 0 0 15.5 8H19"/><path d="M8.5 12.5h4"/><rect x="8.5" y="15" width="7" height="3" rx="1.5" fill="currentColor" stroke="none"/></svg>
  </div>
`;

const SVG_TOOL_COMPARE_PDF = `
  <div class="icon-outline icon-outline--crimson" data-ref="icon-outline-compare-pdf">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect fill="currentColor" fill-opacity=".14" x="3" y="4" width="8.5" height="16" rx="3"/><rect x="12.5" y="4" width="8.5" height="16" rx="3"/><path d="M15.7 9h2.1"/></svg>
  </div>
`;

const SVG_TOOL_SUMMARIZE_PDF = `
  <div class="icon-outline icon-outline--cyan" data-ref="icon-outline-summarize-pdf">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path fill="currentColor" fill-opacity=".14" d="M14 3H8a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3V8z"/><path d="M14 3v3.5A1.5 1.5 0 0 0 15.5 8H19"/><path d="M8.5 12.5h7M8.5 16h4"/></svg>
  </div>
`;

const SVG_TOOL_TRANSLATE_PDF = `
  <div class="icon-outline icon-outline--cyan" data-ref="icon-outline-translate-pdf">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle fill="currentColor" fill-opacity=".14" cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.6 2.6 4 5.6 4 9s-1.4 6.4-4 9c-2.6-2.6-4-5.6-4-9s1.4-6.4 4-9z"/></svg>
  </div>
`;

const SVG_TOOL_PDF_TO_MARKDOWN = `
  <div class="icon-outline icon-outline--cyan" data-ref="icon-outline-pdf-to-markdown">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><mask id="c-pdf-to-markdown"><rect width="24" height="24" fill="#fff"/><circle cx="17.5" cy="17.5" r="6.6" fill="#000"/></mask><g mask="url(#c-pdf-to-markdown)"><rect fill="currentColor" fill-opacity=".14" x="3" y="3" width="14" height="14" rx="4"/><path d="M8 6.5l-.6 8M12 6.5l-.6 8M5.5 9h8M5.2 12h8"/></g><mask id="m-pdf-to-markdown"><rect width="24" height="24" fill="#fff"/><path d="M19.7 17.5h-4.4M17.4 15.7l-1.8 1.8 1.8 1.8" stroke="#000" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" fill="none"/></mask><circle cx="17.5" cy="17.5" r="5" fill="currentColor" stroke="none" mask="url(#m-pdf-to-markdown)"/></svg>
  </div>
`;

const SVG_TOOL_CREATE_WORKFLOW = `
  <div class="icon-outline icon-outline--blue" data-ref="icon-outline-create-workflow">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="9" width="6" height="6" rx="1.5" />
      <rect x="15" y="3.5" width="6" height="6" rx="1.5" />
      <rect x="15" y="14.5" width="6" height="6" rx="1.5" />
      <path d="M9 12h3m0-5.5v11m0-11h3m-3 11h3" />
    </svg>
  </div>
`;

const SVG_TOOL_WORKFLOW = `
  <div class="icon-outline icon-outline--indigo" data-ref="icon-outline-workflow">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="9" width="6" height="6" rx="1.5" />
      <rect x="15" y="3.5" width="6" height="6" rx="1.5" />
      <rect x="15" y="14.5" width="6" height="6" rx="1.5" />
      <path d="M9 12h3m0-5.5v11m0-11h3m-3 11h3" />
    </svg>
  </div>
`;

const SVG_TOOL_DESIGN_PDF = `
  <div class="icon-outline icon-outline--purple" data-ref="icon-outline-design-pdf">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <circle cx="10" cy="13" r="1.5" />
      <rect x="13.5" y="11.5" width="3" height="3" rx="0.5" />
      <path d="M8 17.5h8" />
    </svg>
  </div>
`;

const SVG_TOOL_COLLABORATIVE_PDF = SVG_TOOL_DESIGN_PDF;

export { SVG_TOOL_COLLABORATIVE_PDF, SVG_TOOL_COMPARE_PDF, SVG_TOOL_COMPRESS_PDF, SVG_TOOL_CREATE_WORKFLOW, SVG_TOOL_CROP_PDF, SVG_TOOL_DESIGN_PDF, SVG_TOOL_EDIT_PDF, SVG_TOOL_EXCEL_TO_PDF, SVG_TOOL_EXTRACT_PDF_PAGES, SVG_TOOL_HTML_TO_PDF, SVG_TOOL_JPG_TO_PDF, SVG_TOOL_MERGE_PDF, SVG_TOOL_OCR_PDF, SVG_TOOL_ORGANIZE_PDF, SVG_TOOL_PAGE_NUMBERS, SVG_TOOL_PDF_TO_EXCEL, SVG_TOOL_PDF_TO_JPG, SVG_TOOL_PDF_TO_MARKDOWN, SVG_TOOL_PDF_TO_PDFA, SVG_TOOL_PDF_TO_POWERPOINT, SVG_TOOL_PDF_TO_WORD, SVG_TOOL_POWERPOINT_TO_PDF, SVG_TOOL_PROTECT_PDF, SVG_TOOL_REDACT_PDF, SVG_TOOL_REMOVE_PDF_PAGES, SVG_TOOL_REPAIR_PDF, SVG_TOOL_ROTATE_PDF, SVG_TOOL_SPLIT_PDF, SVG_TOOL_SUMMARIZE_PDF, SVG_TOOL_TRANSLATE_PDF, SVG_TOOL_UNLOCK_PDF, SVG_TOOL_WATERMARK_PDF, SVG_TOOL_WORD_TO_PDF, SVG_TOOL_WORKFLOW };

import os
import re
import json
from pathlib import Path

BASE_DIR = Path("apps/BoardPDF")
VIEWS_DIR = BASE_DIR / "public" / "views"
CLIENT_DIR = BASE_DIR / "client"
INDEX_HTML = BASE_DIR / "index.html"
OUTPUT_JSON = Path("scripts/alive_classes.json")

DYNAMIC_WHITELIST_REGEXES = [
    r"^is-pos-(top|center|bottom)-(left|center|right)$",
    r"^modal-card--(sm|md|lg)$",
    r"^toast-item--(success|danger|warning|info)$",
    r"^contact-ticket-status-badge--.*",
    r"^contact-ticket-msg--(customer|agent)$",
    r"^sortable-(ghost|chosen|drag)$",
    r"^(textLayer|annotationLayer|canvasWrapper|page)$",
    r"^is-(active|open|disabled|hidden|loading|processing|selected|visible|dragging|dragover|marked-remove|mobile-open|ready|success|error|editable|scanned|page-selected|page-locked|full-redacted)$",
    r"^component-button--.*",
    r"^banner--.*",
    r"^field--.*",
    r"^theme-.*",
    r"^table-user-avatar--.*",
    r"^account-item--.*",
    r"^component-empty-state--.*",
    r"^collaborative-.*",
    r"^fa-.*",
]

COMPILED_PATTERNS = [re.compile(p) for p in DYNAMIC_WHITELIST_REGEXES]

def extract_all():
    files = [INDEX_HTML] if INDEX_HTML.exists() else []
    files.extend(list(VIEWS_DIR.rglob("*.html")))
    files.extend(list(CLIENT_DIR.rglob("*.ts")))
    
    classes = set()
    raw_tokens = set()
    
    for f in files:
        txt = f.read_text(encoding="utf-8")
        
        # 1. HTML class attributes: class="..." or class='...'
        for m in re.findall(r'class=["\']([^"\']+)["\']', txt):
            for c in m.split():
                clean = c.strip()
                if clean:
                    classes.add(clean)
                    
        # 2. classList operations
        for m in re.findall(r'classList\.(?:add|remove|toggle|contains)\(([^)]+)\)', txt):
            for tok in re.findall(r'["\']([a-zA-Z_][a-zA-Z0-9_-]*)["\']', m):
                classes.add(tok)
                
        # 3. className assignments
        for m in re.findall(r'className\s*[+]?=\s*["\']([^"\']+)["\']', txt):
            for c in m.split():
                clean = c.strip()
                if clean:
                    classes.add(clean)
                    
        # 4. Quoted tokens in TS files (to catch dynamic references like `btn-${variant}` or ternary classes)
        for tok in re.findall(r'["\']([a-zA-Z_][a-zA-Z0-9_-]{2,})["\']', txt):
            raw_tokens.add(tok)
            
    # Include all raw tokens that could match CSS classes
    classes.update(raw_tokens)
    
    payload = {
        "classes": sorted(list(classes)),
        "dynamic_regexes": DYNAMIC_WHITELIST_REGEXES
    }
    
    OUTPUT_JSON.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Extracted {len(classes)} alive class identifiers and tokens to {OUTPUT_JSON}")

if __name__ == "__main__":
    extract_all()

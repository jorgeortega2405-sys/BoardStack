from collections import Counter, defaultdict
from pathlib import Path
import re


EXCLUDED_DIRS = {"node_modules", "dist", "target", ".git", "Python", "_cache"}

VALID_CSS_CLASS_RE = re.compile(r"^[a-zA-Z_-][a-zA-Z0-9_-]*$")

COMPARISON_LITERAL_RE = re.compile(
    r"(?:===|!==|==|!=)\s*(['\"`])(?:\\.|(?!\1)[^\\])*\1"
    r"|(['\"`])(?:\\.|(?!\2)[^\\])*\2\s*(?:===|!==|==|!=)"
    r"|\.(?:includes|startsWith|endsWith|getAttribute|hasAttribute|closest|querySelector|querySelectorAll|matches)\s*\(\s*(['\"`])(?:\\.|(?!\3)[^\\])*\3\s*\)"
)


def strip_comments_preserve_lines(ts_text: str) -> str:
    pattern = re.compile(
        r'("(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'|`(?:\\.|[^`\\])*`)|(/\*[\s\S]*?\*/|//[^\n]*)'
    )

    def replacer(match: re.Match[str]) -> str:
        if match.group(2) is not None:
            return re.sub(r"[^\n]", " ", match.group(2))
        return match.group(0)

    return pattern.sub(replacer, ts_text)


def strip_comparison_literals(expr: str) -> str:
    cleaned = COMPARISON_LITERAL_RE.sub(" ", expr)
    if "?" in cleaned:
        q_idx = cleaned.find("?")
        condition_part = cleaned[:q_idx]
        branches_part = cleaned[q_idx + 1 :]
        condition_cleaned = re.sub(r"""(['"`])(?:\\.|(?!\1)[^\\])*\1""", " ", condition_part)
        return condition_cleaned + " ? " + branches_part
    return cleaned


def split_first_arg(args_str: str) -> str:
    depth = 0
    in_quote: str | None = None
    escaped = False
    for idx, ch in enumerate(args_str):
        if escaped:
            escaped = False
            continue
        if ch == "\\":
            escaped = True
            continue
        if in_quote is not None:
            if ch == in_quote:
                in_quote = None
            continue
        if ch in ("'", '"', "`"):
            in_quote = ch
            continue
        if ch in ("(", "[", "{"):
            depth += 1
        elif ch in (")", "]", "}"):
            depth = max(0, depth - 1)
        elif ch == "," and depth == 0:
            return args_str[:idx]
    return args_str


def find_ts_files(root_dir: Path) -> list[Path]:
    ts_files: list[Path] = []
    for path in root_dir.rglob("*.ts"):
        if any(part in EXCLUDED_DIRS for part in path.parts):
            continue
        ts_files.append(path)
    return sorted(ts_files)


def extract_classes_from_class_value_expr(expr: str) -> list[tuple[str, bool]]:
    results: list[tuple[str, bool]] = []
    literal_in_interp = re.compile(r"""(['"])([a-zA-Z0-9_\-\s]+)\1""")

    prefix_interp_pattern = re.compile(r"([a-zA-Z_-][a-zA-Z0-9_-]*-)\$\{([^}]+)\}")

    def handle_prefix_interp(p_match: re.Match[str]) -> str:
        prefix = p_match.group(1)
        inner = strip_comparison_literals(p_match.group(2))
        branch_literals: list[str] = []
        for lit_m in literal_in_interp.finditer(inner):
            for tok in lit_m.group(2).split():
                if re.match(r"^[a-zA-Z0-9_-]+$", tok):
                    branch_literals.append(tok)
        if branch_literals:
            for suffix in branch_literals:
                full_cls = f"{prefix}{suffix}"
                if VALID_CSS_CLASS_RE.match(full_cls) and not full_cls.endswith("-"):
                    results.append((full_cls, False))
        else:
            results.append((f"{prefix}*", True))
        return " "

    working_expr = prefix_interp_pattern.sub(handle_prefix_interp, expr)

    interp_pattern = re.compile(r"\$\{([^}]+)\}")

    def handle_standalone_interp(i_match: re.Match[str]) -> str:
        inner = strip_comparison_literals(i_match.group(1))
        for lit_m in literal_in_interp.finditer(inner):
            for token in lit_m.group(2).split():
                if VALID_CSS_CLASS_RE.match(token) and not token.endswith("-"):
                    results.append((token, False))
        return " "

    working_expr = interp_pattern.sub(handle_standalone_interp, working_expr)

    for token in working_expr.split():
        if VALID_CSS_CLASS_RE.match(token) and not token.endswith("-"):
            results.append((token, False))

    return results


def extract_classes_from_js_expr(rhs_expr: str) -> list[tuple[str, bool]]:
    results: list[tuple[str, bool]] = []
    cleaned_rhs = strip_comparison_literals(rhs_expr)
    string_lit_re = re.compile(r"""(['"`])((?:\\.|(?!\1)[^\\])*)\1""")

    for lit_match in string_lit_re.finditer(cleaned_rhs):
        quote = lit_match.group(1)
        lit_val = lit_match.group(2)
        if quote == "`" and "${" in lit_val:
            results.extend(extract_classes_from_class_value_expr(lit_val))
        else:
            for token in lit_val.split():
                if VALID_CSS_CLASS_RE.match(token) and not token.endswith("-"):
                    results.append((token, False))

    return results


def extract_ts_css_classes_from_file(ts_text: str) -> list[tuple[int, str, str, bool]]:
    code = strip_comments_preserve_lines(ts_text)
    occurrences: list[tuple[int, str, str, bool]] = []

    def get_line(offset: int) -> int:
        return code.count("\n", 0, offset) + 1

    html_class_attr_re = re.compile(r'\bclass\s*=\s*(?:"([^"]*)"|\'([^\']*)\')')
    for match in html_class_attr_re.finditer(code):
        val = match.group(1) if match.group(1) is not None else (match.group(2) or "")
        line_no = get_line(match.start())
        for cls_name, is_dynamic in extract_classes_from_class_value_expr(val):
            occurrences.append((line_no, "html-class-attr", cls_name, is_dynamic))

    classlist_re = re.compile(
        r"\.classList\s*\.\s*(add|remove|toggle|contains|replace)\s*\(([^;]+?)\)(?=\s*[;,\n)\]}])"
    )
    for match in classlist_re.finditer(code):
        method = match.group(1)
        args_str = match.group(2)
        line_no = get_line(match.start())
        target_args = split_first_arg(args_str) if method in ("toggle", "contains") else args_str
        for cls_name, is_dynamic in extract_classes_from_js_expr(target_args):
            occurrences.append((line_no, f"classList.{method}", cls_name, is_dynamic))

    classname_assign_re = re.compile(r"\.className\s*\+?=\s*([^;\n]+)")
    for match in classname_assign_re.finditer(code):
        rhs = match.group(1)
        line_no = get_line(match.start())
        for cls_name, is_dynamic in extract_classes_from_js_expr(rhs):
            occurrences.append((line_no, "className-assign", cls_name, is_dynamic))

    var_class_assign_re = re.compile(
        r"\b(?:const|let|var)\s+\w*(?:Class|ClassName|Classes)\s*=\s*([^;\n]+)"
    )
    for match in var_class_assign_re.finditer(code):
        rhs = match.group(1)
        line_no = get_line(match.start())
        for cls_name, is_dynamic in extract_classes_from_js_expr(rhs):
            occurrences.append((line_no, "class-var-assign", cls_name, is_dynamic))

    set_attr_class_re = re.compile(
        r"\.setAttribute\s*\(\s*['\"]class['\"]\s*,\s*([^;]+?)\)(?=\s*[;,\n)\]}])"
    )
    for match in set_attr_class_re.finditer(code):
        arg_rhs = match.group(1)
        line_no = get_line(match.start())
        for cls_name, is_dynamic in extract_classes_from_js_expr(arg_rhs):
            occurrences.append((line_no, "setAttribute-class", cls_name, is_dynamic))

    selector_method_re = re.compile(
        r"\.(querySelector|querySelectorAll|closest|matches)\s*(?:<[^>]*>)?\s*\(\s*(['\"`])((?:\\.|(?!\2)[^\\])*)\2"
    )
    css_dot_class_re = re.compile(r"\.([a-zA-Z_-][a-zA-Z0-9_-]*)")
    for match in selector_method_re.finditer(code):
        method = match.group(1)
        raw_selector = match.group(3)
        line_no = get_line(match.start())
        without_interp = re.sub(r"\$\{[^}]*\}", "", raw_selector)
        without_attrs = re.sub(r"\[[^\]]*\]", "", without_interp)
        for cls_match in css_dot_class_re.finditer(without_attrs):
            cls_name = cls_match.group(1)
            if VALID_CSS_CLASS_RE.match(cls_name):
                occurrences.append((line_no, f"selector-{method}", cls_name, False))

    prop_class_re = re.compile(
        r"\b(className|ghostClass|chosenClass|dragClass|fallbackClass|iconClass|badgeClass|customClass)\s*:\s*(['\"`])((?:\\.|(?!\2)[^\\])*)\2"
    )
    for match in prop_class_re.finditer(code):
        prop_name = match.group(1)
        quote = match.group(2)
        lit_val = match.group(3)
        line_no = get_line(match.start())
        if quote == "`" and "${" in lit_val:
            for cls_name, is_dynamic in extract_classes_from_class_value_expr(lit_val):
                occurrences.append((line_no, f"prop-{prop_name}", cls_name, is_dynamic))
        else:
            for token in lit_val.split():
                if VALID_CSS_CLASS_RE.match(token):
                    occurrences.append((line_no, f"prop-{prop_name}", token, False))

    return occurrences


def extract_all_ts_classes(root_dir: Path, output_file: Path) -> None:
    ts_files = find_ts_files(root_dir)

    global_unique_classes: set[str] = set()
    global_dynamic_patterns: set[str] = set()
    global_class_counts: Counter[str] = Counter()
    class_to_files: defaultdict[str, set[str]] = defaultdict(set)
    class_to_file_counts: defaultdict[str, Counter[str]] = defaultdict(Counter)
    class_to_methods: defaultdict[str, set[str]] = defaultdict(set)
    per_file_entries: dict[str, list[tuple[int, str, str, bool]]] = {}
    per_file_unique: dict[str, list[str]] = {}

    total_occurrences = 0
    files_with_classes = 0

    for ts_path in ts_files:
        rel_path = ts_path.relative_to(root_dir).as_posix()
        content = ts_path.read_text(encoding="utf-8")
        entries = extract_ts_css_classes_from_file(content)
        if not entries:
            continue

        files_with_classes += 1
        file_unique_set: set[str] = set()
        for _, method, cls_name, is_dynamic in entries:
            total_occurrences += 1
            file_unique_set.add(cls_name)
            if is_dynamic:
                global_dynamic_patterns.add(cls_name)
            else:
                global_unique_classes.add(cls_name)
            global_class_counts[cls_name] += 1
            class_to_files[cls_name].add(rel_path)
            class_to_file_counts[cls_name][rel_path] += 1
            class_to_methods[cls_name].add(method)

        per_file_entries[rel_path] = entries
        per_file_unique[rel_path] = sorted(file_unique_set)

    sorted_static_classes = sorted(global_unique_classes)
    sorted_dynamic_patterns = sorted(global_dynamic_patterns)
    all_unique_combined = sorted(global_unique_classes | global_dynamic_patterns)

    lines: list[str] = []
    lines.append("=" * 100)
    lines.append("TYPESCRIPT (.ts) CSS CLASSES REGISTRY - COMPLETE REPORT WITH SOURCE FILES")
    lines.append("=" * 100)
    lines.append(f"Total TypeScript files scanned            : {len(ts_files)}")
    lines.append(f"TypeScript files containing CSS classes   : {files_with_classes}")
    lines.append(f"Total CSS class reference occurrences     : {total_occurrences}")
    lines.append(f"Total unique static CSS classes           : {len(sorted_static_classes)}")
    lines.append(f"Total dynamic CSS class prefix patterns   : {len(sorted_dynamic_patterns)}")
    lines.append(f"Total unique CSS classes + patterns       : {len(all_unique_combined)}")
    lines.append("=" * 100)
    lines.append("")

    lines.append("=" * 100)
    lines.append(f"SECTION 1: ALL UNIQUE STATIC CSS CLASSES WITH SOURCE FILES ({len(sorted_static_classes)} TOTAL)")
    lines.append("=" * 100)
    for idx, cls_name in enumerate(sorted_static_classes, start=1):
        files_with_counts = ", ".join(
            f"{f} ({class_to_file_counts[cls_name][f]})" for f in sorted(class_to_files[cls_name])
        )
        methods_str = ", ".join(sorted(class_to_methods[cls_name]))
        lines.append(
            f"{idx:04d}. {cls_name} -> [{files_with_counts}] (occurrences: {global_class_counts[cls_name]}, files: {len(class_to_files[cls_name])}, via: {methods_str})"
        )
    lines.append("")

    lines.append("=" * 100)
    lines.append(f"SECTION 2: DYNAMIC CSS CLASS PREFIX PATTERNS ({len(sorted_dynamic_patterns)} TOTAL)")
    lines.append("=" * 100)
    for idx, pat_name in enumerate(sorted_dynamic_patterns, start=1):
        files_with_counts = ", ".join(
            f"{f} ({class_to_file_counts[pat_name][f]})" for f in sorted(class_to_files[pat_name])
        )
        methods_str = ", ".join(sorted(class_to_methods[pat_name]))
        lines.append(
            f"{idx:04d}. {pat_name} -> [{files_with_counts}] (occurrences: {global_class_counts[pat_name]}, via: {methods_str})"
        )
    lines.append("")

    lines.append("=" * 100)
    lines.append("SECTION 3: DIRECT LIST OF ALL CLASSES WITH SOURCE FILES")
    lines.append("=" * 100)
    for cls_name in all_unique_combined:
        files_str = ", ".join(sorted(class_to_files[cls_name]))
        lines.append(f"{cls_name} | {files_str}")
    lines.append("")

    lines.append("=" * 100)
    lines.append("SECTION 4: UNIQUE CSS CLASSES GROUPED BY TYPESCRIPT FILE")
    lines.append("=" * 100)
    for rel_path in sorted(per_file_unique.keys()):
        unique_list = per_file_unique[rel_path]
        lines.append(f"[{rel_path}] (unique classes: {len(unique_list)})")
        for cls_name in unique_list:
            count_in_file = class_to_file_counts[cls_name][rel_path]
            lines.append(f"  - {cls_name} | {rel_path} (occurrences in file: {count_in_file})")
        lines.append("")

    lines.append("=" * 100)
    lines.append("SECTION 5: EVERY CLASS REFERENCE BY FILE, LINE AND METHOD (EXHAUSTIVE LOG)")
    lines.append("=" * 100)
    for rel_path in sorted(per_file_entries.keys()):
        entries = per_file_entries[rel_path]
        lines.append(f"[{rel_path}] (total references: {len(entries)})")
        for line_no, method, cls_name, is_dynamic in entries:
            dyn_tag = " [DYNAMIC-PREFIX]" if is_dynamic else ""
            lines.append(f"  {rel_path}:{line_no:04d} | {cls_name}{dyn_tag} | via: {method}")
        lines.append("")

    output_file.write_text("\n".join(lines), encoding="utf-8")
    print(f"Scanned {len(ts_files)} TS files ({files_with_classes} with CSS classes).")
    print(
        f"Found {len(sorted_static_classes)} static classes + {len(sorted_dynamic_patterns)} dynamic patterns across {total_occurrences} total occurrences."
    )
    print(f"Registry saved to: {output_file}")


if __name__ == "__main__":
    workspace_root = Path(__file__).resolve().parents[3]
    output_path = workspace_root / "ts_classes_registry.txt"
    extract_all_ts_classes(workspace_root, output_path)

from collections import Counter, defaultdict
from pathlib import Path
import re


EXCLUDED_DIRS = {"node_modules", "dist", "target", ".git", "Python", "_cache"}


def preserve_lines_blank(match: re.Match[str]) -> str:
    return re.sub(r"[^\n]", " ", match.group(0))


def sanitize_css_preserve_lines(css_text: str) -> str:
    without_comments = re.sub(r"/\*[\s\S]*?\*/", preserve_lines_blank, css_text)
    without_strings = re.sub(r'"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'', preserve_lines_blank, without_comments)
    without_attrs = re.sub(r"\[[^\]]*\]", preserve_lines_blank, without_strings)
    return without_attrs


def find_css_files(root_dir: Path) -> list[Path]:
    css_files: list[Path] = []
    for path in root_dir.rglob("*.css"):
        if any(part in EXCLUDED_DIRS for part in path.parts):
            continue
        css_files.append(path)
    return sorted(css_files)


def extract_selectors_with_lines(css_text: str) -> list[tuple[int, str, list[str]]]:
    sanitized = sanitize_css_preserve_lines(css_text)
    raw_without_comments = re.sub(r"/\*[\s\S]*?\*/", preserve_lines_blank, css_text)

    class_pattern = re.compile(r"\.([a-zA-Z_-][a-zA-Z0-9_-]*)")
    block_pattern = re.compile(r"([^{};]+)\{")

    entries: list[tuple[int, str, list[str]]] = []

    for match in block_pattern.finditer(sanitized):
        selector_chunk = match.group(1)
        stripped_chunk = selector_chunk.strip()
        if not stripped_chunk or stripped_chunk.startswith("@"):
            continue

        classes = class_pattern.findall(selector_chunk)
        if not classes:
            continue

        first_non_ws = re.search(r"\S", selector_chunk)
        offset = match.start(1) + (first_non_ws.start() if first_non_ws else 0)
        line_no = sanitized.count("\n", 0, offset) + 1

        raw_selector = raw_without_comments[match.start(1):match.end(1)].strip()
        normalized_selector = " ".join(raw_selector.split())
        entries.append((line_no, normalized_selector, classes))

    return entries


def extract_all_css_classes(root_dir: Path, output_file: Path) -> None:
    css_files = find_css_files(root_dir)

    global_unique_classes: set[str] = set()
    global_class_counts: Counter[str] = Counter()
    class_to_files: defaultdict[str, set[str]] = defaultdict(set)
    class_to_file_counts: defaultdict[str, Counter[str]] = defaultdict(Counter)
    per_file_entries: dict[str, list[tuple[int, str, list[str]]]] = {}
    per_file_unique: dict[str, list[str]] = {}
    total_selectors_with_class = 0
    total_class_occurrences = 0

    for css_path in css_files:
        rel_path = css_path.relative_to(root_dir).as_posix()
        content = css_path.read_text(encoding="utf-8")

        entries = extract_selectors_with_lines(content)
        file_unique_set: set[str] = set()

        for _, _, classes in entries:
            total_selectors_with_class += 1
            for cls_name in classes:
                total_class_occurrences += 1
                file_unique_set.add(cls_name)
                global_unique_classes.add(cls_name)
                global_class_counts[cls_name] += 1
                class_to_files[cls_name].add(rel_path)
                class_to_file_counts[cls_name][rel_path] += 1

        per_file_entries[rel_path] = entries
        per_file_unique[rel_path] = sorted(file_unique_set)

    sorted_global_classes = sorted(global_unique_classes)

    lines: list[str] = []
    lines.append("=" * 100)
    lines.append("CSS FILES CLASSES REGISTRY - COMPLETE REPORT WITH SOURCE FILES")
    lines.append("=" * 100)
    lines.append(f"Total CSS files scanned                 : {len(css_files)}")
    lines.append(f"Total CSS selector rules with classes   : {total_selectors_with_class}")
    lines.append(f"Total CSS class selector occurrences    : {total_class_occurrences}")
    lines.append(f"Total unique CSS classes in stylesheets : {len(sorted_global_classes)}")
    lines.append("=" * 100)
    lines.append("")

    lines.append("=" * 100)
    lines.append(f"SECTION 1: ALL UNIQUE CSS CLASSES WITH SOURCE FILES ({len(sorted_global_classes)} TOTAL)")
    lines.append("=" * 100)
    for idx, cls_name in enumerate(sorted_global_classes, start=1):
        files_with_counts = ", ".join(
            f"{f} ({class_to_file_counts[cls_name][f]})" for f in sorted(class_to_files[cls_name])
        )
        lines.append(
            f"{idx:04d}. {cls_name} -> [{files_with_counts}] (total occurrences: {global_class_counts[cls_name]}, files: {len(class_to_files[cls_name])})"
        )
    lines.append("")

    lines.append("=" * 100)
    lines.append("SECTION 2: DIRECT LIST OF CLASSES WITH SOURCE FILES")
    lines.append("=" * 100)
    for cls_name in sorted_global_classes:
        files_str = ", ".join(sorted(class_to_files[cls_name]))
        lines.append(f"{cls_name} | {files_str}")
    lines.append("")

    lines.append("=" * 100)
    lines.append("SECTION 3: UNIQUE CSS CLASSES GROUPED BY CSS FILE")
    lines.append("=" * 100)
    for rel_path in sorted(per_file_unique.keys()):
        unique_list = per_file_unique[rel_path]
        lines.append(f"[{rel_path}] (unique classes: {len(unique_list)})")
        for cls_name in unique_list:
            count_in_file = class_to_file_counts[cls_name][rel_path]
            lines.append(f"  - {cls_name} | {rel_path} (occurrences in file: {count_in_file})")
        lines.append("")

    lines.append("=" * 100)
    lines.append("SECTION 4: EVERY CLASS SELECTOR RULE BY FILE AND LINE (EXHAUSTIVE LOG)")
    lines.append("=" * 100)
    for rel_path in sorted(per_file_entries.keys()):
        entries = per_file_entries[rel_path]
        lines.append(f"[{rel_path}] (selector rules with class: {len(entries)})")
        for line_no, raw_selector, classes in entries:
            classes_list = ", ".join(classes)
            lines.append(f"  {rel_path}:{line_no:04d} | Selector: {raw_selector} | Classes: [{classes_list}]")
        lines.append("")

    output_file.write_text("\n".join(lines), encoding="utf-8")
    print(f"Scanned {len(css_files)} CSS files.")
    print(f"Found {len(sorted_global_classes)} unique classes across {total_class_occurrences} total occurrences.")
    print(f"Registry saved to: {output_file}")


if __name__ == "__main__":
    workspace_root = Path(__file__).resolve().parents[3]
    output_path = workspace_root / "css_classes_registry.txt"
    extract_all_css_classes(workspace_root, output_path)

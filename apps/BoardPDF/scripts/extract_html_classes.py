from collections import Counter, defaultdict
from html.parser import HTMLParser
from pathlib import Path
import re


EXCLUDED_DIRS = {"node_modules", "dist", "target", ".git", "Python", "_cache"}


class ClassExtractorParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.entries: list[tuple[int, str, str, list[str]]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self._process_attrs(tag, attrs)

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self._process_attrs(tag, attrs)

    def _process_attrs(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        line_no, _ = self.getpos()
        for attr_name, attr_val in attrs:
            if attr_name.lower() == "class" and attr_val is not None:
                classes = [c for c in attr_val.split() if c]
                self.entries.append((line_no, tag, attr_val, classes))


def find_html_files(root_dir: Path) -> list[Path]:
    html_files: list[Path] = []
    for path in root_dir.rglob("*.html"):
        if any(part in EXCLUDED_DIRS for part in path.parts):
            continue
        html_files.append(path)
    return sorted(html_files)


def extract_all_classes(root_dir: Path, output_file: Path) -> None:
    html_files = find_html_files(root_dir)
    class_attr_regex = re.compile(r'\bclass\s*=\s*(?:"([^"]*)"|\'([^\']*)\')', re.IGNORECASE)

    global_unique_classes: set[str] = set()
    global_class_counts: Counter[str] = Counter()
    class_to_files: defaultdict[str, set[str]] = defaultdict(set)
    class_to_file_counts: defaultdict[str, Counter[str]] = defaultdict(Counter)
    per_file_entries: dict[str, list[tuple[int, str, str, list[str]]]] = {}
    per_file_unique: dict[str, list[str]] = {}
    total_elements_with_class = 0
    total_class_tokens = 0

    for html_path in html_files:
        rel_path = html_path.relative_to(root_dir).as_posix()
        content = html_path.read_text(encoding="utf-8")

        parser = ClassExtractorParser()
        parser.feed(content)

        regex_classes: set[str] = set()
        for match in class_attr_regex.finditer(content):
            raw_val = match.group(1) if match.group(1) is not None else (match.group(2) or "")
            for token in raw_val.split():
                if token:
                    regex_classes.add(token)

        file_unique_set: set[str] = set()
        for _, _, _, classes in parser.entries:
            total_elements_with_class += 1
            for cls_name in classes:
                total_class_tokens += 1
                file_unique_set.add(cls_name)
                global_unique_classes.add(cls_name)
                global_class_counts[cls_name] += 1
                class_to_files[cls_name].add(rel_path)
                class_to_file_counts[cls_name][rel_path] += 1

        for extra_cls in regex_classes - file_unique_set:
            file_unique_set.add(extra_cls)
            global_unique_classes.add(extra_cls)
            global_class_counts[extra_cls] += 1
            class_to_files[extra_cls].add(rel_path)
            class_to_file_counts[extra_cls][rel_path] += 1

        per_file_entries[rel_path] = parser.entries
        per_file_unique[rel_path] = sorted(file_unique_set)

    sorted_global_classes = sorted(global_unique_classes)

    lines: list[str] = []
    lines.append("=" * 100)
    lines.append("HTML CSS CLASSES REGISTRY - COMPLETE REPORT WITH SOURCE FILES")
    lines.append("=" * 100)
    lines.append(f"Total HTML files scanned          : {len(html_files)}")
    lines.append(f"Total HTML elements with 'class'  : {total_elements_with_class}")
    lines.append(f"Total CSS class token occurrences : {total_class_tokens}")
    lines.append(f"Total unique CSS classes          : {len(sorted_global_classes)}")
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
    lines.append("SECTION 3: UNIQUE CSS CLASSES GROUPED BY HTML FILE")
    lines.append("=" * 100)
    for rel_path in sorted(per_file_unique.keys()):
        unique_list = per_file_unique[rel_path]
        lines.append(f"[{rel_path}] (unique classes: {len(unique_list)})")
        for cls_name in unique_list:
            count_in_file = class_to_file_counts[cls_name][rel_path]
            lines.append(f"  - {cls_name} | {rel_path} (occurrences in file: {count_in_file})")
        lines.append("")

    lines.append("=" * 100)
    lines.append("SECTION 4: EVERY CLASS OCCURRENCE BY FILE AND LINE (EXHAUSTIVE LOG)")
    lines.append("=" * 100)
    for rel_path in sorted(per_file_entries.keys()):
        entries = per_file_entries[rel_path]
        lines.append(f"[{rel_path}] (elements with class: {len(entries)})")
        for line_no, tag, _, classes in entries:
            normalized = " ".join(classes)
            lines.append(f"  {rel_path}:{line_no:04d} | <{tag}> | class=\"{normalized}\" | classes: [{', '.join(classes)}]")
        lines.append("")

    output_file.write_text("\n".join(lines), encoding="utf-8")
    print(f"Scanned {len(html_files)} HTML files.")
    print(f"Found {len(sorted_global_classes)} unique classes across {total_class_tokens} total occurrences.")
    print(f"Registry saved to: {output_file}")


if __name__ == "__main__":
    workspace_root = Path(__file__).resolve().parents[3]
    output_path = workspace_root / "html_classes_registry.txt"
    extract_all_classes(workspace_root, output_path)

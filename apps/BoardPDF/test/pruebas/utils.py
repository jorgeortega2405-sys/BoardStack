from datetime import datetime
import os
from pathlib import Path
import sys

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
if hasattr(sys.stderr, "reconfigure"):
    try:
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

IS_TTY = sys.stdout.isatty()


def colorize(text: str, color_code: str) -> str:
    if not IS_TTY and os.environ.get("FORCE_COLOR") != "1":
        return text
    return f"\033[{color_code}m{text}\033[0m"


def green(text: str) -> str:
    return colorize(text, "32")


def red(text: str) -> str:
    return colorize(text, "31")


def yellow(text: str) -> str:
    return colorize(text, "33")


def cyan(text: str) -> str:
    return colorize(text, "36")


def bold(text: str) -> str:
    return colorize(text, "1")


def get_boardpdf_root() -> Path:
    current = Path.cwd().resolve()
    if (current / "src" / "index.ts").exists() and (current / "public").exists():
        return current
    if (current / "apps" / "BoardPDF" / "src" / "index.ts").exists():
        return current / "apps" / "BoardPDF"
    
    script_dir = Path(__file__).resolve().parent
    for parent in [script_dir, *script_dir.parents]:
        if (parent / "src" / "index.ts").exists() and (parent / "public").exists():
            return parent
        if (parent / "apps" / "BoardPDF" / "src" / "index.ts").exists():
            return parent / "apps" / "BoardPDF"
    
    return current


def get_test_dir() -> Path:
    root = get_boardpdf_root()
    test_dir = root / "test"
    test_dir.mkdir(parents=True, exist_ok=True)
    return test_dir


def get_archivos_dir() -> Path:
    archivos_dir = get_test_dir() / "archivos"
    archivos_dir.mkdir(parents=True, exist_ok=True)
    return archivos_dir


def get_timestamp_filename(prefijo: str) -> str:
    now = datetime.now()
    fecha_str = now.strftime("%Y-%m-%d_%H-%M-%S")
    return f"reporte_{prefijo}_{fecha_str}.md"


def get_readable_timestamp() -> str:
    return datetime.now().strftime("%d/%m/%Y %H:%M:%S")


def scan_files(directory: Path, extension: str, exclude_dirs: tuple[str, ...] = ("node_modules", "dist", ".git", "test", "tests")) -> list[Path]:
    matched: list[Path] = []
    if not directory.exists():
        return matched

    for root, dirs, files in os.walk(directory):
        dirs[:] = [d for d in dirs if d not in exclude_dirs]
        for f in files:
            if f.endswith(extension):
                matched.append(Path(root) / f)

    return sorted(matched)


def build_markdown_report(
    titulo: str,
    resumen: str,
    metricas: dict[str, str | int],
    secciones: list[tuple[str, str]],
    archivo_salida: str,
) -> Path:
    test_dir = get_test_dir()
    reporte_path = test_dir / archivo_salida

    lineas: list[str] = [
        f"# {titulo}",
        f"**Fecha y Hora de Generación:** {get_readable_timestamp()}",
        "",
        "> [!IMPORTANT]",
        "> **AVISO DE AUDITORÍA Y EVALUACIÓN DE FALSOS POSITIVOS**:",
        "> Este informe recopila detecciones automáticas de código. Sin embargo, en un entorno de producción **siempre existirán falsos positivos legítimos** (por ejemplo: `--layout-scroll-height: 3021px;` que debe ir inline para el cálculo reactivo del layout, o valores de posicionamiento en transformaciones de lienzo, marcas y términos técnicos que no admiten traducción).",
        "> ",
        "> **Antes de aplicar correcciones automáticas o manuales, la Inteligencia Artificial o el desarrollador debe revisar cuidadosamente cada hallazgo** para determinar si efectivamente se puede y debe eliminar el CSS inline, si requiere clave de traducción, o si debe mantenerse intacto.",
        "",
        "## Resumen Ejecutivo",
        resumen,
        "",
        "## Métricas Principales",
        "| Parámetro | Valor |",
        "| :--- | :--- |",
    ]

    for k, v in metricas.items():
        lineas.append(f"| {k} | {v} |")

    lineas.append("")

    for titulo_sec, contenido_sec in secciones:
        lineas.append(f"## {titulo_sec}")
        lineas.append(contenido_sec)
        lineas.append("")

    lineas.append("---")
    lineas.append("*Reporte generado automáticamente por la Suite de Pruebas de BoardPDF.*")

    with open(reporte_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lineas) + "\n")

    return reporte_path

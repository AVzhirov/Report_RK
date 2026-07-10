#!/usr/bin/env python3
"""
Упаковка проекта в ZIP-архив для прямого скачивания.
Исключает node_modules, .next, db, .git, skills, upload, download, .zscripts.
"""
import os
import zipfile
from pathlib import Path

PROJECT_DIR = "/home/z/my-project"
OUTPUT_ZIP = "/home/z/my-project/download/Report_RK.zip"

# Что исключаем
EXCLUDE_DIRS = {
    "node_modules", ".next", ".git", "skills", "upload", "download",
    ".zscripts", "db", ".turbo", "coverage", "out", "build",
    "mini-services/.gitkeep",
}
EXCLUDE_FILES = {
    ".DS_Store", "Thumbs.db", "dev.log", "dev.out.log", "server.log",
    "dev-server.log", "dev-server.err", "package-lock.json",
    ".env.local", ".env.production",
}

def should_skip(path: Path) -> bool:
    parts = path.parts
    # Пропускаем если любая из частей в EXCLUDE_DIRS
    for part in parts:
        if part in EXCLUDE_DIRS:
            return True
    if path.name in EXCLUDE_FILES:
        return True
    return False

def main():
    project = Path(PROJECT_DIR)
    if not project.exists():
        print(f"❌ Папка не найдена: {project}")
        return

    os.makedirs(os.path.dirname(OUTPUT_ZIP), exist_ok=True)

    print(f"Создаю архив: {OUTPUT_ZIP}")
    file_count = 0
    total_size = 0

    with zipfile.ZipFile(OUTPUT_ZIP, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        for root, dirs, files in os.walk(project):
            root_path = Path(root)
            # Фильтруем директории
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]

            for fname in files:
                if fname in EXCLUDE_FILES:
                    continue
                fpath = root_path / fname
                if should_skip(fpath):
                    continue
                # Относительный путь в архиве
                arcname = fpath.relative_to(project)
                # Пропускаем точечные конфиги окружения
                if str(arcname).startswith("."):
                    continue
                zf.write(fpath, arcname)
                file_count += 1
                total_size += fpath.stat().st_size

    zip_size = os.path.getsize(OUTPUT_ZIP)
    print(f"✅ Готово: {file_count} файлов, {total_size / 1024:.0f} KB распакованных, {zip_size / 1024:.0f} KB в архиве")
    print(f"   Путь: {OUTPUT_ZIP}")

if __name__ == "__main__":
    main()

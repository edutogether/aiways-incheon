from pathlib import Path
import shutil

ROOT = Path(".").resolve()
CLEAN = ROOT / "clean"

if not CLEAN.exists():
    raise SystemExit("ERROR: clean/ ??? ????.")

for name in ["index.html", "style.css", "app.js", "assets", "miniapp", "base-data-seed.tsv"]:
    src = CLEAN / name
    if not src.exists():
        continue

    dest = ROOT / name

    if dest.exists():
        if dest.is_dir():
            shutil.rmtree(dest)
        else:
            dest.unlink()

    if src.is_dir():
        shutil.copytree(src, dest)
    else:
        shutil.copy2(src, dest)

index_path = ROOT / "index.html"
if index_path.exists():
    html = index_path.read_text(encoding="utf-8")
    html = html.replace('src="../aiways-logo.png"', 'src="./aiways-logo.png"')
    html = html.replace("../aiways-logo.png", "./aiways-logo.png")
    index_path.write_text(html, encoding="utf-8")

print("DONE: root main restored from clean/")

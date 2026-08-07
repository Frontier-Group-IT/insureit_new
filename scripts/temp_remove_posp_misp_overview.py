from pathlib import Path
import subprocess

page = Path("apps/web-portal/app/customers/posp-misp/page.tsx")
text = page.read_text()
needle = '<Link href="/intermediaries" className={actionButtonClass}>Overview</Link>'
assert text.count(needle) == 1, f"expected exactly one Overview link, found {text.count(needle)}"
page.write_text(text.replace(needle, "", 1))

subprocess.run(["git", "config", "user.name", "github-actions[bot]"], check=True)
subprocess.run(["git", "config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com"], check=True)
subprocess.run(["git", "add", str(page)], check=True)
subprocess.run(["git", "rm", "scripts/temp_remove_posp_misp_overview.py", ".github/workflows/temp-remove-posp-misp-overview.yml"], check=True)
subprocess.run(["git", "commit", "-m", "Remove POSP MISP overview button"], check=True)
subprocess.run(["git", "push", "origin", "HEAD"], check=True)

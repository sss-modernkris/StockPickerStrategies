import os

search_roots = [
    r"C:\Users\moder\AntiGravity\StockPickerStrategies-20260610",
    r"C:\Users\moder\AntiGravity"
]

found = []
for root in search_roots:
    for dirpath, dirnames, filenames in os.walk(root):
        if ".venv" in dirpath or "node_modules" in dirpath or ".git" in dirpath:
            continue
        for f in filenames:
            if f.startswith(".env"):
                found.append(os.path.join(dirpath, f))

print(f"Found .env files: {found}")

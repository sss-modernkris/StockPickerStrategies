import os
import subprocess

path = r"C:\Users\moder\AntiGravity\StockPickerStrategies-20260610"
while path and os.path.dirname(path) != path:
    git_dir = os.path.join(path, ".git")
    if os.path.exists(git_dir):
        print(f"Found git repo at: {path}")
        res = subprocess.run(["git", "remote", "-v"], cwd=path, capture_output=True, text=True)
        print("Remotes:\n", res.stdout)
        res_branch = subprocess.run(["git", "branch", "-a"], cwd=path, capture_output=True, text=True)
        print("Branches:\n", res_branch.stdout)
        break
    path = os.path.dirname(path)
else:
    print("No git repository found in parent tree of StockPickerStrategies-20260610")

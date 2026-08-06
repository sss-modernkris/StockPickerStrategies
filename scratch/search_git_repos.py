import os

base_dir = r"C:\Users\moder\AntiGravity"
print(f"Searching for .git directories in: {base_dir}")
for root, dirs, files in os.walk(base_dir):
    # Limit depth to 2
    depth = root[len(base_dir):].count(os.sep)
    if depth > 2:
        continue
    if ".git" in dirs:
        print(f"Found git repo: {os.path.join(root, '.git')}")
        # Print remote origin url if available
        config_path = os.path.join(root, ".git", "config")
        if os.path.exists(config_path):
            with open(config_path, 'r') as f:
                for line in f:
                    if "url =" in line:
                        print(f"  Remote URL: {line.strip()}")

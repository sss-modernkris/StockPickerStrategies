import os

root_search = r"C:\Users\moder\AntiGravity"
git_repos = []

for dirpath, dirnames, filenames in os.walk(root_search):
    if ".git" in dirnames:
        git_repos.append(dirpath)
        dirnames.remove(".git")  # don't recurse into .git

print("Found git repositories:")
for repo in git_repos:
    print(repo)

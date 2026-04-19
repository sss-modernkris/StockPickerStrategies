import os
# BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PORTFOLIO_CSV = os.path.join(BASE_DIR, "portfolio.csv")
PAPER_STUDY_CSV = os.path.join(BASE_DIR, "PaperStudy.csv")

print(f"Base Directory: {BASE_DIR}")
print(f"Portfolio CSV: {PORTFOLIO_CSV}")
print(f"Paper Study CSV: {PAPER_STUDY_CSV}")
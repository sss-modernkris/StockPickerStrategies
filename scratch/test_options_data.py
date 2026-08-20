import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from services.options_service import generate_and_save_options_data

if __name__ == "__main__":
    print("Testing generate_and_save_options_data()...")
    res = generate_and_save_options_data()
    print("Result:", res)

import os
import sys

# Ensure backend path is on sys.path
backend_path = os.path.join(os.path.dirname(__file__), "..", "backend")
sys.path.insert(0, backend_path)

from services.email_service import send_email_with_attachment

def test_email_service_fallback():
    print("--- Testing email_service fallback ---")
    test_csv = os.path.join(os.path.dirname(__file__), "..", "Top_Tickers_to_buy.csv")
    
    # Run email service without SMTP env vars to verify graceful handling
    success, msg = send_email_with_attachment(
        to_email="modernkris@gmail.com",
        subject="Test Subject",
        body="Test Body",
        file_path=test_csv
    )
    print(f"Result: success={success}, msg='{msg}'")
    assert isinstance(success, bool)
    assert isinstance(msg, str)
    print("Email service test passed!\n")

if __name__ == "__main__":
    test_email_service_fallback()

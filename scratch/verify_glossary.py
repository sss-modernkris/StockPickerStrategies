import os
import time
from playwright.sync_api import sync_playwright

def verify_glossary():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    output_dir = os.path.join(base_dir, "images")
    os.makedirs(output_dir, exist_ok=True)
    
    with sync_playwright() as p:
        print("Launching browser...")
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_viewport_size({"width": 1400, "height": 1080})
        
        print("Navigating to http://localhost:3000...")
        try:
            page.goto("http://localhost:3000", wait_until="networkidle", timeout=30000)
        except Exception as e:
            print("Initial page load navigation error: ", e)
            
        print("Waiting for dashboard to load...")
        try:
            page.wait_for_selector("text=Adv. Charts", timeout=60000)
            print("Dashboard loaded successfully.")
        except Exception as e:
            print("Dashboard load timed out: ", e)
            
        time.sleep(2)
        
        # Click the 'Glossary' tab button
        print("Clicking 'Glossary' button...")
        try:
            glossary_btn = page.get_by_text("Glossary").first
            glossary_btn.click()
            print("Clicked Glossary tab.")
        except Exception as e:
            print("Failed to click Glossary tab: ", e)
            
        time.sleep(2)
        
        # Search for "backtesting" in search bar
        print("Searching for 'backtesting'...")
        try:
            search_input = page.locator("input[placeholder='Search strategy...']")
            search_input.fill("backtesting")
            print("Filled search input.")
        except Exception as e:
            print("Failed to fill search: ", e)
            
        time.sleep(2)
        
        # Verify block title is present
        try:
            page.wait_for_selector("text=30-Day Strategy 1 Backtesting", timeout=15000)
            print("SUCCESS: 30-Day Strategy 1 Backtesting Glossary card found!")
            page.wait_for_selector("text=30-Day Strategy 2 Backtesting", timeout=15000)
            print("SUCCESS: 30-Day Strategy 2 Backtesting Glossary card found!")
            page.wait_for_selector("text=30-Day Strategy 3 Backtesting", timeout=15000)
            print("SUCCESS: 30-Day Strategy 3 Backtesting Glossary card found!")
        except Exception as e:
            print("FAILURE: Glossary card not found or timed out: ", e)
            
        # Capture verification screenshot
        screenshot_path = os.path.join(output_dir, "glossary_backtest_card.png")
        print(f"Saving screenshot to {screenshot_path}...")
        page.screenshot(path=screenshot_path)
        
        browser.close()

if __name__ == "__main__":
    verify_glossary()

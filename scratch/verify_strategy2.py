import os
import time
from playwright.sync_api import sync_playwright

def verify_strategy2():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    output_dir = os.path.join(base_dir, "images")
    os.makedirs(output_dir, exist_ok=True)
    
    csv_path = os.path.join(base_dir, "Backtest_Ledger_Strategy2.csv")
    if os.path.exists(csv_path):
        os.remove(csv_path)
        print("Removed existing Backtest_Ledger_Strategy2.csv")
        
    with sync_playwright() as p:
        print("Launching browser...")
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_viewport_size({"width": 1400, "height": 1080})
        
        print("Navigating to http://localhost:3000...")
        
        # Listen for console logs
        page.on("console", lambda msg: print(f"BROWSER CONSOLE: {msg.text}"))
        
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
        
        # Click the 'Top Tickers' tab button
        print("Clicking 'Top Tickers' button...")
        try:
            top_tickers_btn = page.get_by_text("Top Tickers").first
            top_tickers_btn.click()
            print("Clicked Top Tickers tab.")
        except Exception as e:
            print("Failed to click Top Tickers: ", e)
            
        # Wait for the index tickers backtest controls to load
        print("Waiting for Strategy 2 backtest button to render...")
        try:
            page.wait_for_selector("text=Run 30-Day Strategy 2 Backtest", timeout=15000)
        except Exception as e:
            print("Failed to find backtest button: ", e)
            
        # Click "Run 30-Day Strategy 2 Backtest"
        print("Clicking 'Run 30-Day Strategy 2 Backtest'...")
        try:
            page.get_by_text("Run 30-Day Strategy 2 Backtest").first.click()
            print("Clicked Run 30-Day Strategy 2 Backtest button.")
        except Exception as e:
            print("Failed to click: ", e)
            
        print("Waiting for Strategy 2 backtest computation to complete...")
        try:
            # Wait longer because downloading tickers cold-start could take longer
            page.wait_for_selector("text=30-Day Strategy 2 Backtest Trade Ledger", timeout=90000)
            print("Strategy 2 backtest ledger visible! Computation successful.")
        except Exception as e:
            print("Timeout waiting for Strategy 2 trade ledger header: ", e)
            # Check if any error text is visible on the page
            body_text = page.locator("body").inner_text()
            print("--- BODY TEXT DETECTED (First 800 chars) ---")
            print(body_text[:800])
            print("---------------------------------------------")
            
        time.sleep(2)
        
        # Click "Save to Backtest_Ledger.csv" inside the Strategy 2 block
        print("Clicking 'Save to Backtest_Ledger.csv' for Strategy 2...")
        try:
            save_btn = page.locator("div:has-text('30-Day Strategy 2 Backtest Trade Ledger')").locator("button:has-text('Save to Backtest_Ledger.csv')").first
            save_btn.click()
            print("Clicked Save to Backtest_Ledger.csv.")
        except Exception as e:
            print("Failed to click save button: ", e)
            
        # Wait for "Saved successfully!" state
        try:
            page.wait_for_selector("text=Saved successfully!", timeout=15000)
            print("Save success button feedback detected for Strategy 2!")
        except Exception as e:
            print("Timeout waiting for button feedback: ", e)
            
        time.sleep(2)
        
        # Capture verification screenshot
        screenshot_path = os.path.join(output_dir, "top_tickers_strategy2_completed.png")
        print(f"Saving screenshot to {screenshot_path}...")
        page.screenshot(path=screenshot_path)
        
        # Assert file exists
        if os.path.exists(csv_path):
            print("SUCCESS: Backtest_Ledger_Strategy2.csv has been successfully generated in project root!")
            with open(csv_path, 'r') as f:
                lines = f.readlines()
                print(f"CSV Row count: {len(lines)}")
                print(f"Header: {lines[0].strip()}")
                print(f"First data row: {lines[1].strip() if len(lines) > 1 else 'None'}")
        else:
            print("FAILURE: Backtest_Ledger_Strategy2.csv was not created.")
            
        browser.close()

if __name__ == "__main__":
    verify_strategy2()

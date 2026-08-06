import os
import time
from playwright.sync_api import sync_playwright

def verify_ui():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    output_dir = os.path.join(base_dir, "images")
    os.makedirs(output_dir, exist_ok=True)
    
    with sync_playwright() as p:
        print("Launching browser...")
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_viewport_size({"width": 1400, "height": 1080})
        
        page.on("console", lambda msg: print(f"CONSOLE: {msg.text}"))
        page.on("pageerror", lambda err: print(f"PAGEERROR: {err}"))
        
        print("Navigating to http://localhost:3000...")
        try:
            page.goto("http://localhost:3000", wait_until="networkidle", timeout=30000)
        except Exception as e:
            print("Initial page load navigation error: ", e)
            
        # Wait for the dashboard to finish loading its initial analysis
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
            buttons = page.query_selector_all("button")
            for btn in buttons:
                if "Top Tickers" in (btn.inner_text() or ""):
                    btn.click()
                    print("Clicked Top Tickers tab via fallback.")
                    break
        
        # Wait for the index tickers backtest controls to load
        print("Waiting for backtest button to render...")
        try:
            page.wait_for_selector("text=Run 30-Day Strategy 1 Backtest", timeout=15000)
        except Exception as e:
            print("Failed to find backtest button: ", e)
            
        # Click "Run 30-Day Strategy 1 Backtest"
        print("Clicking 'Run 30-Day Strategy 1 Backtest'...")
        btn_clicked = False
        buttons = page.query_selector_all("button")
        for btn in buttons:
            text = btn.inner_text() or ""
            if "Run 30-Day Strategy 1 Backtest" in text:
                btn.click()
                print("Clicked Run 30-Day Strategy 1 Backtest button.")
                btn_clicked = True
                break
                
        if not btn_clicked:
            print("Could not find button by text iteration. Attempting locator...")
            page.get_by_text("Run 30-Day Strategy 1 Backtest").first.click()
            
        print("Waiting for backtest computation to complete...")
        # Wait for the results to load (which changes the ROI display text or opens the ledger)
        # We can wait for "30-Day Strategy 1 Backtest Trade Ledger" to appear
        try:
            page.wait_for_selector("text=30-Day Strategy 1 Backtest Trade Ledger", timeout=60000)
            print("Backtest ledger visible! Computation successful.")
        except Exception as e:
            print("Timeout waiting for trade ledger header: ", e)
            
        time.sleep(3)
        
        screenshot_path = os.path.join(output_dir, "top_tickers_backtest_completed.png")
        print(f"Saving screenshot to {screenshot_path}...")
        page.screenshot(path=screenshot_path)
        
        print("Verification complete!")
        browser.close()

if __name__ == "__main__":
    verify_ui()

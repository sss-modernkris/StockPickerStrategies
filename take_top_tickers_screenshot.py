import os
import time
from playwright.sync_api import sync_playwright

def capture_top_tickers():
    base_dir = os.path.dirname(os.path.abspath(__file__))
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
            print("Initial page load timeout/error: ", e)
            
        time.sleep(3)
        
        # Wait for portfolio-US.csv option to load dynamically in select
        print("Waiting for select options to populate...")
        try:
            page.wait_for_selector("select option[value='portfolio-US.csv']", timeout=15000)
            page.select_option("select", "portfolio-US.csv")
            print("Selected portfolio-US.csv successfully")
        except Exception as e:
            print("Failed to find or select option: ", e)
            
        # Wait for loading batch analysis to complete
        print("Waiting for page load to stabilize...")
        try:
            page.wait_for_selector("text=Adv. Charts", timeout=60000)
            print("Dashboard fully loaded.")
        except Exception as e:
            print("Timeout waiting for dashboard load: ", e)
            
        time.sleep(3)
        
        # Click the 'Top Tickers' tab button
        print("Clicking 'Top Tickers' button...")
        try:
            top_tickers_btn = page.get_by_text("Top Tickers").first
            top_tickers_btn.click()
            print("Clicked Top Tickers tab.")
        except Exception as e:
            print("Failed to click Top Tickers tab via locator, attempting querySelector: ", e)
            buttons = page.query_selector_all("button")
            for btn in buttons:
                if "Top Tickers" in (btn.inner_text() or ""):
                    btn.click()
                    print("Clicked Top Tickers tab via fallback.")
                    break
        
        # Wait for the Dow 30 tickers to fetch and analyze
        print("Waiting for index analysis to complete (Dow 30)...")
        time.sleep(15) 
        
        # Screenshot 1: General Top Tickers Panel
        screenshot_path = os.path.join(output_dir, "top_tickers.png")
        print(f"Capturing general screen to {screenshot_path}...")
        page.screenshot(path=screenshot_path)
        
        # Click "Run Buy Screen"
        print("Clicking 'Run Buy Screen'...")
        try:
            run_screen_btn = page.get_by_text("Run Buy Screen").first
            run_screen_btn.click()
            print("Clicked Run Buy Screen.")
        except Exception as e:
            print("Failed to click Run Buy Screen via locator: ", e)
            buttons = page.query_selector_all("button")
            for btn in buttons:
                if "Run Buy Screen" in (btn.inner_text() or ""):
                    btn.click()
                    print("Clicked Run Buy Screen via fallback.")
                    break
                    
        time.sleep(3)
        
        # Screenshot 2: Screen Results Displayed
        screenshot_path_screened = os.path.join(output_dir, "top_tickers_screened.png")
        print(f"Capturing screened results screen to {screenshot_path_screened}...")
        page.screenshot(path=screenshot_path_screened)
        
        # Click "Save to Top_Tickers_to_buy.csv" or the button containing "Save to"
        print("Clicking 'Save to' button...")
        save_btn_clicked = False
        buttons = page.query_selector_all("button")
        for btn in buttons:
            try:
                text = btn.inner_text() or ""
                if "Save to" in text or "Saved" in text:
                    btn.click()
                    print(f"Clicked button with text '{text}'")
                    save_btn_clicked = True
                    break
            except Exception:
                pass
                
        if not save_btn_clicked:
            print("Failed to click Save via iteration, attempting direct get_by_text")
            try:
                save_btn = page.get_by_text("Save to Top_Tickers_to_buy.csv").first
                save_btn.click()
                print("Clicked Save to Top_Tickers_to_buy.csv.")
            except Exception as e:
                print("Could not click Save button: ", e)
                    
        time.sleep(3)
        
        # Screenshot 3: Saved Success Banner Displayed
        screenshot_path_saved = os.path.join(output_dir, "top_tickers_saved.png")
        print(f"Capturing saved status screen to {screenshot_path_saved}...")
        page.screenshot(path=screenshot_path_saved)
        
        print("Captures complete!")
        browser.close()

if __name__ == "__main__":
    capture_top_tickers()

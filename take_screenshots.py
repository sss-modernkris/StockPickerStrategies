import os
import time
import re
import argparse
from playwright.sync_api import sync_playwright

def main():
    parser = argparse.ArgumentParser(description="Capture advanced charts screenshots.")
    parser.add_argument("--portfolio", "-p", default="portfolio-01.csv", help="Portfolio CSV filename to analyze")
    args = parser.parse_args()
    
    portfolio_file = args.portfolio
    print(f"Target Portfolio file: {portfolio_file}")

    output_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "frontend", "public", "images_advanced")
    os.makedirs(output_dir, exist_ok=True)
    
    with sync_playwright() as p:
        print("Launching browser...")
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_viewport_size({"width": 1600, "height": 1200})
        
        print("Navigating to http://localhost:3000...")
        try:
            page.goto("http://localhost:3000", wait_until="networkidle", timeout=30000)
        except Exception as e:
            print("Navigation load timeout/error, continuing: ", e)
            
        time.sleep(3)
        
        # 1. Change portfolio filename to dynamic target
        print(f"Selecting portfolio '{portfolio_file}'...")
        page.wait_for_selector("select")
        page.select_option("select", portfolio_file)
        
        # Wait for loading batch analysis to complete
        print("Waiting for portfolio batch analysis to complete...")
        try:
            page.wait_for_selector("text=Adv. Charts", timeout=90000)
            print("Dashboard layout loaded.")
        except Exception as e:
            print("Timeout waiting for Adv. Charts button to appear: ", e)
        
        time.sleep(3) # Let UI stabilize
        
        # 2. Select the "Adv. Charts" tab button
        print("Switching to Adv. Charts tab...")
        adv_charts_btn = None
        try:
            # First try matching exact text
            adv_charts_btn = page.get_by_text("Adv. Charts").first
            adv_charts_btn.click()
            print("Switched to Adv. Charts view via get_by_text.")
        except Exception as e:
            print("Failed to click Adv. Charts using locator: ", e)
            buttons = page.query_selector_all("button")
            for btn in buttons:
                try:
                    text = btn.inner_text() or ""
                    if "Adv. Charts" in text or "Adv" in text:
                        adv_charts_btn = btn
                        btn.click()
                        print(f"Clicked button with text '{text}' via fallback search.")
                        break
                except Exception:
                    pass
                
        if not adv_charts_btn:
            print("Could not find Adv. Charts button!")
            browser.close()
            return
            
        time.sleep(4)
        
        # 3. Toggle off unwanted indicators
        print("Toggling chart overlays to keep only required ones...")
        items_to_toggle_off = [
            'SMA 9', 'SMA 12', 'SMA 26', 'SMA 50', 'SMA 200',
            'BB Upper', 'BB Lower', 'SMA 20 (BB)'
        ]
        
        plot_buttons = page.query_selector_all("button")
        for btn in plot_buttons:
            try:
                text = btn.inner_text().strip()
                if text in items_to_toggle_off:
                    print(f"Toggling off {text}...")
                    btn.click()
                    time.sleep(0.3)
            except Exception as e:
                pass
                
        print("Indicators isolated successfully.")
        
        # 4. Retrieve all stock symbols currently in the sidebar
        tickers = []
        divs = page.query_selector_all("div")
        for div in divs:
            try:
                class_name = div.get_attribute("class") or ""
                if "cursor-pointer" in class_name:
                    span = div.query_selector("span")
                    if span:
                        symbol_text = span.inner_text().strip()
                        if symbol_text and re.match(r"^[A-Z0-9.\-]+$", symbol_text) and len(symbol_text) <= 10:
                            if symbol_text not in tickers:
                                tickers.append(symbol_text)
            except Exception:
                pass
                
        print(f"Found tickers in sidebar: {', '.join(tickers)}")
        
        # 5. Loop through each ticker, click, wait, and capture screenshot of advanced chart card
        for symbol in tickers:
            print(f"Processing {symbol}...")
            
            # Find the sidebar element for this symbol and click it
            target_el = None
            sidebar_divs = page.query_selector_all("div")
            for div in sidebar_divs:
                try:
                    class_name = div.get_attribute("class") or ""
                    if "cursor-pointer" in class_name:
                        span = div.query_selector("span")
                        if span and span.inner_text().strip() == symbol:
                            target_el = div
                            break
                except Exception:
                    pass
                    
            if target_el:
                print(f"Clicking sidebar for {symbol}...")
                target_el.click()
                time.sleep(5) # Wait for API and recharts animation
                
                # Find the card element for Advanced Charts and take screenshot
                all_divs = page.query_selector_all("div")
                chart_card = None
                for div in all_divs:
                    try:
                        inner_text = div.inner_text() or ""
                        if "Price Action & Moving Averages" in inner_text and ("Daily Close with SMAs" in inner_text or "Close Price" in inner_text):
                            chart_card = div
                            break
                    except Exception:
                        pass
                        
                if chart_card:
                    screenshot_path = os.path.join(output_dir, f"{symbol}_advanced_chart.png")
                    print(f"Saving screenshot of chart card to {screenshot_path}...")
                    chart_card.screenshot(path=screenshot_path)
                else:
                    print(f"Could not find chart card for {symbol}, taking full page screenshot...")
                    screenshot_path = os.path.join(output_dir, f"{symbol}_full_page.png")
                    page.screenshot(path=screenshot_path)
            else:
                print(f"Could not find sidebar item for {symbol}")
                
        print("Screenshot generation complete.")
        browser.close()

if __name__ == "__main__":
    main()

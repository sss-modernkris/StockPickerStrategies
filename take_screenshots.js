const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  const outputDir = path.join(__dirname, 'images_advanced');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log('Launching browser with native 80% window zoom...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--force-device-scale-factor=0.8']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1200 });

  console.log('Navigating to http://localhost:3000...');
  try {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2', timeout: 30000 });
  } catch (err) {
    console.log('Networkidle2 timed out, proceeding anyway...');
  }

  // 1. Change portfolio filename to 'portfolio-01.csv'
  console.log("Selecting portfolio 'portfolio-01.csv'...");
  await page.waitForSelector('select');
  await page.select('select', 'portfolio-01.csv');

  // Wait for loading indicator or load completion
  console.log('Waiting for portfolio batch analysis to complete...');
  await page.waitForFunction(() => {
    return !document.body.innerText.includes('Running Batch Quant Models');
  }, { timeout: 90000 });

  await delay(4000); // Let UI stabilize

  // 2. Select the "Adv. Charts" tab button
  console.log('Switching to Adv. Charts tab...');
  const buttons = await page.$$('button');
  let advChartsBtn = null;
  for (const btn of buttons) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text.includes('Adv. Charts')) {
      advChartsBtn = btn;
      break;
    }
  }

  if (advChartsBtn) {
    await advChartsBtn.click();
    console.log('Switched to Adv. Charts view.');
  } else {
    console.error('Could not find Adv. Charts button!');
    await browser.close();
    return;
  }

  await delay(3000);

  // 3. Toggle off all indicators except Close Price, Willy VWAP, VWAP Upper, VWAP Lower
  console.log('Toggling chart overlays to keep only required ones...');
  const itemsToToggleOff = [
    'SMA 9',
    'SMA 12',
    'SMA 26',
    'SMA 50',
    'SMA 200',
    'BB Upper',
    'BB Lower',
    'SMA 20 (BB)'
  ];

  // We loop a few times to make sure we find all and click them
  let plotButtons = await page.$$('button');
  for (const btn of plotButtons) {
    try {
      const text = await page.evaluate(el => el.textContent.trim(), btn);
      if (itemsToToggleOff.includes(text)) {
        console.log(`Toggling off ${text}...`);
        await btn.click();
        await delay(200);
      }
    } catch (e) {
      // Element might detach, ignore
    }
  }

  console.log('Indicators isolated successfully.');

  // 4. Retrieve all stock symbols currently in the sidebar
  const tickers = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('div'));
    const symbols = [];
    for (const item of items) {
      if (item.className.includes('cursor-pointer') && item.querySelector('span')) {
        const symbolText = item.querySelector('span').textContent.trim();
        if (symbolText && /^[A-Z0-9.\-]+$/.test(symbolText) && symbolText.length <= 10) {
          if (!symbols.includes(symbolText)) {
            symbols.push(symbolText);
          }
        }
      }
    }
    return symbols;
  });

  console.log(`Found tickers in sidebar: ${tickers.join(', ')}`);

  // 5. For each ticker, select it, wait, and capture a screenshot of the Advanced Charts card
  for (const symbol of tickers) {
    console.log(`Processing ${symbol}...`);
    
    // Find the sidebar element for this symbol and click it
    const sidebarElements = await page.$$('div');
    let targetEl = null;
    for (const el of sidebarElements) {
      try {
        const text = await page.evaluate(element => {
          const span = element.querySelector('span');
          return span ? span.textContent.trim() : null;
        }, el);
        if (text === symbol && await page.evaluate(element => element.className.includes('cursor-pointer'), el)) {
          targetEl = el;
          break;
        }
      } catch (e) {}
    }

    if (targetEl) {
      console.log(`Clicking sidebar for ${symbol}...`);
      await targetEl.click();
      await delay(4000); // Wait for API and chart lines to render

      // Find the container element for all Advanced Charts and take an element screenshot
      const cards = await page.$$('div');
      let chartCard = null;
      for (const card of cards) {
        try {
          const isTarget = await page.evaluate(element => {
            const className = element.className || '';
            const text = element.innerText || '';
            return className.includes('space-y-6') && 
                   !className.includes('max-w-7xl') && 
                   text.includes('Price Action & Moving Averages') && 
                   text.includes('MACD');
          }, card);
          if (isTarget) {
            chartCard = card;
            break;
          }
        } catch (e) {}
      }

      if (chartCard) {
        const screenshotPath = path.join(outputDir, `${symbol}_advanced_chart.png`);
        console.log(`Saving screenshot to ${screenshotPath}...`);
        await chartCard.screenshot({ path: screenshotPath });
      } else {
        console.warn(`Could not find chart card for ${symbol}, taking viewport screenshot...`);
        const screenshotPath = path.join(outputDir, `${symbol}_full_viewport.png`);
        await page.screenshot({ path: screenshotPath });
      }
    } else {
      console.error(`Could not find sidebar item for ${symbol}`);
    }
  }

  console.log('Screenshot generation complete.');
  await browser.close();
})();

import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  const logs = [];
  const errors = [];
  
  page.on('console', msg => {
    const text = msg.text();
    logs.push(text);
    console.log('LOG:', text);
  });
  
  page.on('pageerror', err => {
    errors.push(err.message);
    console.log('ERROR:', err.message);
  });
  
  await page.goto('http://localhost:4173');
  await page.waitForTimeout(5000);
  
  console.log('\n=== SUMMARY ===');
  console.log('Total logs:', logs.length);
  console.log('Total errors:', errors.length);
  
  await browser.close();
})();
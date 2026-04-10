import { test, expect } from '@playwright/test';

test('debug tennis rules', async ({ page }) => {
  const logs: string[] = [];
  page.on('console', msg => {
    logs.push(msg.text());
  });
  
  await page.goto('http://localhost:3000');
  await page.waitForTimeout(2000);
  
  console.log('=== CONSOLE LOGS ===');
  logs.forEach(l => console.log(l));
  
  expect(logs.length).toBeGreaterThan(0);
});
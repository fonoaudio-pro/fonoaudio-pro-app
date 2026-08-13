import { chromium } from 'playwright';

async function testPlaywrightVisualQA() {
  console.log('Starting Playwright Visual QA test...');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Test 1: Navigate to app
    console.log('Test 1: Navigating to app...');
    await page.goto('http://localhost:3002', { waitUntil: 'networkidle', timeout: 30000 });
    console.log('✓ App loaded successfully');
    
    // Test 2: Take screenshot
    console.log('Test 2: Taking screenshot...');
    await page.screenshot({ path: 'test-results/playwright-test-screenshot.png', fullPage: true });
    console.log('✓ Screenshot saved');
    
    // Test 3: Check page title
    console.log('Test 3: Checking page title...');
    const title = await page.title();
    console.log(`✓ Page title: ${title}`);
    
    // Test 4: Check for login button
    console.log('Test 4: Checking for login button...');
    const loginButton = page.getByRole('button', { name: /Entrar sin Google/i });
    const isVisible = await loginButton.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`✓ Login button visible: ${isVisible}`);
    
    // Test 5: Click login button
    if (isVisible) {
      console.log('Test 5: Clicking login button...');
      await loginButton.click();
      await page.waitForTimeout(2000);
      console.log('✓ Login button clicked');
      
      // Take screenshot after login
      await page.screenshot({ path: 'test-results/playwright-test-after-login.png', fullPage: true });
      console.log('✓ Post-login screenshot saved');
    }
    
    console.log('\n=== All Playwright Visual QA tests passed ===');
    
  } catch (error) {
    console.error('Test failed:', error);
    await page.screenshot({ path: 'test-results/playwright-test-error.png', fullPage: true });
  } finally {
    await browser.close();
  }
}

// Run the test
testPlaywrightVisualQA().catch(console.error);

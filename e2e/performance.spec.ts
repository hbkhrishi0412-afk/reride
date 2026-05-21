import { test, expect } from '@playwright/test';

test.describe.configure({ mode: 'skip' });

test.describe('@legacy Performance and Load Testing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load home page within acceptable time', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const loadTime = Date.now() - startTime;
    
    // Verify page loads within 3 seconds
    expect(loadTime).toBeLessThan(3000);
    
    // Verify critical elements are visible
    await expect(page.locator('text=ReRide')).toBeVisible();
    await expect(page.locator('[data-testid="vehicle-card"]')).toBeVisible();
  });

  test('should handle large number of vehicle listings', async ({ page }) => {
    // Navigate to vehicle listings
    await page.click('text=Buy Cars');
    
    // Wait for vehicles to load
    await page.waitForSelector('[data-testid="vehicle-card"]');
    
    // Measure rendering performance
    const startTime = Date.now();
    
    // Scroll through the list
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    
    const scrollTime = Date.now() - startTime;
    
    // Verify scrolling is smooth (less than 1 second)
    expect(scrollTime).toBeLessThan(1000);
    
    // Verify all vehicles are rendered
    const vehicleCards = page.locator('[data-testid="vehicle-card"]');
    await expect(vehicleCards).toHaveCount(2); // Based on test data
  });

  test('should handle concurrent user interactions', async ({ page }) => {
    // Simulate multiple rapid clicks
    const promises = [];
    
    for (let i = 0; i < 5; i++) {
      promises.push(
        page.click('text=Buy Cars').catch(() => {}) // Ignore errors for concurrent clicks
      );
    }
    
    await Promise.all(promises);
    
    // Verify page is still responsive
    await expect(page.locator('[data-testid="vehicle-card"]')).toBeVisible();
  });

  test('should handle memory usage efficiently', async ({ page }) => {
    // Navigate through multiple pages
    await page.click('text=Buy Cars');
    await page.click('[data-testid="vehicle-card"]:first-child');
    await page.goBack();
    await page.click('text=Sell Car');
    await page.goBack();
    
    // Check memory usage
    const metrics = await page.evaluate(() => {
      if ('memory' in performance) {
        return {
          usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
          totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
          jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit
        };
      }
      return null;
    });
    
    if (metrics) {
      // Verify memory usage is reasonable (less than 50MB)
      expect(metrics.usedJSHeapSize).toBeLessThan(50 * 1024 * 1024);
    }
  });

  test('should handle network latency gracefully', async ({ page }) => {
    // Simulate slow network
    await page.route('**/*', route => {
      setTimeout(() => route.continue(), 1000); // 1 second delay
    });
    
    const startTime = Date.now();
    
    // Navigate to vehicle listings
    await page.click('text=Buy Cars');
    
    // Wait for loading indicator
    await expect(page.locator('[data-testid="loading-spinner"]')).toBeVisible();
    
    // Wait for content to load
    await page.waitForSelector('[data-testid="vehicle-card"]', { timeout: 10000 });
    
    const loadTime = Date.now() - startTime;
    
    // Verify page loads even with network delay
    expect(loadTime).toBeLessThan(10000);
    await expect(page.locator('[data-testid="vehicle-card"]')).toBeVisible();
  });

  test('should handle offline mode gracefully', async ({ page }) => {
    // Go offline
    await page.context().setOffline(true);
    
    // Try to navigate
    await page.click('text=Buy Cars');
    
    // Verify offline indicator is shown
    await expect(page.locator('text=Offline')).toBeVisible();
    
    // Restore online mode
    await page.context().setOffline(false);
    
    // Verify app recovers
    await page.waitForSelector('[data-testid="vehicle-card"]');
    await expect(page.locator('[data-testid="vehicle-card"]')).toBeVisible();
  });

  test('should handle large images efficiently', async ({ page }) => {
    // Navigate to vehicle detail page
    await page.click('text=Buy Cars');
    await page.click('[data-testid="vehicle-card"]:first-child');
    
    // Wait for images to load
    await page.waitForSelector('[data-testid="vehicle-image"]');
    
    // Measure image loading performance
    const startTime = Date.now();
    
    // Click on image to open modal
    await page.click('[data-testid="vehicle-image"]:first-child');
    
    const imageLoadTime = Date.now() - startTime;
    
    // Verify image loads quickly (less than 2 seconds)
    expect(imageLoadTime).toBeLessThan(2000);
    
    // Verify image modal is displayed
    await expect(page.locator('[data-testid="image-modal"]')).toBeVisible();
  });

  test('should handle form submission performance', async ({ page }) => {
    // Login as seller
    await page.click('text=Login');
    await page.fill('input[type="email"]', 'seller@test.com');
    await page.fill('input[type="password"]', 'password');
    
    const startTime = Date.now();
    
    await page.click('button[type="submit"]');
    await page.waitForURL(/.*dashboard.*/);
    
    const loginTime = Date.now() - startTime;
    
    // Verify login is fast (less than 2 seconds)
    expect(loginTime).toBeLessThan(2000);
    
    // Navigate to add vehicle form
    await page.click('text=Listings');
    await page.click('button:has-text("Add New Vehicle")');
    
    // Fill form quickly
    const formStartTime = Date.now();
    
    await page.fill('input[name="make"]', 'Toyota');
    await page.fill('input[name="model"]', 'Camry');
    await page.fill('input[name="year"]', '2021');
    await page.fill('input[name="price"]', '1200000');
    await page.fill('input[name="mileage"]', '15000');
    
    const formFillTime = Date.now() - formStartTime;
    
    // Verify form filling is responsive (less than 1 second)
    expect(formFillTime).toBeLessThan(1000);
  });

  test('should handle search performance', async ({ page }) => {
    // Navigate to vehicle listings
    await page.click('text=Buy Cars');
    
    // Test search performance
    const startTime = Date.now();
    
    await page.fill('input[placeholder*="search"]', 'Honda');
    await page.press('input[placeholder*="search"]', 'Enter');
    
    // Wait for search results
    await page.waitForSelector('text=Honda City');
    
    const searchTime = Date.now() - startTime;
    
    // Verify search is fast (less than 1 second)
    expect(searchTime).toBeLessThan(1000);
    
    // Verify search results are displayed
    await expect(page.locator('text=Honda City')).toBeVisible();
  });

  test('should handle chat performance', async ({ page }) => {
    // Login as customer
    await page.click('text=Login');
    await page.fill('input[type="email"]', 'customer@test.com');
    await page.fill('input[type="password"]', 'password');
    await page.click('button[type="submit"]');
    
    // Navigate to vehicle and start chat
    await page.click('text=Buy Cars');
    await page.click('[data-testid="vehicle-card"]:first-child');
    await page.click('button:has-text("Contact Seller")');
    
    // Test message sending performance
    const startTime = Date.now();
    
    await page.fill('[data-testid="message-input"]', 'Test message performance');
    await page.click('button:has-text("Send")');
    
    // Wait for message to appear
    await page.waitForSelector('text=Test message performance');
    
    const messageTime = Date.now() - startTime;
    
    // Verify message sending is fast (less than 500ms)
    expect(messageTime).toBeLessThan(500);
    
    // Verify message is displayed
    await expect(page.locator('text=Test message performance')).toBeVisible();
  });
});

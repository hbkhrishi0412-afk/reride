import { test, expect } from '@playwright/test';

test.describe.configure({ mode: 'skip' });

test.describe('@legacy Vehicle Listing and Search', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display vehicle listings on home page', async ({ page }) => {
    // Check if vehicles are displayed
    await expect(page.locator('[data-testid="vehicle-card"]')).toBeVisible();
    
    // Verify vehicle information is displayed
    await expect(page.locator('text=Honda City')).toBeVisible();
    await expect(page.locator('text=Maruti Swift')).toBeVisible();
  });

  test('should navigate to vehicle detail page', async ({ page }) => {
    // Click on first vehicle card
    await page.click('[data-testid="vehicle-card"]:first-child');
    
    // Verify navigation to detail page
    await page.waitForURL(/.*detail.*/);
    
    // Check if vehicle details are displayed
    await expect(page.locator('text=Honda City')).toBeVisible();
    await expect(page.locator('text=₹8,50,000')).toBeVisible();
    await expect(page.locator('text=25,000 km')).toBeVisible();
  });

  test('should filter vehicles by category', async ({ page }) => {
    // Navigate to used cars page
    await page.click('text=Buy Cars');
    
    // Check if filter options are available
    await expect(page.locator('text=Four Wheeler')).toBeVisible();
    await expect(page.locator('text=Two Wheeler')).toBeVisible();
    
    // Apply filter
    await page.click('text=Four Wheeler');
    
    // Verify filtered results
    await expect(page.locator('[data-testid="vehicle-card"]')).toBeVisible();
  });

  test('should search vehicles by make and model', async ({ page }) => {
    // Navigate to used cars page
    await page.click('text=Buy Cars');
    
    // Use search functionality
    await page.fill('input[placeholder*="search"]', 'Honda');
    await page.press('input[placeholder*="search"]', 'Enter');
    
    // Verify search results
    await expect(page.locator('text=Honda City')).toBeVisible();
  });

  test('should filter vehicles by price range', async ({ page }) => {
    // Navigate to used cars page
    await page.click('text=Buy Cars');
    
    // Set price range filter
    await page.fill('input[placeholder*="Min Price"]', '500000');
    await page.fill('input[placeholder*="Max Price"]', '1000000');
    await page.click('button:has-text("Apply Filters")');
    
    // Verify filtered results
    await expect(page.locator('[data-testid="vehicle-card"]')).toBeVisible();
  });

  test('should filter vehicles by location', async ({ page }) => {
    // Navigate to used cars page
    await page.click('text=Buy Cars');
    
    // Set location filter
    await page.fill('input[placeholder*="City"]', 'Mumbai');
    await page.click('button:has-text("Apply Filters")');
    
    // Verify filtered results
    await expect(page.locator('text=Mumbai')).toBeVisible();
  });

  test('should add vehicle to wishlist', async ({ page }) => {
    // Login as customer first
    await page.click('text=Login');
    await page.fill('input[type="email"]', 'customer@test.com');
    await page.fill('input[type="password"]', 'password');
    await page.click('button[type="submit"]');
    
    // Navigate to vehicle listings
    await page.click('text=Buy Cars');
    
    // Add vehicle to wishlist
    await page.click('[data-testid="wishlist-button"]:first-child');
    
    // Verify wishlist notification
    await expect(page.locator('text=Added to wishlist')).toBeVisible();
  });

  test('should compare vehicles', async ({ page }) => {
    // Login as customer first
    await page.click('text=Login');
    await page.fill('input[type="email"]', 'customer@test.com');
    await page.fill('input[type="password"]', 'password');
    await page.click('button[type="submit"]');
    
    // Navigate to vehicle listings
    await page.click('text=Buy Cars');
    
    // Add vehicles to comparison
    await page.click('[data-testid="compare-button"]:first-child');
    await page.click('[data-testid="compare-button"]:nth-child(2)');
    
    // Navigate to comparison page
    await page.click('text=Compare');
    
    // Verify comparison page
    await expect(page.locator('text=Vehicle Comparison')).toBeVisible();
  });
});

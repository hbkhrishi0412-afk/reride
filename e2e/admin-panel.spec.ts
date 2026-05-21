import { test, expect } from '@playwright/test';

test.describe.configure({ mode: 'skip' });

test.describe('@legacy Admin Panel Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto('/');
    await page.click('text=Login');
    await page.fill('input[type="email"]', 'admin@test.com');
    await page.fill('input[type="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL(/.*dashboard.*/);
  });

  test('should display admin panel correctly', async ({ page }) => {
    // Verify admin panel elements
    await expect(page.locator('text=Admin Panel')).toBeVisible();
    await expect(page.locator('text=Test Admin')).toBeVisible();
    
    // Check admin navigation
    await expect(page.locator('text=Users')).toBeVisible();
    await expect(page.locator('text=Vehicles')).toBeVisible();
    await expect(page.locator('text=Analytics')).toBeVisible();
    await expect(page.locator('text=Settings')).toBeVisible();
  });

  test('should manage users', async ({ page }) => {
    // Navigate to users section
    await page.click('text=Users');
    
    // Verify users are displayed
    await expect(page.locator('[data-testid="user-row"]')).toBeVisible();
    
    // Check user information
    await expect(page.locator('text=Test Seller')).toBeVisible();
    await expect(page.locator('text=Test Customer')).toBeVisible();
  });

  test('should edit user information', async ({ page }) => {
    // Navigate to users section
    await page.click('text=Users');
    
    // Click edit button on first user
    await page.click('[data-testid="edit-user-button"]:first-child');
    
    // Modify user details
    await page.fill('input[name="name"]', 'Updated User Name');
    await page.selectOption('select[name="status"]', 'inactive');
    
    // Save changes
    await page.click('button:has-text("Update User")');
    
    // Verify success message
    await expect(page.locator('text=User updated successfully')).toBeVisible();
  });

  test('should manage vehicles', async ({ page }) => {
    // Navigate to vehicles section
    await page.click('text=Vehicles');
    
    // Verify vehicles are displayed
    await expect(page.locator('[data-testid="vehicle-row"]')).toBeVisible();
    
    // Check vehicle information
    await expect(page.locator('text=Honda City')).toBeVisible();
    await expect(page.locator('text=Maruti Swift')).toBeVisible();
  });

  test('should moderate vehicle listings', async ({ page }) => {
    // Navigate to vehicles section
    await page.click('text=Vehicles');
    
    // Click moderate button on first vehicle
    await page.click('[data-testid="moderate-vehicle-button"]:first-child');
    
    // Select moderation action
    await page.selectOption('select[name="action"]', 'flag');
    await page.fill('textarea[name="reason"]', 'Inappropriate content');
    
    // Submit moderation
    await page.click('button:has-text("Submit Moderation")');
    
    // Verify success message
    await expect(page.locator('text=Vehicle moderated successfully')).toBeVisible();
  });

  test('should view platform analytics', async ({ page }) => {
    // Navigate to analytics section
    await page.click('text=Analytics');
    
    // Verify analytics data
    await expect(page.locator('text=Total Users')).toBeVisible();
    await expect(page.locator('text=Total Vehicles')).toBeVisible();
    await expect(page.locator('text=Active Listings')).toBeVisible();
    await expect(page.locator('text=Total Messages')).toBeVisible();
  });

  test('should manage platform settings', async ({ page }) => {
    // Navigate to settings section
    await page.click('text=Settings');
    
    // Verify settings form
    await expect(page.locator('text=Platform Settings')).toBeVisible();
    
    // Update settings
    await page.fill('input[name="siteName"]', 'Updated ReRide Platform');
    await page.fill('textarea[name="announcement"]', 'Platform maintenance scheduled');
    
    // Save settings
    await page.click('button:has-text("Save Settings")');
    
    // Verify success message
    await expect(page.locator('text=Settings updated successfully')).toBeVisible();
  });

  test('should export data', async ({ page }) => {
    // Navigate to users section
    await page.click('text=Users');
    
    // Click export button
    await page.click('button:has-text("Export Users")');
    
    // Verify download started
    await expect(page.locator('text=Export started')).toBeVisible();
    
    // Navigate to vehicles section
    await page.click('text=Vehicles');
    
    // Click export button
    await page.click('button:has-text("Export Vehicles")');
    
    // Verify download started
    await expect(page.locator('text=Export started')).toBeVisible();
  });

  test('should view audit logs', async ({ page }) => {
    // Navigate to audit logs (if available)
    const auditLogButton = page.locator('text=Audit Logs');
    if (await auditLogButton.isVisible()) {
      await auditLogButton.click();
      
      // Verify audit logs are displayed
      await expect(page.locator('[data-testid="audit-log-entry"]')).toBeVisible();
    }
  });

  test('should handle support tickets', async ({ page }) => {
    // Navigate to support section (if available)
    const supportButton = page.locator('text=Support');
    if (await supportButton.isVisible()) {
      await supportButton.click();
      
      // Verify support tickets are displayed
      await expect(page.locator('[data-testid="support-ticket"]')).toBeVisible();
      
      // Click on a ticket
      await page.click('[data-testid="support-ticket"]:first-child');
      
      // Verify ticket details
      await expect(page.locator('[data-testid="ticket-details"]')).toBeVisible();
    }
  });
});

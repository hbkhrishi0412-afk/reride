import { test, expect } from '@playwright/test';

test.describe.configure({ mode: 'skip' });

test.describe('@legacy Seller Dashboard and Vehicle Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login as seller
    await page.goto('/');
    await page.click('text=Login');
    await page.fill('input[type="email"]', 'seller@test.com');
    await page.fill('input[type="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL(/.*dashboard.*/);
  });

  test('should display seller dashboard correctly', async ({ page }) => {
    // Verify dashboard elements
    await expect(page.locator('text=Seller Dashboard')).toBeVisible();
    await expect(page.locator('text=Test Seller')).toBeVisible();
    
    // Check dashboard tabs
    await expect(page.locator('text=Overview')).toBeVisible();
    await expect(page.locator('text=Listings')).toBeVisible();
    await expect(page.locator('text=Messages')).toBeVisible();
    await expect(page.locator('text=Analytics')).toBeVisible();
  });

  test('should add new vehicle listing', async ({ page }) => {
    // Navigate to listings tab
    await page.click('text=Listings');
    
    // Click add new vehicle button
    await page.click('button:has-text("Add New Vehicle")');
    
    // Fill vehicle form
    await page.fill('input[name="make"]', 'Toyota');
    await page.fill('input[name="model"]', 'Camry');
    await page.fill('input[name="year"]', '2021');
    await page.fill('input[name="price"]', '1200000');
    await page.fill('input[name="mileage"]', '15000');
    await page.selectOption('select[name="category"]', 'FOUR_WHEELER');
    await page.fill('textarea[name="description"]', 'Excellent condition Toyota Camry');
    await page.fill('input[name="city"]', 'Bangalore');
    await page.selectOption('select[name="fuelType"]', 'Petrol');
    await page.selectOption('select[name="transmission"]', 'Automatic');
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Verify success message
    await expect(page.locator('text=Vehicle added successfully')).toBeVisible();
  });

  test('should edit existing vehicle listing', async ({ page }) => {
    // Navigate to listings tab
    await page.click('text=Listings');
    
    // Click edit button on first vehicle
    await page.click('[data-testid="edit-vehicle-button"]:first-child');
    
    // Modify vehicle details
    await page.fill('input[name="price"]', '800000');
    await page.fill('textarea[name="description"]', 'Updated description');
    
    // Save changes
    await page.click('button:has-text("Update Vehicle")');
    
    // Verify success message
    await expect(page.locator('text=Vehicle updated successfully')).toBeVisible();
  });

  test('should delete vehicle listing', async ({ page }) => {
    // Navigate to listings tab
    await page.click('text=Listings');
    
    // Click delete button on first vehicle
    await page.click('[data-testid="delete-vehicle-button"]:first-child');
    
    // Confirm deletion
    await page.click('button:has-text("Confirm Delete")');
    
    // Verify success message
    await expect(page.locator('text=Vehicle deleted successfully')).toBeVisible();
  });

  test('should view vehicle analytics', async ({ page }) => {
    // Navigate to analytics tab
    await page.click('text=Analytics');
    
    // Verify analytics data
    await expect(page.locator('text=Total Views')).toBeVisible();
    await expect(page.locator('text=Inquiries')).toBeVisible();
    await expect(page.locator('text=Phone Reveals')).toBeVisible();
  });

  test('should manage inquiries and messages', async ({ page }) => {
    // Navigate to messages tab
    await page.click('text=Messages');
    
    // Verify conversations are displayed
    await expect(page.locator('[data-testid="conversation-item"]')).toBeVisible();
    
    // Click on a conversation
    await page.click('[data-testid="conversation-item"]:first-child');
    
    // Verify chat interface
    await expect(page.locator('[data-testid="chat-messages"]')).toBeVisible();
    await expect(page.locator('[data-testid="message-input"]')).toBeVisible();
  });

  test('should send message to customer', async ({ page }) => {
    // Navigate to messages tab
    await page.click('text=Messages');
    
    // Click on a conversation
    await page.click('[data-testid="conversation-item"]:first-child');
    
    // Send a message
    await page.fill('[data-testid="message-input"]', 'Thank you for your interest!');
    await page.click('button:has-text("Send")');
    
    // Verify message was sent
    await expect(page.locator('text=Thank you for your interest!')).toBeVisible();
  });

  test('should view seller profile', async ({ page }) => {
    // Navigate to profile tab
    await page.click('text=Profile');
    
    // Verify profile information
    await expect(page.locator('text=Test Seller')).toBeVisible();
    await expect(page.locator('text=seller@test.com')).toBeVisible();
    
    // Check if edit profile button is available
    await expect(page.locator('button:has-text("Edit Profile")')).toBeVisible();
  });

  test('should update seller profile', async ({ page }) => {
    // Navigate to profile tab
    await page.click('text=Profile');
    
    // Click edit profile button
    await page.click('button:has-text("Edit Profile")');
    
    // Update profile information
    await page.fill('input[name="name"]', 'Updated Seller Name');
    await page.fill('textarea[name="bio"]', 'Updated bio information');
    
    // Save changes
    await page.click('button:has-text("Save Changes")');
    
    // Verify success message
    await expect(page.locator('text=Profile updated successfully')).toBeVisible();
  });
});

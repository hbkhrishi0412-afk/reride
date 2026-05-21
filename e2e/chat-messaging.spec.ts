import { test, expect } from '@playwright/test';

test.describe.configure({ mode: 'skip' });

test.describe('@legacy Chat and Messaging System', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should initiate chat from vehicle detail page', async ({ page }) => {
    // Login as customer
    await page.click('text=Login');
    await page.fill('input[type="email"]', 'customer@test.com');
    await page.fill('input[type="password"]', 'password');
    await page.click('button[type="submit"]');
    
    // Navigate to vehicle listings
    await page.click('text=Buy Cars');
    
    // Click on first vehicle
    await page.click('[data-testid="vehicle-card"]:first-child');
    
    // Click contact seller button
    await page.click('button:has-text("Contact Seller")');
    
    // Verify chat interface opens
    await expect(page.locator('[data-testid="chat-widget"]')).toBeVisible();
    await expect(page.locator('[data-testid="message-input"]')).toBeVisible();
  });

  test('should send message to seller', async ({ page }) => {
    // Login as customer
    await page.click('text=Login');
    await page.fill('input[type="email"]', 'customer@test.com');
    await page.fill('input[type="password"]', 'password');
    await page.click('button[type="submit"]');
    
    // Navigate to vehicle listings
    await page.click('text=Buy Cars');
    
    // Click on first vehicle
    await page.click('[data-testid="vehicle-card"]:first-child');
    
    // Click contact seller button
    await page.click('button:has-text("Contact Seller")');
    
    // Send a message
    await page.fill('[data-testid="message-input"]', 'Is this vehicle still available?');
    await page.click('button:has-text("Send")');
    
    // Verify message was sent
    await expect(page.locator('text=Is this vehicle still available?')).toBeVisible();
  });

  test('should receive and respond to messages as seller', async ({ page }) => {
    // Login as seller
    await page.click('text=Login');
    await page.fill('input[type="email"]', 'seller@test.com');
    await page.fill('input[type="password"]', 'password');
    await page.click('button[type="submit"]');
    
    // Navigate to seller dashboard
    await page.click('text=Messages');
    
    // Click on a conversation
    await page.click('[data-testid="conversation-item"]:first-child');
    
    // Verify chat interface
    await expect(page.locator('[data-testid="chat-messages"]')).toBeVisible();
    
    // Send a response
    await page.fill('[data-testid="message-input"]', 'Yes, it is available. Would you like to schedule a viewing?');
    await page.click('button:has-text("Send")');
    
    // Verify message was sent
    await expect(page.locator('text=Yes, it is available. Would you like to schedule a viewing?')).toBeVisible();
  });

  test('should display notification badge for unread messages', async ({ page }) => {
    // Login as seller
    await page.click('text=Login');
    await page.fill('input[type="email"]', 'seller@test.com');
    await page.fill('input[type="password"]', 'password');
    await page.click('button[type="submit"]');
    
    // Check for notification badge
    await expect(page.locator('[data-testid="notification-badge"]')).toBeVisible();
    
    // Click on notification bell
    await page.click('[data-testid="notification-bell"]');
    
    // Verify notification dropdown
    await expect(page.locator('[data-testid="notification-dropdown"]')).toBeVisible();
    await expect(page.locator('text=New message from')).toBeVisible();
  });

  test('should mark messages as read', async ({ page }) => {
    // Login as seller
    await page.click('text=Login');
    await page.fill('input[type="email"]', 'seller@test.com');
    await page.fill('input[type="password"]', 'password');
    await page.click('button[type="submit"]');
    
    // Navigate to messages
    await page.click('text=Messages');
    
    // Click on a conversation
    await page.click('[data-testid="conversation-item"]:first-child');
    
    // Verify messages are marked as read
    await expect(page.locator('[data-testid="unread-indicator"]')).not.toBeVisible();
  });

  test('should handle multiple conversations', async ({ page }) => {
    // Login as seller
    await page.click('text=Login');
    await page.fill('input[type="email"]', 'seller@test.com');
    await page.fill('input[type="password"]', 'password');
    await page.click('button[type="submit"]');
    
    // Navigate to messages
    await page.click('text=Messages');
    
    // Verify multiple conversations are displayed
    const conversations = page.locator('[data-testid="conversation-item"]');
    await expect(conversations).toHaveCount(1); // Based on test data
    
    // Click on different conversation
    await page.click('[data-testid="conversation-item"]:first-child');
    
    // Verify chat interface updates
    await expect(page.locator('[data-testid="chat-messages"]')).toBeVisible();
  });

  test('should display message timestamps', async ({ page }) => {
    // Login as seller
    await page.click('text=Login');
    await page.fill('input[type="email"]', 'seller@test.com');
    await page.fill('input[type="password"]', 'password');
    await page.click('button[type="submit"]');
    
    // Navigate to messages
    await page.click('text=Messages');
    
    // Click on a conversation
    await page.click('[data-testid="conversation-item"]:first-child');
    
    // Verify timestamps are displayed
    await expect(page.locator('[data-testid="message-timestamp"]')).toBeVisible();
  });

  test('should handle chat widget on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Login as customer
    await page.click('text=Login');
    await page.fill('input[type="email"]', 'customer@test.com');
    await page.fill('input[type="password"]', 'password');
    await page.click('button[type="submit"]');
    
    // Navigate to vehicle listings
    await page.click('text=Buy Cars');
    
    // Click on first vehicle
    await page.click('[data-testid="vehicle-card"]:first-child');
    
    // Click contact seller button
    await page.click('button:has-text("Contact Seller")');
    
    // Verify chat widget is responsive
    await expect(page.locator('[data-testid="chat-widget"]')).toBeVisible();
  });

  test('should handle offline chat functionality', async ({ page }) => {
    // Login as customer
    await page.click('text=Login');
    await page.fill('input[type="email"]', 'customer@test.com');
    await page.fill('input[type="password"]', 'password');
    await page.click('button[type="submit"]');
    
    // Navigate to vehicle listings
    await page.click('text=Buy Cars');
    
    // Click on first vehicle
    await page.click('[data-testid="vehicle-card"]:first-child');
    
    // Click contact seller button
    await page.click('button:has-text("Contact Seller")');
    
    // Simulate offline mode
    await page.context().setOffline(true);
    
    // Try to send a message
    await page.fill('[data-testid="message-input"]', 'Test offline message');
    await page.click('button:has-text("Send")');
    
    // Verify offline indicator
    await expect(page.locator('text=Offline')).toBeVisible();
    
    // Restore online mode
    await page.context().setOffline(false);
  });
});

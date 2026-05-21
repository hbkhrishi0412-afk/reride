import { test, expect } from '@playwright/test';

test.describe.configure({ mode: 'skip' });

test.describe('@legacy Complete User Journey - Customer to Purchase', () => {
  test('should complete full customer journey from registration to vehicle inquiry', async ({ page }) => {
    // Step 1: Visit homepage
    await page.goto('/');
    await expect(page.locator('text=ReRide')).toBeVisible();
    
    // Step 2: Browse vehicles as guest
    await page.click('text=Buy Cars');
    await expect(page.locator('[data-testid="vehicle-card"]')).toBeVisible();
    
    // Step 3: View vehicle details
    await page.click('[data-testid="vehicle-card"]:first-child');
    await expect(page.locator('text=Honda City')).toBeVisible();
    await expect(page.locator('text=₹8,50,000')).toBeVisible();
    
    // Step 4: Register as new customer
    await page.click('text=Login');
    await page.click('text=Register');
    
    // Fill registration form
    await page.fill('input[name="name"]', 'John Doe');
    await page.fill('input[name="email"]', 'john.doe@test.com');
    await page.fill('input[name="password"]', 'password123');
    await page.fill('input[name="mobile"]', '9876543210');
    await page.selectOption('select[name="role"]', 'customer');
    
    await page.click('button[type="submit"]');
    
    // Step 5: Verify successful registration and login
    await page.waitForURL(/.*dashboard.*/);
    await expect(page.locator('text=John Doe')).toBeVisible();
    
    // Step 6: Browse vehicles as logged-in customer
    await page.click('text=Buy Cars');
    await expect(page.locator('[data-testid="vehicle-card"]')).toBeVisible();
    
    // Step 7: Add vehicle to wishlist
    await page.click('[data-testid="vehicle-card"]:first-child');
    await page.click('[data-testid="wishlist-button"]');
    await expect(page.locator('text=Added to wishlist')).toBeVisible();
    
    // Step 8: Contact seller
    await page.click('button:has-text("Contact Seller")');
    await expect(page.locator('[data-testid="chat-widget"]')).toBeVisible();
    
    // Step 9: Send inquiry message
    await page.fill('[data-testid="message-input"]', 'Hi, I am interested in this vehicle. Is it still available?');
    await page.click('button:has-text("Send")');
    await expect(page.locator('text=Hi, I am interested in this vehicle. Is it still available?')).toBeVisible();
    
    // Step 10: View wishlist
    await page.click('text=Saved');
    await expect(page.locator('text=Your Saved Vehicles')).toBeVisible();
    await expect(page.locator('text=Honda City')).toBeVisible();
    
    // Step 11: Compare vehicles
    await page.click('text=Buy Cars');
    await page.click('[data-testid="compare-button"]:first-child');
    await page.click('[data-testid="compare-button"]:nth-child(2)');
    
    await page.click('text=Compare');
    await expect(page.locator('text=Vehicle Comparison')).toBeVisible();
    
    // Step 12: Logout
    await page.click('text=Logout');
    await page.waitForURL('/');
    await expect(page.locator('text=Login')).toBeVisible();
  });
});

test.describe('Complete User Journey - Seller Registration to Listing', () => {
  test('should complete full seller journey from registration to vehicle listing', async ({ page }) => {
    // Step 1: Visit homepage
    await page.goto('/');
    
    // Step 2: Register as seller
    await page.click('text=Login');
    await page.click('text=Register');
    
    // Fill seller registration form
    await page.fill('input[name="name"]', 'Jane Seller');
    await page.fill('input[name="email"]', 'jane.seller@test.com');
    await page.fill('input[name="password"]', 'password123');
    await page.fill('input[name="mobile"]', '9876543211');
    await page.selectOption('select[name="role"]', 'seller');
    
    await page.click('button[type="submit"]');
    
    // Step 3: Verify seller dashboard
    await page.waitForURL(/.*dashboard.*/);
    await expect(page.locator('text=Seller Dashboard')).toBeVisible();
    await expect(page.locator('text=Jane Seller')).toBeVisible();
    
    // Step 4: Add new vehicle listing
    await page.click('text=Listings');
    await page.click('button:has-text("Add New Vehicle")');
    
    // Fill vehicle form
    await page.fill('input[name="make"]', 'Toyota');
    await page.fill('input[name="model"]', 'Camry');
    await page.fill('input[name="year"]', '2021');
    await page.fill('input[name="price"]', '1200000');
    await page.fill('input[name="mileage"]', '15000');
    await page.selectOption('select[name="category"]', 'FOUR_WHEELER');
    await page.fill('textarea[name="description"]', 'Excellent condition Toyota Camry, single owner');
    await page.fill('input[name="city"]', 'Bangalore');
    await page.selectOption('select[name="fuelType"]', 'Petrol');
    await page.selectOption('select[name="transmission"]', 'Automatic');
    await page.fill('input[name="engine"]', '2.5L');
    await page.fill('input[name="color"]', 'Silver');
    
    await page.click('button[type="submit"]');
    
    // Step 5: Verify vehicle was added
    await expect(page.locator('text=Vehicle added successfully')).toBeVisible();
    await expect(page.locator('text=Toyota Camry')).toBeVisible();
    
    // Step 6: View vehicle analytics
    await page.click('text=Analytics');
    await expect(page.locator('text=Total Views')).toBeVisible();
    await expect(page.locator('text=Inquiries')).toBeVisible();
    
    // Step 7: Check messages
    await page.click('text=Messages');
    await expect(page.locator('[data-testid="conversation-item"]')).toBeVisible();
    
    // Step 8: Update profile
    await page.click('text=Profile');
    await page.click('button:has-text("Edit Profile")');
    
    await page.fill('textarea[name="bio"]', 'Experienced car dealer with 10+ years in the business');
    await page.click('button:has-text("Save Changes")');
    
    await expect(page.locator('text=Profile updated successfully')).toBeVisible();
    
    // Step 9: Logout
    await page.click('text=Logout');
    await page.waitForURL('/');
    await expect(page.locator('text=Login')).toBeVisible();
  });
});

test.describe('Complete User Journey - Admin Management', () => {
  test('should complete admin management journey', async ({ page }) => {
    // Step 1: Login as admin
    await page.goto('/');
    await page.click('text=Login');
    await page.fill('input[type="email"]', 'admin@test.com');
    await page.fill('input[type="password"]', 'password');
    await page.click('button[type="submit"]');
    
    // Step 2: Verify admin dashboard
    await page.waitForURL(/.*dashboard.*/);
    await expect(page.locator('text=Admin Panel')).toBeVisible();
    
    // Step 3: Manage users
    await page.click('text=Users');
    await expect(page.locator('[data-testid="user-row"]')).toBeVisible();
    
    // Edit a user
    await page.click('[data-testid="edit-user-button"]:first-child');
    await page.fill('input[name="name"]', 'Updated User Name');
    await page.click('button:has-text("Update User")');
    await expect(page.locator('text=User updated successfully')).toBeVisible();
    
    // Step 4: Manage vehicles
    await page.click('text=Vehicles');
    await expect(page.locator('[data-testid="vehicle-row"]')).toBeVisible();
    
    // Moderate a vehicle
    await page.click('[data-testid="moderate-vehicle-button"]:first-child');
    await page.selectOption('select[name="action"]', 'approve');
    await page.click('button:has-text("Submit Moderation")');
    await expect(page.locator('text=Vehicle moderated successfully')).toBeVisible();
    
    // Step 5: View analytics
    await page.click('text=Analytics');
    await expect(page.locator('text=Total Users')).toBeVisible();
    await expect(page.locator('text=Total Vehicles')).toBeVisible();
    
    // Step 6: Update settings
    await page.click('text=Settings');
    await page.fill('input[name="siteName"]', 'Updated ReRide Platform');
    await page.fill('textarea[name="announcement"]', 'Welcome to our updated platform!');
    await page.click('button:has-text("Save Settings")');
    await expect(page.locator('text=Settings updated successfully')).toBeVisible();
    
    // Step 7: Export data
    await page.click('text=Users');
    await page.click('button:has-text("Export Users")');
    await expect(page.locator('text=Export started')).toBeVisible();
    
    // Step 8: Logout
    await page.click('text=Logout');
    await page.waitForURL('/');
    await expect(page.locator('text=Login')).toBeVisible();
  });
});

test.describe('Cross-Browser User Journey', () => {
  test('should work consistently across different browsers', async ({ page, browserName }) => {
    console.log(`Testing on ${browserName}`);
    
    // Basic functionality test
    await page.goto('/');
    await expect(page.locator('text=ReRide')).toBeVisible();
    
    // Login test
    await page.click('text=Login');
    await page.fill('input[type="email"]', 'customer@test.com');
    await page.fill('input[type="password"]', 'password');
    await page.click('button[type="submit"]');
    
    await page.waitForURL(/.*dashboard.*/);
    await expect(page.locator('text=Customer Dashboard')).toBeVisible();
    
    // Navigation test
    await page.click('text=Buy Cars');
    await expect(page.locator('[data-testid="vehicle-card"]')).toBeVisible();
    
    // Vehicle detail test
    await page.click('[data-testid="vehicle-card"]:first-child');
    await expect(page.locator('text=Honda City')).toBeVisible();
    
    // Chat test
    await page.click('button:has-text("Contact Seller")');
    await expect(page.locator('[data-testid="chat-widget"]')).toBeVisible();
    
    // Logout test
    await page.click('text=Logout');
    await page.waitForURL('/');
    await expect(page.locator('text=Login')).toBeVisible();
  });
});

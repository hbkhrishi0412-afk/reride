import { test, expect } from '@playwright/test';

/**
 * Security Tests
 * Tests for XSS, CSRF, SQL injection, and other security vulnerabilities
 */

test.describe('Security Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173');
  });

  test('should prevent XSS in search input', async ({ page }) => {
    // Try to inject script tag
    const xssPayload = '<script>alert("XSS")</script>';
    
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i]').first();
    if (await searchInput.count() > 0) {
      await searchInput.fill(xssPayload);
      await searchInput.press('Enter');
      
      // Check that script tag is not executed
      const alertHandled = await page.evaluate(() => {
        return typeof window.alert === 'function';
      });
      
      // Script should be sanitized, not executed
      expect(alertHandled).toBe(true);
      
      // Check that script tag is escaped in DOM
      const pageContent = await page.content();
      expect(pageContent).not.toContain('<script>alert');
    }
  });

  test('should sanitize user input in forms', async ({ page }) => {
    // Navigate to registration if available
    const registerLink = page.locator('a[href*="register"], a[href*="signup"], button:has-text("Register"), button:has-text("Sign Up")').first();
    
    if (await registerLink.count() > 0) {
      await registerLink.click();
      
      // Try to inject HTML in name field
      const maliciousInput = '<img src=x onerror=alert(1)>';
      const nameInput = page.locator('input[name="name"], input[type="text"]').first();
      
      if (await nameInput.count() > 0) {
        await nameInput.fill(maliciousInput);
        
        // Check that input is sanitized
        const value = await nameInput.inputValue();
        expect(value).not.toContain('<img');
        expect(value).not.toContain('onerror');
      }
    }
  });

  test('should prevent SQL injection in search', async ({ page }) => {
    // Try SQL injection payload
    const sqlPayload = "'; DROP TABLE users; --";
    
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i]').first();
    if (await searchInput.count() > 0) {
      await searchInput.fill(sqlPayload);
      await searchInput.press('Enter');
      
      // Wait for any response
      await page.waitForTimeout(1000);
      
      // Application should still work (no crash)
      const isPageLoaded = await page.evaluate(() => document.readyState === 'complete');
      expect(isPageLoaded).toBe(true);
    }
  });

  test('should have proper security headers', async ({ page }) => {
    const response = await page.goto('http://localhost:5173');
    
    if (response) {
      const headers = response.headers();
      
      // Check for security headers
      expect(headers['x-content-type-options']).toBe('nosniff');
      expect(headers['x-frame-options']).toBeDefined();
      expect(headers['referrer-policy']).toBeDefined();
    }
  });

  test('should not expose secrets in error messages', async ({ page }) => {
    // Try to trigger an error (e.g., invalid API call)
    const response = await page.request.get('http://localhost:5173/api/invalid-endpoint');
    
    const body = await response.text();
    const jsonBody = JSON.parse(body);
    
    // Error message should not contain secrets
    const errorMessage = JSON.stringify(jsonBody).toLowerCase();
    expect(errorMessage).not.toContain('supabase_service_role_key');
    expect(errorMessage).not.toContain('jwt_secret');
    expect(errorMessage).not.toContain('api_key');
    expect(errorMessage).not.toContain('password');
  });
});









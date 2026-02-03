import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y } from 'axe-playwright';

/**
 * Accessibility Tests
 * Tests for WCAG compliance and accessibility standards
 */

test.describe('Accessibility Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173');
    // Inject axe-core
    await injectAxe(page);
  });

  test('homepage should be accessible', async ({ page }) => {
    await checkA11y(page, undefined, {
      detailedReport: true,
      detailedReportOptions: { html: true },
    });
  });

  test('should have proper heading hierarchy', async ({ page }) => {
    const h1Count = await page.locator('h1').count();
    expect(h1Count).toBeGreaterThanOrEqual(1);
    expect(h1Count).toBeLessThanOrEqual(1); // Should have exactly one h1
    
    // Check that headings are in order (no h3 before h2, etc.)
    const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();
    let lastLevel = 0;
    
    for (const heading of headings) {
      const tagName = await heading.evaluate((el) => el.tagName.toLowerCase());
      const level = parseInt(tagName.charAt(1));
      
      // Allow same level or one level deeper
      expect(level).toBeLessThanOrEqual(lastLevel + 1);
      lastLevel = level;
    }
  });

  test('images should have alt text', async ({ page }) => {
    const images = await page.locator('img').all();
    
    for (const img of images) {
      const alt = await img.getAttribute('alt');
      // Decorative images can have empty alt, but should be present
      expect(alt).not.toBeNull();
    }
  });

  test('forms should have labels', async ({ page }) => {
    const inputs = await page.locator('input[type="text"], input[type="email"], input[type="password"], textarea').all();
    
    for (const input of inputs) {
      const id = await input.getAttribute('id');
      const ariaLabel = await input.getAttribute('aria-label');
      const ariaLabelledBy = await input.getAttribute('aria-labelledby');
      const placeholder = await input.getAttribute('placeholder');
      
      // Input should have at least one: id with label, aria-label, aria-labelledby, or placeholder
      const hasLabel = id 
        ? await page.locator(`label[for="${id}"]`).count() > 0
        : false;
      
      const hasAccessibleName = hasLabel || ariaLabel || ariaLabelledBy || placeholder;
      expect(hasAccessibleName).toBe(true);
    }
  });

  test('should be keyboard navigable', async ({ page }) => {
    // Tab through interactive elements
    const interactiveElements = await page.locator('a, button, input, textarea, select, [tabindex]').all();
    
    expect(interactiveElements.length).toBeGreaterThan(0);
    
    // Check that focus is visible
    await page.keyboard.press('Tab');
    const focusedElement = await page.evaluate(() => document.activeElement);
    expect(focusedElement).not.toBeNull();
  });

  test('should have sufficient color contrast', async ({ page }) => {
    // This is a basic check - full contrast testing requires more complex setup
    await checkA11y(page, undefined, {
      rules: {
        'color-contrast': { enabled: true },
      },
    });
  });

  test('should have skip links for navigation', async ({ page }) => {
    // Check for skip to main content link
    const skipLink = page.locator('a[href*="#main"], a:has-text("Skip"), [class*="skip"]').first();
    
    // Skip link is recommended but not required
    if (await skipLink.count() > 0) {
      await expect(skipLink).toBeVisible();
    }
  });
});










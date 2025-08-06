import { test, expect } from '@playwright/test';

test.describe('Monitoring System E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should display progress tracker when operations are running', async ({ page }) => {
    // Start an operation (simulating an API call)
    await page.click('button:has-text("Test API")');
    
    // Progress tracker should be visible
    await expect(page.locator('[data-testid="progress-tracker"]')).toBeVisible();
    
    // Should show operation details
    await expect(page.locator('text=API Call in Progress')).toBeVisible();
    
    // Progress bar should be visible
    await expect(page.locator('[role="progressbar"]')).toBeVisible();
    
    // Wait for operation to complete
    await page.waitForSelector('text=Operation Complete', { timeout: 10000 });
  });

  test('should show error dashboard when errors occur', async ({ page }) => {
    // Trigger an error (simulating a failed API call)
    await page.click('button:has-text("Trigger Error")');
    
    // Error indicator should appear in status bar
    await expect(page.locator('[data-testid="error-count"]')).toBeVisible();
    
    // Click to open error dashboard
    await page.click('[data-testid="error-count"]');
    
    // Error dashboard should be visible
    await expect(page.locator('[data-testid="error-dashboard"]')).toBeVisible();
    
    // Should show error details
    await expect(page.locator('text=API request failed')).toBeVisible();
    
    // Should show error severity
    await expect(page.locator('[data-testid="error-severity-high"]')).toBeVisible();
  });

  test('should track file operations', async ({ page }) => {
    // Open file picker
    await page.click('button:has-text("Open File")');
    
    // Select a file (mocked in test environment)
    await page.setInputFiles('input[type="file"]', {
      name: 'test.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('test content')
    });
    
    // Progress tracker should show file operation
    await expect(page.locator('text=Reading file: test.txt')).toBeVisible();
    
    // Operation should complete
    await expect(page.locator('text=File loaded successfully')).toBeVisible({ timeout: 5000 });
  });

  test('should handle multiple concurrent operations', async ({ page }) => {
    // Start multiple operations
    await page.click('button:has-text("Run Multiple Tasks")');
    
    // Progress tracker should show multiple operations
    await expect(page.locator('[data-testid="operation-card"]')).toHaveCount(3);
    
    // Each operation should have its own progress
    const progressBars = page.locator('[role="progressbar"]');
    await expect(progressBars).toHaveCount(3);
    
    // Overall progress should be visible
    await expect(page.locator('text=Overall Progress')).toBeVisible();
  });

  test('should filter operations by type', async ({ page }) => {
    // Start different types of operations
    await page.click('button:has-text("Start Mixed Operations")');
    
    // Open progress tracker
    await page.click('[data-testid="progress-tracker-toggle"]');
    
    // Filter by API calls
    await page.click('button:has-text("API Calls")');
    
    // Should only show API operations
    const operations = page.locator('[data-testid="operation-card"]');
    const count = await operations.count();
    
    for (let i = 0; i < count; i++) {
      const text = await operations.nth(i).textContent();
      expect(text).toContain('API');
    }
  });

  test('should export error report', async ({ page }) => {
    // Generate some errors
    await page.click('button:has-text("Generate Test Errors")');
    
    // Open error dashboard
    await page.click('[data-testid="error-count"]');
    
    // Click export button
    const downloadPromise = page.waitForEvent('download');
    await page.click('button:has-text("Export Errors")');
    
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('errors');
    expect(download.suggestedFilename()).toMatch(/\.(json|csv)$/);
  });

  test('should show real-time updates', async ({ page }) => {
    // Start a long-running operation
    await page.click('button:has-text("Start Build")');
    
    // Progress should update in real-time
    const progressBar = page.locator('[role="progressbar"]').first();
    
    // Check initial progress
    const initialProgress = await progressBar.getAttribute('aria-valuenow');
    
    // Wait a bit
    await page.waitForTimeout(2000);
    
    // Progress should have increased
    const updatedProgress = await progressBar.getAttribute('aria-valuenow');
    expect(Number(updatedProgress)).toBeGreaterThan(Number(initialProgress));
  });

  test('should handle error resolution', async ({ page }) => {
    // Trigger an error
    await page.click('button:has-text("Trigger Resolvable Error")');
    
    // Open error dashboard
    await page.click('[data-testid="error-count"]');
    
    // Find the error entry
    const errorEntry = page.locator('[data-testid^="error-"]').first();
    await expect(errorEntry).toBeVisible();
    
    // Click resolve button
    await errorEntry.locator('button:has-text("Resolve")').click();
    
    // Fill resolution notes
    await page.fill('[placeholder="Resolution notes"]', 'Fixed by updating configuration');
    
    // Submit resolution
    await page.click('button:has-text("Mark as Resolved")');
    
    // Error should be marked as resolved
    await expect(errorEntry.locator('text=Resolved')).toBeVisible();
  });

  test('should display operation statistics', async ({ page }) => {
    // Run various operations
    await page.click('button:has-text("Run Test Suite")');
    
    // Wait for some operations to complete
    await page.waitForTimeout(3000);
    
    // Open statistics view
    await page.click('button:has-text("View Statistics")');
    
    // Should show charts
    await expect(page.locator('[data-testid="operations-chart"]')).toBeVisible();
    await expect(page.locator('[data-testid="success-rate-chart"]')).toBeVisible();
    
    // Should show metrics
    await expect(page.locator('text=Total Operations')).toBeVisible();
    await expect(page.locator('text=Success Rate')).toBeVisible();
    await expect(page.locator('text=Average Duration')).toBeVisible();
  });

  test('should persist error filters', async ({ page }) => {
    // Open error dashboard
    await page.click('[data-testid="error-count"]');
    
    // Set filters
    await page.click('button:has-text("Filter")');
    await page.check('input[value="high"]');
    await page.check('input[value="api"]');
    await page.click('button:has-text("Apply Filters")');
    
    // Reload page
    await page.reload();
    
    // Open error dashboard again
    await page.click('[data-testid="error-count"]');
    
    // Filters should still be applied
    await expect(page.locator('input[value="high"]')).toBeChecked();
    await expect(page.locator('input[value="api"]')).toBeChecked();
  });

  test('should handle operation cancellation', async ({ page }) => {
    // Start a long operation
    await page.click('button:has-text("Start Long Task")');
    
    // Operation should be running
    await expect(page.locator('text=Long Task Running')).toBeVisible();
    
    // Cancel the operation
    await page.click('button[aria-label="Cancel operation"]');
    
    // Confirm cancellation
    await page.click('button:has-text("Yes, Cancel")');
    
    // Operation should be marked as cancelled
    await expect(page.locator('text=Operation cancelled')).toBeVisible();
  });

  test('should show operation details on click', async ({ page }) => {
    // Start an operation with metadata
    await page.click('button:has-text("API with Details")');
    
    // Click on the operation card
    await page.click('[data-testid="operation-card"]');
    
    // Details panel should expand
    await expect(page.locator('[data-testid="operation-details"]')).toBeVisible();
    
    // Should show metadata
    await expect(page.locator('text=Endpoint: /api/users')).toBeVisible();
    await expect(page.locator('text=Method: GET')).toBeVisible();
    await expect(page.locator('text=Headers:')).toBeVisible();
  });

  test('should group similar errors', async ({ page }) => {
    // Generate similar errors
    for (let i = 0; i < 5; i++) {
      await page.click('button:has-text("Trigger Rate Limit")');
      await page.waitForTimeout(100);
    }
    
    // Open error dashboard
    await page.click('[data-testid="error-count"]');
    
    // Should show grouped error
    await expect(page.locator('text=Rate limit exceeded (5 occurrences)')).toBeVisible();
    
    // Click to expand group
    await page.click('text=Rate limit exceeded (5 occurrences)');
    
    // Should show individual errors
    await expect(page.locator('[data-testid^="error-"]')).toHaveCount(5);
  });

  test('should show performance impact warnings', async ({ page }) => {
    // Start resource-intensive operation
    await page.click('button:has-text("Heavy Operation")');
    
    // Should show performance warning
    await expect(page.locator('[data-testid="performance-warning"]')).toBeVisible();
    await expect(page.locator('text=High CPU usage detected')).toBeVisible();
    
    // Should suggest optimization
    await expect(page.locator('text=Consider breaking this operation into smaller tasks')).toBeVisible();
  });

  test('accessibility: should be keyboard navigable', async ({ page }) => {
    // Open progress tracker
    await page.click('[data-testid="progress-tracker-toggle"]');
    
    // Tab through operations
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="operation-card"]:focus')).toBeVisible();
    
    // Use arrow keys to navigate
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('[data-testid="operation-card"]:nth-child(2):focus')).toBeVisible();
    
    // Press Enter to select
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-testid="operation-details"]')).toBeVisible();
    
    // Escape to close
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid="operation-details"]')).not.toBeVisible();
  });

  test('should handle network failures gracefully', async ({ page, context }) => {
    // Simulate offline mode
    await context.setOffline(true);
    
    // Try to make an API call
    await page.click('button:has-text("Fetch Data")');
    
    // Should show network error
    await expect(page.locator('text=Network connection lost')).toBeVisible();
    
    // Should suggest retry
    await expect(page.locator('button:has-text("Retry when online")').isEnabled()).toBe(false);
    
    // Go back online
    await context.setOffline(false);
    
    // Retry button should be enabled
    await expect(page.locator('button:has-text("Retry when online")').isEnabled()).toBe(true);
  });
});
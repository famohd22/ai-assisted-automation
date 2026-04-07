import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Screenshot Helper - Manages test failure screenshots
 * Provides utilities for capturing, storing, and managing screenshots
 */
class ScreenshotHelper {
  
  /**
   * Ensure directory exists for file path
   * Creates directories recursively if they don't exist
   * @param {string} filePath - Full path including filename
   * @returns {boolean} - True if directory exists or was created
   */
  static ensureDirectoryExists(filePath) {
    const dirname = path.dirname(filePath);
    if (fs.existsSync(dirname)) {
      return true;
    }
    try {
      fs.mkdirSync(dirname, { recursive: true });
      console.log(`Created directory: ${dirname}`);
      return true;
    } catch (error) {
      console.error(`Failed to create directory ${dirname}:`, error.message);
      return false;
    }
  }

  /**
   * Generate a unique screenshot file path
   * @param {string} testName - Name of the test
   * @param {number} timestamp - Optional timestamp (defaults to Date.now())
   * @returns {string} - Full file path for screenshot
   */
  static generateScreenshotPath(testName, timestamp = Date.now()) {
    // Sanitize test name for filesystem (remove special characters, limit length)
    const sanitizedName = testName
      .replace(/[^a-z0-9]/gi, '_')
      .toLowerCase()
      .substring(0, 100); // Limit to 100 characters to avoid path length issues
    
    const filename = `failure_${sanitizedName}_${timestamp}.png`;
    const filepath = path.join(process.cwd(), 'test-results', 'jira-attachments', filename);
    
    this.ensureDirectoryExists(filepath);
    return filepath;
  }

  /**
   * Take a full page screenshot on test failure
   * @param {object} page - Playwright page object
   * @param {string} testName - Name of the test
   * @returns {Promise<string|null>} - Path to screenshot or null if failed
   */
  static async takeFailureScreenshot(page, testName) {
    try {
      const screenshotPath = this.generateScreenshotPath(testName);
      
      // Take full page screenshot with high quality
      await page.screenshot({ 
        path: screenshotPath, 
        fullPage: true,
        timeout: 10000, // 10 second timeout
        //quality: 80, // JPEG quality (if using JPEG)
        type: 'png' // Use PNG for better quality
      });
      
      // Get file size for logging
      const stats = fs.statSync(screenshotPath);
      const fileSizeInKB = (stats.size / 1024).toFixed(2);
      
      console.log(`Screenshot saved: ${screenshotPath} (${fileSizeInKB} KB)`);
      return screenshotPath;
    } catch (error) {
      console.error('Failed to take screenshot:', error.message);
      
      // Try alternative: take viewport screenshot if full page fails
      try {
        const screenshotPath = this.generateScreenshotPath(testName, Date.now());
        await page.screenshot({ 
          path: screenshotPath, 
          fullPage: false,
          timeout: 5000
        });
        console.log(`Viewport screenshot saved as fallback: ${screenshotPath}`);
        return screenshotPath;
      } catch (fallbackError) {
        console.error('Fallback screenshot also failed:', fallbackError.message);
        return null;
      }
    }
  }

  /**
   * Take a screenshot of a specific element on the page
   * @param {object} page - Playwright page object
   * @param {string} selector - CSS/XPath selector for the element
   * @param {string} testName - Name of the test
   * @returns {Promise<string|null>} - Path to screenshot or null if failed
   */
  static async takeElementScreenshot(page, selector, testName) {
    try {
      // Wait for element to be visible
      const element = await page.locator(selector);
      await element.waitFor({ state: 'visible', timeout: 5000 });
      
      const sanitizedName = testName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const filename = `element_${sanitizedName}_${Date.now()}.png`;
      const filepath = path.join(process.cwd(), 'test-results', 'jira-attachments', filename);
      
      this.ensureDirectoryExists(filepath);
      await element.screenshot({ path: filepath, timeout: 5000 });
      
      console.log(`Element screenshot saved: ${filepath} (selector: ${selector})`);
      return filepath;
    } catch (error) {
      console.error(`Failed to take element screenshot for selector "${selector}":`, error.message);
      return null;
    }
  }

  /**
   * Take multiple screenshots (full page + specific elements)
   * @param {object} page - Playwright page object
   * @param {string} testName - Name of the test
   * @param {string[]} selectors - Array of CSS selectors for elements to capture
   * @returns {Promise<string[]>} - Array of screenshot paths
   */
  static async takeMultipleScreenshots(page, testName, selectors = []) {
    const screenshots = [];
    
    console.log(`Capturing screenshots for test: "${testName}"`);
    
    // Take full page screenshot
    const fullPage = await this.takeFailureScreenshot(page, testName);
    if (fullPage) screenshots.push(fullPage);
    
    // Take screenshots of specific elements if provided
    if (selectors && selectors.length > 0) {
      console.log(`Capturing ${selectors.length} element screenshot(s)...`);
      for (const selector of selectors) {
        const elementShot = await this.takeElementScreenshot(page, selector, testName);
        if (elementShot) screenshots.push(elementShot);
        
        // Small delay between element screenshots to avoid overwhelming the page
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    console.log(`Total screenshots captured: ${screenshots.length}`);
    return screenshots;
  }

  /**
   * Take a screenshot of the entire page with custom options
   * @param {object} page - Playwright page object
   * @param {string} testName - Name of the test
   * @param {object} options - Additional screenshot options
   * @returns {Promise<string|null>} - Path to screenshot or null if failed
   */
  static async takeCustomScreenshot(page, testName, options = {}) {
    try {
      const timestamp = Date.now();
      const sanitizedName = testName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const filename = `custom_${sanitizedName}_${timestamp}.png`;
      const filepath = path.join(process.cwd(), 'test-results', 'jira-attachments', filename);
      
      this.ensureDirectoryExists(filepath);
      
      const defaultOptions = {
        path: filepath,
        fullPage: false,
        timeout: 10000,
        type: 'png'
      };
      
      const finalOptions = { ...defaultOptions, ...options };
      await page.screenshot(finalOptions);
      
      console.log(`Custom screenshot saved: ${filepath}`);
      return filepath;
    } catch (error) {
      console.error('Failed to take custom screenshot:', error.message);
      return null;
    }
  }

  /**
   * Clean up old screenshots (older than specified days)
   * @param {number} daysOld - Delete screenshots older than this many days
   * @returns {Promise<number>} - Number of files deleted
   */
  static async cleanupOldScreenshots(daysOld = 7) {
    const attachmentsDir = path.join(process.cwd(), 'test-results', 'jira-attachments');
    
    if (!fs.existsSync(attachmentsDir)) {
      console.log('No attachments directory found');
      return 0;
    }
    
    const now = Date.now();
    const maxAge = daysOld * 24 * 60 * 60 * 1000;
    let deletedCount = 0;
    
    try {
      const files = fs.readdirSync(attachmentsDir);
      
      for (const file of files) {
        const filePath = path.join(attachmentsDir, file);
        const stats = fs.statSync(filePath);
        const fileAge = now - stats.mtimeMs;
        
        if (fileAge > maxAge) {
          fs.unlinkSync(filePath);
          deletedCount++;
          console.log(`Deleted old screenshot: ${file}`);
        }
      }
      
      console.log(`Cleaned up ${deletedCount} old screenshot(s) (older than ${daysOld} days)`);
    } catch (error) {
      console.error('Failed to cleanup old screenshots:', error.message);
    }
    
    return deletedCount;
  }

  /**
   * Get storage usage of screenshots directory
   * @returns {Promise<object>} - Storage statistics
   */
  static async getStorageStats() {
    const attachmentsDir = path.join(process.cwd(), 'test-results', 'jira-attachments');
    
    if (!fs.existsSync(attachmentsDir)) {
      return { exists: false, totalFiles: 0, totalSizeKB: 0 };
    }
    
    let totalFiles = 0;
    let totalSizeBytes = 0;
    
    try {
      const files = fs.readdirSync(attachmentsDir);
      
      for (const file of files) {
        const filePath = path.join(attachmentsDir, file);
        const stats = fs.statSync(filePath);
        totalFiles++;
        totalSizeBytes += stats.size;
      }
      
      const totalSizeKB = (totalSizeBytes / 1024).toFixed(2);
      
      console.log(`Screenshot storage: ${totalFiles} files, ${totalSizeKB} KB`);
      
      return {
        exists: true,
        totalFiles,
        totalSizeKB: parseFloat(totalSizeKB),
        totalSizeBytes
      };
    } catch (error) {
      console.error('Failed to get storage stats:', error.message);
      return { exists: true, totalFiles: 0, totalSizeKB: 0, error: error.message };
    }
  }

  /**
   * Take screenshot with retry logic
   * @param {object} page - Playwright page object
   * @param {string} testName - Name of the test
   * @param {number} maxRetries - Maximum number of retry attempts
   * @returns {Promise<string|null>} - Path to screenshot or null if failed
   */
  static async takeScreenshotWithRetry(page, testName, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const screenshotPath = await this.takeFailureScreenshot(page, `${testName}_attempt${attempt}`);
        if (screenshotPath) {
          return screenshotPath;
        }
      } catch (error) {
        console.error(`Screenshot attempt ${attempt} failed:`, error.message);
        if (attempt === maxRetries) {
          console.error(`All ${maxRetries} screenshot attempts failed`);
          return null;
        }
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
    return null;
  }
}

export default ScreenshotHelper;
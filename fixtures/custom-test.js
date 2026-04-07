import { test as base } from '@playwright/test';
import jiraService from '../utils/jira-service.js';
import ScreenshotHelper from '../helpers/screenshot-helper.js';
import BugReportBuilder from '../helpers/bug-report-builder.js';

// Track created bugs to avoid duplicates
const createdBugs = new Map();
const failureCount = new Map();

async function createJiraBugOnFailure(testInfo, page, error) {
  console.log('Test name:', testInfo.title);
  console.log('Error:', error.message);
  
  const testName = testInfo.title;
  const environment = process.env.TEST_ENVIRONMENT || 'staging';
  const minFailures = parseInt(process.env.MIN_FAILURE_THRESHOLD || '1');
  
  const currentFailCount = (failureCount.get(testName) || 0) + 1;
  failureCount.set(testName, currentFailCount);
  
  console.log(`\n Handling test failure: "${testName}" (Failure #${currentFailCount})`);
  
  if (currentFailCount < minFailures) {
    console.log(`Test failed ${currentFailCount}/${minFailures} times. Bug will be created after ${minFailures} failures.`);
    return null;
  }
  
  if (createdBugs.has(testName)) {
    const existingBugKey = createdBugs.get(testName);
    console.log(`Bug ${existingBugKey} already created for "${testName}" in this run`);
    const comment = BugReportBuilder.generateComment(error, currentFailCount);
    await jiraService.addComment(existingBugKey, comment);
    return existingBugKey;
  }
  
  const existingBug = await jiraService.findExistingBug(testName, environment);
  if (existingBug) {
    console.log(`Open bug ${existingBug.key} already exists for "${testName}"`);
    const comment = BugReportBuilder.generateComment(error, currentFailCount);
    await jiraService.addComment(existingBug.key, comment);
    createdBugs.set(testName, existingBug.key);
    return existingBug.key;
  }
  
  const screenshotPaths = await ScreenshotHelper.takeMultipleScreenshots(page, testName);
  const bugReport = BugReportBuilder.generateBugReport(testInfo, error, {
    customLabels: ['auto-reported', `failure-count-${currentFailCount}`]
  });
  
  let bug = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`Creating Jira bug (Attempt ${attempt}/3)...`);
      bug = await jiraService.createBug(bugReport);
      break;
    } catch (err) {
      console.error(`Attempt ${attempt} failed:`, err.message);
      if (attempt === 3) throw err;
      await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
    }
  }
  
  if (bug && screenshotPaths.length > 0) {
    for (const screenshotPath of screenshotPaths) {
      await jiraService.attachScreenshot(bug.key, screenshotPath);
    }
  }
  
  createdBugs.set(testName, bug?.key);
  console.log(`Successfully created Jira bug ${bug?.key} for failed test: ${testName}`);
  return bug?.key;
}

// CORRECTED FIXTURE SYNTAX
export const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    console.log(`Test starting: ${testInfo.title}`);
    
    // Use the page as normal
    await use(page);
    
    // After the test completes, check if it failed
    // This is the key - we need to check after the test runs
    if (testInfo.status !== 'passed') {
      console.log(`TEST FAILURE DETECTED (after test): ${testInfo.title}`);
      console.log(`Status: ${testInfo.status}`);
      console.log(`Error: ${testInfo.error?.message}`);
      
      const shouldCreateBug = process.env.CREATE_JIRA_BUG !== 'false';
      const isFinalRetry = testInfo.retry === (testInfo.project?.retries || 0);
      
      if (shouldCreateBug && isFinalRetry && testInfo.error) {
        try {
          // Create a mock page if needed, or use the actual page
          await createJiraBugOnFailure(testInfo, page, testInfo.error);
        } catch (jiraError) {
          console.error('Failed to create Jira bug:', jiraError.message);
        }
      }
    }
  }
});

export { expect } from '@playwright/test';
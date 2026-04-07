/**
 * Bug Report Builder - Creates formatted bug reports for Jira
 * Updated to use Atlassian Document Format (ADF)
 */
class BugReportBuilder {
  static generateBugReport(testInfo, error, metadata = {}) {
    const testName = testInfo.title;
    const environment = process.env.TEST_ENVIRONMENT || 'staging';
    const timestamp = new Date().toISOString();
    
    const bugSummary = `[AUTOMATED] Test Failed: ${testName}`;
    
    // Return as plain text - jira-service will convert to ADF
    const bugDescription = `
h2. Test Failure Details

*Test Name:* ${testName}
*Environment:* ${environment}
*Failure Time:* ${timestamp}
*Browser:* ${testInfo.project?.name || 'chromium'}
*Run URL:* ${process.env.CI_RUN_URL || 'Local execution'}
*Retry Count:* ${testInfo.retry}
*Git Branch:* ${process.env.GIT_BRANCH || 'unknown'}
*Commit Hash:* ${process.env.GIT_COMMIT_HASH || 'unknown'}

h2. Error Message

{code:javascript}
${error.message}
{code}

h2. Stack Trace

{code:javascript}
${error.stack || 'No stack trace available'}
{code}

h2. Reproduction Steps

1. Run the test:
   npx playwright test ${testInfo.file} --grep "${testName}"

2. Expected behavior: Test should pass
3. Actual behavior: Test failed with error above

h2. Additional Context

*Test File:* ${testInfo.file}
*Test Line:* ${error.line || 'N/A'}
*Project:* ${testInfo.project?.name || 'default'}

h2. Suggested Actions

- [ ] Investigate the root cause of the failure
- [ ] Update test if the behavior has changed
- [ ] Fix the application code if this is a legitimate bug
- [ ] Update test data if needed
- [ ] Re-run the test after fixes

---
*This bug was automatically created by Playwright automation on ${timestamp}*
    `;
    
    return {
      summary: bugSummary,
      description: bugDescription,
      priority: this.determinePriority(error, testInfo),
      labels: this.generateLabels(testInfo, environment, metadata)
    };
  }
  
  static determinePriority(error, testInfo) {
    // High priority for critical functionality
    if (testInfo.title.toLowerCase().includes('login') ||
        testInfo.title.toLowerCase().includes('payment') ||
        testInfo.title.toLowerCase().includes('checkout')) {
      return 'Highest';
    }
    
    // Medium priority for normal failures
    if (error.message?.includes('timeout') || 
        error.message?.includes('not found')) {
      return 'Medium';
    }
    
    // Low priority for minor issues
    return 'Low';
  }
  
  static generateLabels(testInfo, environment, metadata) {
    const labels = [
      'playwright-automation',
      'auto-generated',
      'test-failure',
      environment,
      testInfo.project?.name || 'unknown-browser'
    ];
    
    // Add custom labels from metadata
    if (metadata.customLabels) {
      labels.push(...metadata.customLabels);
    }
    
    // Add feature label based on test name
    const testWords = testInfo.title.toLowerCase().split(' ');
    const features = ['api', 'ui', 'database', 'auth', 'payment', 'reporting'];
    const foundFeature = features.find(f => testWords.includes(f));
    if (foundFeature) {
      labels.push(`feature-${foundFeature}`);
    }
    
    return [...new Set(labels)];
  }
  
  static generateComment(error, runCount = 1) {
    const timestamp = new Date().toISOString();
    
    return `
h2. Test Failed Again (Failure #${runCount})

*Time:* ${timestamp}
*Error:* ${error.message}

{code:javascript}
${error.stack?.substring(0, 500)}...
{code}

*Run URL:* ${process.env.CI_RUN_URL || 'Local execution'}

---
This is an automated comment from the Playwright test suite.
    `;
  }
}

export default BugReportBuilder;
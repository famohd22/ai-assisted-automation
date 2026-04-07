#!/usr/bin/env node

import { exec } from 'child_process';
import { promisify } from 'util';
import jiraService from './utils/jira-service.js';
import fs from 'fs/promises';
import path from 'path';
import 'dotenv/config';

const execAsync = promisify(exec);

async function runTestsWithSummary() {
  console.log('🚀 Starting Playwright test run with Jira summary report...\n');
  const startTime = Date.now();
  
  try {
    // Run the tests
    console.log('Running tests...');
    const { stdout, stderr } = await execAsync('npx playwright test --reporter=json', {
      env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: 'results.json' }
    });
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    // Read the results
    const resultsPath = path.join(process.cwd(), 'test-results', 'results.json');
    let results;
    
    try {
      const data = await fs.readFile(resultsPath, 'utf8');
      results = JSON.parse(data);
    } catch (err) {
      console.error('Failed to read test results:', err.message);
      console.log('Test run completed but results file not found');
      return;
    }
    
    // Parse results
    const stats = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      flaky: 0
    };
    
    const failures = [];
    
    if (results.suites) {
      for (const suite of results.suites) {
        for (const spec of suite.specs) {
          for (const test of spec.tests) {
            stats.total++;
            
            if (test.status === 'passed') {
              stats.passed++;
            } else if (test.status === 'failed') {
              stats.failed++;
              failures.push({
                title: spec.title,
                file: spec.file,
                error: test.errors?.[0]?.message || 'Unknown error',
                duration: test.duration,
                retries: test.retries
              });
            } else if (test.status === 'skipped') {
              stats.skipped++;
            } else if (test.status === 'flaky') {
              stats.flaky++;
            }
          }
        }
      }
    }
    
    // Print summary
    console.log('\n' + '='.repeat(50));
    console.log('TEST RUN SUMMARY');
    console.log('='.repeat(50));
    console.log(`Duration: ${duration} seconds`);
    console.log(`Total tests: ${stats.total}`);
    console.log(`Passed: ${stats.passed}`);
    console.log(`Failed: ${stats.failed}`);
    console.log(`Skipped: ${stats.skipped}`);
    console.log(`Flaky: ${stats.flaky}`);
    console.log('='.repeat(50));
    
    if (failures.length > 0) {
      console.log('\n Failed Tests:');
      failures.forEach((failure, index) => {
        console.log(`\n${index + 1}. ${failure.title}`);
        console.log(`   File: ${failure.file}`);
        console.log(`   Error: ${failure.error.substring(0, 150)}...`);
      });
      
      // Create Jira summary bug if there are failures
      if (process.env.CREATE_JIRA_BUG !== 'false') {
        console.log('\n Creating Jira summary bug...');
        
        const summary = `[TEST SUMMARY] ${stats.failed} test failures on ${new Date().toISOString()}`;
        
        const description = `
h2. Test Run Summary

*Date:* ${new Date().toISOString()}
*Duration:* ${duration} seconds
*Environment:* ${process.env.TEST_ENVIRONMENT || 'staging'}
*Total Tests:* ${stats.total}
*Passed:* ${stats.passed}
*Failed:* ${stats.failed}
*Skipped:* ${stats.skipped}
*Flaky:* ${stats.flaky}

h2. Failed Tests (${stats.failed})

${failures.map((failure, index) => `
${index + 1}. *${failure.title}*
   - File: ${failure.file}
   - Error: ${failure.error.substring(0, 200)}
   - Duration: ${failure.duration}ms
   - Retries: ${failure.retries}
`).join('\n')}

h2. Run Details

*Run URL:* ${process.env.CI_RUN_URL || 'Local execution'}
*Git Branch:* ${process.env.GIT_BRANCH || 'unknown'}
*Commit:* ${process.env.GIT_COMMIT_HASH || 'unknown'}

---
*This summary bug was automatically created by Playwright automation*
        `;
        
        try {
          const bug = await jiraService.createBug({
            summary,
            description,
            priority: stats.failed > 5 ? 'High' : 'Medium',
            labels: ['test-summary', 'batch-report', 'auto-generated']
          });
          
          if (bug) {
            console.log(`Summary bug created: ${bug.key}`);
            console.log(`   URL: ${process.env.JIRA_BASE_URL}/browse/${bug.key}`);
          }
        } catch (error) {
          console.error('Failed to create summary bug:', error.message);
        }
      }
    }
    
    // Exit with error code if tests failed
    if (stats.failed > 0) {
      console.log(`\n ${stats.failed} test(s) failed. Exiting with error code 1.`);
      process.exit(1);
    } else {
      console.log('\n All tests passed!');
      process.exit(0);
    }
    
  } catch (error) {
    console.error(' Test execution failed:', error.message);
    process.exit(1);
  }
}

// Run the function
runTestsWithSummary();
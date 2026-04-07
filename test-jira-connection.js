import jiraService from './utils/jira-service.js';
import 'dotenv/config';

async function testConnection() {
  console.log('Testing Jira connection...');
  console.log(`URL: ${process.env.JIRA_BASE_URL}`);
  console.log(`Project: ${process.env.JIRA_PROJECT_KEY}`);
  
  try {
    // Try to create a test issue
    const testBug = await jiraService.createBug({
      summary: '[TEST] Connection Test - Please Ignore',
      description: 'This is a test to verify Jira integration is working correctly.',
      priority: 'Low',
      labels: ['test-connection', 'ignore']
    });
    
    if (testBug) {
      console.log(`Success! Test bug created: ${testBug.key}`);
      console.log(`   View it at: ${process.env.JIRA_BASE_URL}/browse/${testBug.key}`);
      console.log('\n Please delete this test bug from Jira manually.');
    }
  } catch (error) {
    console.error(' Connection failed:', error.message);
    console.log('\nTroubleshooting tips:');
    console.log('1. Check your JIRA_BASE_URL is correct');
    console.log('2. Verify your email and API token');
    console.log('3. Ensure JIRA_PROJECT_KEY is valid');
    console.log('4. Check JIRA_ISSUE_TYPE_ID is correct (try 10000, 10001, or 10004)');
  }
}

testConnection();
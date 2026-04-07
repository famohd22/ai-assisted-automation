import axios from 'axios';
import 'dotenv/config';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

class JiraService {
  constructor() {
    this.validateConfig();
    
    this.baseURL = process.env.JIRA_BASE_URL;
    this.auth = {
      username: process.env.JIRA_EMAIL,
      password: process.env.JIRA_API_TOKEN
    };
    this.projectKey = process.env.JIRA_PROJECT_KEY;
    this.issueTypeId = process.env.JIRA_ISSUE_TYPE_ID;
    this.createBugEnabled = process.env.CREATE_JIRA_BUG !== 'false';
  }

  validateConfig() {
    const required = ['JIRA_BASE_URL', 'JIRA_EMAIL', 'JIRA_API_TOKEN', 'JIRA_PROJECT_KEY', 'JIRA_ISSUE_TYPE_ID'];
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      console.warn(`Missing Jira configuration: ${missing.join(', ')}`);
      this.createBugEnabled = false;
    }
  }

  getAuthHeader() {
    const credentials = `${this.auth.username}:${this.auth.password}`;
    const encoded = Buffer.from(credentials).toString('base64');
    return `Basic ${encoded}`;
  }

  async createBug(issueDetails) {
    if (!this.createBugEnabled) return null;
    
    // Use API v2 for creating issues
    const url = `${this.baseURL}/rest/api/2/issue`;
    
    const payload = {
      fields: {
        project: {
          key: this.projectKey
        },
        summary: issueDetails.summary,
        description: issueDetails.description,
        issuetype: {
          id: this.issueTypeId
        },
        priority: {
          name: issueDetails.priority || 'Medium'
        },
        labels: issueDetails.labels || ['playwright-automation', 'auto-generated']
      }
    };

      /* Add Epic Link if provided (using field ID 10000)
    const epicKey = issueDetails.epicKey || process.env.JIRA_DEFAULT_EPIC_KEY;
    if (epicKey) {
      payload.fields['10000'] = epicKey;  // ← Use 10000 here
      console.log(`Linking bug to Epic: ${epicKey}`);
    }*/

    try {
      const response = await axios.post(url, payload, {
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`Jira bug created: ${response.data.key}`);
      return response.data;
    } catch (error) {
      console.error('Failed to create Jira bug:', error.response?.data || error.message);
      throw error;
    }
  }

  async addComment(issueKey, comment) {
    if (!this.createBugEnabled) return null;
    
    // Use API v2 for comments
    const url = `${this.baseURL}/rest/api/2/issue/${issueKey}/comment`;
    
    try {
      const response = await axios.post(url, {
        body: comment
      }, {
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`Comment added to ${issueKey}`);
      return response.data;
    } catch (error) {
      console.error(`Failed to add comment to ${issueKey}:`, error.message);
      return null;
    }
  }

  async attachScreenshot(issueKey, screenshotPath, screenshotName = null) {
    if (!this.createBugEnabled) return null;
    
    if (!screenshotPath || !fs.existsSync(screenshotPath)) {
      console.log('Screenshot file not found, skipping attachment');
      return null;
    }

    // Use API v2 for attachments
    const url = `${this.baseURL}/rest/api/2/issue/${issueKey}/attachments`;
    
    const formData = new FormData();
    formData.append('file', fs.createReadStream(screenshotPath), 
      screenshotName || path.basename(screenshotPath));
    
    try {
      const response = await axios.post(url, formData, {
        headers: {
          'Authorization': this.getAuthHeader(),
          'X-Atlassian-Token': 'no-check',
          ...formData.getHeaders()
        }
      });
      
      console.log(`Screenshot attached to ${issueKey}`);
      return response.data;
    } catch (error) {
      console.error(`Failed to attach screenshot to ${issueKey}:`, error.message);
      return null;
    }
  }

  async findExistingBug(testName, environment) {
    if (!this.createBugEnabled) return null;
    
    // Use API v2 for searching (changed from /3/ to /2/)
    const jql = `project = ${this.projectKey} AND summary ~ "${this.escapeJql(testName)}" AND labels = auto-generated AND status not in (Closed, Resolved, Done)`;
    const url = `${this.baseURL}/rest/api/2/search?jql=${encodeURIComponent(jql)}&maxResults=1`;
    
    try {
      const response = await axios.get(url, {
        headers: {
          'Authorization': this.getAuthHeader(),
          'Accept': 'application/json'
        }
      });
      
      return response.data.issues.length > 0 ? response.data.issues[0] : null;
    } catch (error) {
      // Don't log the error if it's just a missing endpoint - it's not critical
      if (error.response?.status !== 410) {
        console.error('Failed to search for existing bug:', error.message);
      }
      return null;
    }
  }

  escapeJql(str) {
    return str.replace(/["\\]/g, '\\$&');
  }
}

export default new JiraService();
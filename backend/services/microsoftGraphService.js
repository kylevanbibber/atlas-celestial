const { ConfidentialClientApplication } = require('@azure/msal-node');
const { Client } = require('@microsoft/microsoft-graph-client');
require('isomorphic-fetch');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

// === Microsoft Graph App Registration ===
const CLIENT_ID = 'd04bf33d-824c-46f5-b75d-d25eb50f7be6';
const CLIENT_SECRET = 'pT28Q~eSMlzWrKevwdHn5GXnsCei7YqBDlrHyaj3';
const TENANT_ID = '56c93141-522f-4eb8-9abc-006b4b8033ce';
const SCOPES = ['https://graph.microsoft.com/.default']; // Use .default for client credentials
const ONEDRIVE_UPLOAD_FOLDER = 'Reports/VIPs';

// === Email & File Filters ===
const OUTLOOK_FOLDER = "Inbox";
const KEYWORDS = ["ARIAS ORGANIZATION: Wkly, MTD, and YTD Production By Levels through"];
const ALLOWED_EXTENSIONS = ['.xlsx', '.xls', '.csv'];
const EXCLUDED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'];
const CREATED_BY = 19263;
const UPDATED_BY = 19263;

// === Authenticate with Microsoft Graph (Client Credentials) ===
async function getGraphToken() {
    const msalConfig = {
        auth: {
            clientId: CLIENT_ID,
            clientSecret: CLIENT_SECRET,
            authority: `https://login.microsoftonline.com/${TENANT_ID}`
        }
    };

    const msalInstance = new ConfidentialClientApplication(msalConfig);
    
    try {
        const clientCredentialRequest = {
            scopes: SCOPES
        };

        const response = await msalInstance.acquireTokenByClientCredential(clientCredentialRequest);
        
        if (response.accessToken) {
            logger.info('[MicrosoftGraph] Successfully acquired access token via client credentials');
            return response.accessToken;
        } else {
            throw new Error('Could not acquire token');
        }
    } catch (error) {
        logger.error('[MicrosoftGraph] Error acquiring token:', error);
        throw error;
    }
}

// === Create Graph Client ===
function createGraphClient(accessToken) {
    return Client.init({
        authProvider: (done) => {
            done(null, accessToken);
        }
    });
}

// === Upload File to OneDrive ===
async function uploadToOneDrive(filePath, accessToken) {
    try {
        const graphClient = createGraphClient(accessToken);
        const fileName = path.basename(filePath);
        const uploadPath = `${ONEDRIVE_UPLOAD_FOLDER}/${fileName}`;
        
        const fileStream = fs.createReadStream(filePath);
        const uploadSession = await graphClient
            .api('/me/drive/root:/' + uploadPath + ':/content')
            .put(fileStream);
        
        logger.info(`[MicrosoftGraph] Uploaded file: ${fileName}`);
        return uploadSession.id;
    } catch (error) {
        logger.error('[MicrosoftGraph] Error uploading to OneDrive:', error);
        throw error;
    }
}

// === Create Share Link ===
async function getOneDriveShareLink(fileId, accessToken) {
    try {
        const graphClient = createGraphClient(accessToken);
        
        const shareLink = await graphClient
            .api(`/me/drive/items/${fileId}/createLink`)
            .post({
                type: "view",
                scope: "anonymous"
            });
        
        logger.info(`[MicrosoftGraph] Created share link for file: ${fileId}`);
        return shareLink.link.webUrl;
    } catch (error) {
        logger.error('[MicrosoftGraph] Error creating share link:', error);
        throw error;
    }
}

// === Process Outlook Emails (Simplified for Client Credentials) ===
async function processEmails(accessToken) {
  try {
    // For client credentials, we can't access user emails directly
    // Instead, we'll focus on OneDrive operations and return empty array
    // You can implement email processing through other means (webhooks, etc.)
    logger.info('[MicrosoftGraph] Client credentials mode - email processing not available');
    return [];
  } catch (error) {
    logger.error('[MicrosoftGraph] Error processing emails:', error);
    throw error;
  }
}

// === Main function to get reports ===
async function getReportsFromOutlook() {
    try {
        const accessToken = await getGraphToken();
        const reports = await processEmails(accessToken);
        logger.info(`[MicrosoftGraph] Retrieved ${reports.length} reports from Outlook`);
        return reports;
    } catch (error) {
        logger.error('[MicrosoftGraph] Error getting reports:', error);
        throw error;
    }
}

module.exports = {
    getGraphToken,
    createGraphClient,
    uploadToOneDrive,
    getOneDriveShareLink,
    processEmails,
    getReportsFromOutlook
}; 
// testMicrosoftGraph.js
const { getGraphToken, createGraphClient } = require('../services/microsoftGraphService');
const logger = require('../utils/logger');

(async () => {
  try {
    logger.info('[TestMicrosoftGraph] Testing Microsoft Graph authentication...');
    
    // Test getting access token
    const accessToken = await getGraphToken();
    logger.info('[TestMicrosoftGraph] Successfully acquired access token');
    
    // Test creating Graph client
    const graphClient = createGraphClient(accessToken);
    logger.info('[TestMicrosoftGraph] Successfully created Graph client');
    
    // Test a simple API call (get user info)
    try {
      const user = await graphClient.api('/me').get();
      logger.info(`[TestMicrosoftGraph] Successfully got user info: ${user.displayName}`);
    } catch (error) {
      logger.warn('[TestMicrosoftGraph] Could not get user info (expected with client credentials):', error.message);
    }
    
    logger.info('[TestMicrosoftGraph] Test completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('[TestMicrosoftGraph] Test failed:', error);
    process.exit(1);
  }
})(); 
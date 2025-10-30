const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

class EmailService {
  constructor() {
    this.transporter = null;
    this.isConfigured = false;
    this.initializeTransporter();
  }

  initializeTransporter() {
    try {
      // Use existing Arias Life email configuration as defaults
      const smtpConfig = {
        host: process.env.SMTP_HOST || 'mail.ariaslife.com',
        port: parseInt(process.env.SMTP_PORT || '465'),
        secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_SECURE === undefined ? true : false, // true for 465
        auth: {
          user: process.env.SMTP_USER || 'noreply@ariaslife.com',
          pass: process.env.SMTP_PASSWORD || 'Ariaslife123!'
        },
        tls: {
          rejectUnauthorized: false
        }
      };

      this.transporter = nodemailer.createTransport(smtpConfig);

      this.isConfigured = true;
      logger.info('Email service initialized successfully with:', {
        host: smtpConfig.host,
        port: smtpConfig.port,
        user: smtpConfig.auth.user
      });
    } catch (error) {
      logger.error('Failed to initialize email service:', error);
      this.isConfigured = false;
    }
  }

  /**
   * Test the email connection
   * @returns {Promise<boolean>} Connection status
   */
  async testConnection() {
    if (!this.isConfigured || !this.transporter) {
      return { success: false, message: 'Email service not configured' };
    }

    try {
      await this.transporter.verify();
      return { success: true, message: 'Email connection verified successfully' };
    } catch (error) {
      logger.error('Email connection test failed:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Replace variables in template with actual user data
   * @param {string} template - Template string with {{variable}} placeholders
   * @param {object} userData - User data object
   * @returns {string} Template with variables replaced
   */
  replaceVariables(template, userData) {
    if (!template || !userData) return template;

    let result = template;
    
    // Find all {{variable}} patterns
    const variablePattern = /\{\{(\w+)\}\}/g;
    
    result = result.replace(variablePattern, (match, variableName) => {
      // Check if the variable exists in userData
      if (userData.hasOwnProperty(variableName)) {
        const value = userData[variableName];
        // Return empty string for null/undefined values
        return value !== null && value !== undefined ? String(value) : '';
      }
      // Return the original placeholder if variable not found
      return match;
    });

    return result;
  }

  /**
   * Send an email
   * @param {string|string[]} to - Recipient email address(es)
   * @param {string} subject - Email subject
   * @param {string} body - Email body (can include HTML)
   * @param {object} options - Additional options (from, replyTo, etc.)
   * @returns {Promise<object>} Send result
   */
  async sendEmail(to, subject, body, options = {}) {
    if (!this.isConfigured || !this.transporter) {
      throw new Error('Email service not configured');
    }

    try {
      const mailOptions = {
        from: options.from || `"${process.env.SMTP_FROM_NAME || 'Arias Life'}" <${process.env.SMTP_FROM_EMAIL || 'noreply@ariaslife.com'}>`,
        to: Array.isArray(to) ? to.join(', ') : to,
        subject: subject,
        html: body,
        text: body.replace(/<[^>]*>/g, ''), // Strip HTML for text version
        ...options
      };

      const info = await this.transporter.sendMail(mailOptions);
      
      logger.info(`Email sent successfully to ${to}`, { messageId: info.messageId });
      
      return {
        success: true,
        messageId: info.messageId,
        response: info.response
      };
    } catch (error) {
      logger.error('Failed to send email:', error);
      throw error;
    }
  }

  /**
   * Send email with variable replacement
   * @param {string|string[]} to - Recipient email address(es)
   * @param {string} subject - Email subject template
   * @param {string} body - Email body template
   * @param {object} userData - User data for variable replacement
   * @param {object} options - Additional options
   * @returns {Promise<object>} Send result
   */
  async sendTemplateEmail(to, subject, body, userData, options = {}) {
    const processedSubject = this.replaceVariables(subject, userData);
    const processedBody = this.replaceVariables(body, userData);
    
    return this.sendEmail(to, processedSubject, processedBody, options);
  }

  /**
   * Send emails in batch
   * @param {Array} recipients - Array of {email, userData} objects
   * @param {string} subject - Email subject template
   * @param {string} body - Email body template
   * @param {object} options - Additional options
   * @returns {Promise<Array>} Array of send results
   */
  async sendBatchEmails(recipients, subject, body, options = {}) {
    const results = [];
    
    for (const recipient of recipients) {
      try {
        const result = await this.sendTemplateEmail(
          recipient.email,
          subject,
          body,
          recipient.userData || {},
          options
        );
        
        results.push({
          email: recipient.email,
          success: true,
          messageId: result.messageId
        });
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        results.push({
          email: recipient.email,
          success: false,
          error: error.message
        });
      }
    }
    
    return results;
  }
}

// Export singleton instance
module.exports = new EmailService();



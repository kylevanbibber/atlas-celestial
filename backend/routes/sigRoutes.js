const cors = require('cors');
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const axios = require('axios');
const multer = require('multer');
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();
const router = express.Router();

// Multer setup for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// CORS options
const corsOptions = {
  origin: '*', // Allow all origins
  methods: ['GET', 'POST', 'PUT', 'DELETE'], // Allowed HTTP methods
  allowedHeaders: ['Content-Type', 'Authorization'], // Allowed headers
};

// Apply CORS globally for this router
router.use(cors(corsOptions));

// Handle signed document submission
router.post('/sign', upload.single('file'), async (req, res) => {


  const { token, clientEmail, agentEmail, documentType } = req.body;
  const file = req.file;
  
  if (!file || !token) {
    return res.status(400).json({ 
      success: false, 
      message: 'Missing signed file or token' 
    });
  }

  try {
    // Decode and validate token
    let tokenData;
    try {
      // Add padding if needed for base64 decoding
      let decodedToken = token.replace(/-/g, '+').replace(/_/g, '/');
      while (decodedToken.length % 4) {
        decodedToken += '=';
      }
      
      const json = Buffer.from(decodedToken, 'base64').toString();
      tokenData = JSON.parse(json);
      
      // Validate required fields based on document type
      if (documentType === 'agent') {
        if (!tokenData.agentName || !tokenData.agentID) {
          throw new Error('Invalid token data - missing required agent fields');
        }
      } else {
        // Default to client document validation
        if (!tokenData.clientName || !tokenData.agentName) {
          throw new Error('Invalid token data - missing required client fields');
        }
      }
    } catch (error) {
      console.error('Token validation error:', error);
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }

    // Create signed documents directory if it doesn't exist
    const documentsDir = path.join(__dirname, '../uploads/signed-documents');
    if (!fs.existsSync(documentsDir)) {
      fs.mkdirSync(documentsDir, { recursive: true });
    }

    // Generate unique filename based on document type
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    let filename;
    if (documentType === 'agent') {
      const agentIdentifier = `${tokenData.agentName || 'Agent'}_${tokenData.agentID || 'NoID'}`.replace(/[^a-zA-Z0-9]/g, '_');
      filename = `signed-agent-document-${agentIdentifier}-${timestamp}.pdf`;
    } else {
      const clientIdentifier = tokenData.clientName ? tokenData.clientName.replace(/[^a-zA-Z0-9]/g, '_') : 'Client';
      filename = `signed-document-${clientIdentifier}-${timestamp}.pdf`;
    }
    const filepath = path.join(documentsDir, filename);

    // Save the signed document
    fs.writeFileSync(filepath, file.buffer);

    // Configure email transporter (fixed method name)
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'mail.ariaslife.com',
      port: parseInt(process.env.SMTP_PORT, 10) || 465,
      secure: true,
      auth: { 
        user: process.env.SMTP_USER || 'noreply@ariaslife.com', 
        pass: process.env.SMTP_PASS || 'Ariaslife123!' 
      },
      tls: { rejectUnauthorized: false }
    });

    // Prepare email content based on document type
    let emailSubject, emailBody;
    if (documentType === 'agent') {
      emailSubject = `Signed Agent Documentation - ${tokenData.agentName}`;
      emailBody = `
        <h3>New Signed Agent Documentation</h3>
        <p><strong>Agent Name:</strong> ${tokenData.agentName}</p>
        <p><strong>Phone:</strong> ${tokenData.phoneNumber || 'N/A'}</p>
        <p><strong>Email:</strong> ${tokenData.email || 'N/A'}</p>
        <p><strong>Signed:</strong> ${new Date().toLocaleString()}</p>
        <p>Please find the signed agent documentation attached.</p>
      `;
    } else {
      emailSubject = `Signed AD&D Gift Certificate - ${tokenData.clientName}`;
      emailBody = `
        <h3>New Signed AD&D Gift Certificate</h3>
        <p><strong>Client:</strong> ${tokenData.clientName}</p>
        <p><strong>Agent:</strong> ${tokenData.agentName}</p>
        <p><strong>Date of Birth:</strong> ${tokenData.dateOfBirth}</p>
        <p><strong>Address:</strong> ${tokenData.address}, ${tokenData.city}, ${tokenData.state} ${tokenData.zip}</p>
        <p><strong>Phone:</strong> ${tokenData.phoneNumber}</p>
        <p><strong>Beneficiary:</strong> ${tokenData.beneficiary}</p>
        <p><strong>Relationship:</strong> ${tokenData.relationshipToInsured}</p>
        <p><strong>Signed:</strong> ${new Date().toLocaleString()}</p>
        <p>Please find the signed document attached.</p>
      `;
    }

    // Prepare recipients based on document type
    let recipients = [];
    
    if (documentType === 'agent') {
      // For agent documents, send to specific email
      recipients.push('esign@ariasagencies.com');
      
      // Also add supervisor email and agent email
      if (tokenData.supervisorEmail) recipients.push(tokenData.supervisorEmail);
      if (tokenData.email) recipients.push(tokenData.email);
      if (agentEmail && agentEmail.trim()) recipients.push(agentEmail.trim());
    } else {
      // For client documents, use default recipient
      recipients.push(process.env.SIGNING_RECEIVER || 'IGCERTS@Globe.Life');
      
      // Add agent email and client email
      if (tokenData.agentEmail) recipients.push(tokenData.agentEmail);
      if (clientEmail && clientEmail.trim()) recipients.push(clientEmail.trim());
    }


    // Send email with attachment
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'noreply@ariaslife.com',
      to: recipients.join(','),
      subject: emailSubject,
      html: emailBody,
      attachments: [{
        filename: filename,
        content: file.buffer,
        contentType: 'application/pdf'
      }]
    });

    
    res.json({
      success: true,
      message: 'Document signed and sent successfully'
    });

  } catch (error) {
    console.error('Error processing signed document:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process signed document'
    });
  }
});

module.exports = router; 
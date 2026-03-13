const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const db = require('../db');
const { verifyToken } = require('../middleware/authMiddleware');
const ftp = require('basic-ftp');
const SftpClient = require('ssh2-sftp-client');

// Transport selector
// Default to FTP for this environment; can be overridden via env
const USE_SFTP = String(process.env.USE_SFTP || 'false').toLowerCase() === 'true';

// FTP configuration (prefer env vars, fall back to AriasLife defaults)
// svk.2cc.mytemp.website FTP configuration
const FTP_HOST = process.env.FTP_HOST || 'ftp.svk.2cc.mytemp.website';
const FTP_USER = process.env.FTP_USER || 'atlas@svk.2cc.mytemp.website';
const FTP_PASS = process.env.FTP_PASS || 'Atlas2025!';
// Remote directory (relative to FTP home) and public URL prefix
const FTP_REMOTE_DIR = process.env.FTP_REMOTE_DIR || 'public_html/svk.2cc.mytemp.website/atlas';
const PUBLIC_URL_PREFIX = process.env.PUBLIC_URL_PREFIX || 'https://svk.2cc.mytemp.website/atlas/public_html/svk.2cc.mytemp.website/atlas/';

// SFTP configuration (prefer env vars)
const SFTP_HOST = process.env.SFTP_HOST || FTP_HOST; // reuse pinned host if not provided
const SFTP_PORT = parseInt(process.env.SFTP_PORT || '22', 10);
const SFTP_USER = process.env.SFTP_USER || FTP_USER; // must be a valid SSH user on the server
const SFTP_PASSWORD = process.env.SFTP_PASSWORD || ''; // optional if using key
const SFTP_PRIVATE_KEY_B64 = process.env.SFTP_PRIVATE_KEY || ''; // base64 of private key (optional)
const SFTP_PASSPHRASE = process.env.SFTP_PASSPHRASE || '';
const SFTP_REMOTE_DIR = process.env.SFTP_REMOTE_DIR || `/home/arias/public_html/${FTP_REMOTE_DIR}`; // fallback guess; override in env

// Configure multer for memory storage (like your other routes)
const storage = multer.memoryStorage();

// File filter - accept common document types
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/heic',
    'image/heif',
    'image/svg+xml',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Allowed: PDF, Word, Excel, Images, Text'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Allow onboarding access via header X-Onboarding-Pipeline-Id
function getOnboardingPipelineId(req) {
  const val = req.headers['x-onboarding-pipeline-id'] || req.headers['X-Onboarding-Pipeline-Id'];
  const n = parseInt(val, 10);
  return Number.isFinite(n) ? n : null;
}

function optionalOnboardingAuth(req, res, next) {
  const onboardingId = getOnboardingPipelineId(req);
  if (onboardingId) {
    req.onboardingPipelineId = onboardingId;
    return next();
  }
  return verifyToken(req, res, next);
}

// Helper function to upload file to FTP
async function uploadFileToFTP(file) {
  const client = new ftp.Client();
  client.ftp.verbose = true;
  // Force IPv4 passive mode to avoid IPv6/NAT PASV issues
  try {
    client.prepareTransfer = ftp.enterPassiveModeIPv4;
  } catch (e) {
    // basic-ftp versions without named export fallback silently
  }
  // Increase timeouts a bit for large files / slow networks
  client.ftp.timeout = 30000;

  // Generate unique filename
  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
  const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
  const filename = `${uniqueSuffix}-${sanitizedName}`;
  
  const tempFilePath = path.join(__dirname, `../temp/${filename}`);

  try {
    // Write buffer to temporary file
    await fs.outputFile(tempFilePath, file.buffer);

    const attemptUpload = async () => {
      // Connect to FTP
      await client.access({
        host: FTP_HOST,
        user: FTP_USER,
        password: FTP_PASS,
        secure: false,
        port: 21
      });

      // Ensure target directory exists (relative to home)
      await client.ensureDir(`/${FTP_REMOTE_DIR}`);

      // Upload file into current directory (ensureDir has already changed CWD)
      await client.uploadFrom(tempFilePath, filename);
    };

    // Retry strategy for unreliable PASV data connections
    const MAX_ATTEMPTS = 3;
    let lastErr = null;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        await attemptUpload();
        lastErr = null;
        break;
      } catch (err) {
        lastErr = err;
        console.warn(`[FTP] Upload attempt ${attempt} failed:`, err?.message || err);
        try { client.close(); } catch (_e) {}
        // brief backoff
        await new Promise(r => setTimeout(r, 500 * attempt));
      }
    }

    if (lastErr) throw lastErr;

    // Remove temporary file
    await fs.remove(tempFilePath);

    // Return the public URL
    const fileUrl = `${PUBLIC_URL_PREFIX}${filename}`;
    
    return { success: true, filename, fileUrl };
  } catch (error) {
    console.error('Error uploading file to FTP:', error);
    // Clean up temp file if it exists
    try {
      await fs.remove(tempFilePath);
    } catch (e) {}
    return { success: false, error };
  } finally {
    client.close();
  }
}

// Helper function to upload file via SFTP
async function uploadFileToSFTP(file) {
  const sftp = new SftpClient();
  // Generate unique filename
  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
  const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
  const filename = `${uniqueSuffix}-${sanitizedName}`;
  const tempFilePath = path.join(__dirname, `../temp/${filename}`);

  // Build connection config
  const config = {
    host: SFTP_HOST,
    port: SFTP_PORT,
    username: SFTP_USER
  };
  if (SFTP_PRIVATE_KEY_B64) {
    config.privateKey = Buffer.from(SFTP_PRIVATE_KEY_B64, 'base64');
    if (SFTP_PASSPHRASE) config.passphrase = SFTP_PASSPHRASE;
  } else if (SFTP_PASSWORD) {
    config.password = SFTP_PASSWORD;
  }

  try {
    // Write buffer to temporary file
    await fs.outputFile(tempFilePath, file.buffer);

    await sftp.connect(config);

    // Ensure remote directory exists
    try {
      await sftp.mkdir(SFTP_REMOTE_DIR, true);
    } catch (e) {
      // ignore EEXIST-like errors
    }

    const remotePath = `${SFTP_REMOTE_DIR}/${filename}`;
    await sftp.fastPut(tempFilePath, remotePath);

    await fs.remove(tempFilePath);

    const fileUrl = `${PUBLIC_URL_PREFIX}${filename}`;
    return { success: true, filename, fileUrl };
  } catch (error) {
    console.error('Error uploading file via SFTP:', error);
    try { await fs.remove(tempFilePath); } catch (_) {}
    return { success: false, error };
  } finally {
    try { await sftp.end(); } catch (_) {}
  }
}

// Helper function to delete file from FTP
async function deleteFileFromFTP(filename) {
  const client = new ftp.Client();
  client.ftp.verbose = true;

  try {
    // Connect to FTP
    await client.access({
      host: FTP_HOST,
      user: FTP_USER,
      password: FTP_PASS,
      secure: false,
      port: 21
    });

    // Delete the file
    const filePath = `${FTP_REMOTE_DIR}/${filename}`;
    await client.remove(filePath);
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting file from FTP:', error);
    return { success: false, error };
  } finally {
    client.close();
  }
}

// Helper function to delete file via SFTP
async function deleteFileFromSFTP(filename) {
  const sftp = new SftpClient();
  const config = {
    host: SFTP_HOST,
    port: SFTP_PORT,
    username: SFTP_USER
  };
  if (SFTP_PRIVATE_KEY_B64) {
    config.privateKey = Buffer.from(SFTP_PRIVATE_KEY_B64, 'base64');
    if (SFTP_PASSPHRASE) config.passphrase = SFTP_PASSPHRASE;
  } else if (SFTP_PASSWORD) {
    config.password = SFTP_PASSWORD;
  }
  try {
    await sftp.connect(config);
    const remotePath = `${SFTP_REMOTE_DIR}/${filename}`;
    await sftp.delete(remotePath);
    return { success: true };
  } catch (error) {
    console.error('Error deleting file via SFTP:', error);
    return { success: false, error };
  } finally {
    try { await sftp.end(); } catch (_) {}
  }
}

// ============================================================================
// POST /api/pipeline-attachments/upload
// Upload attachment for a checklist item
// ============================================================================
router.post('/upload', optionalOnboardingAuth, upload.single('file'), async (req, res) => {
  console.log('[PIPELINE-ATTACHMENTS] Upload request received');
  console.log('[PIPELINE-ATTACHMENTS] Body:', req.body);
  console.log('[PIPELINE-ATTACHMENTS] File:', req.file ? { name: req.file.originalname, size: req.file.size, type: req.file.mimetype } : 'No file');
  console.log('[PIPELINE-ATTACHMENTS] User:', req.user ? { id: req.user.id, lagnname: req.user.lagnname } : 'No user', 'OnboardingId:', req.onboardingPipelineId || null);
  
  try {
    const { recruit_id, checklist_item_id, description, file_category } = req.body;
    if (req.onboardingPipelineId && parseInt(recruit_id, 10) !== req.onboardingPipelineId) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    // For onboarding uploads, there may be no req.user; store NULL to satisfy FK
    const userId = req.user && req.user.id ? req.user.id : null;
    
    if (!req.file) {
      console.log('[PIPELINE-ATTACHMENTS] Error: No file uploaded');
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    
    if (!recruit_id) {
      console.log('[PIPELINE-ATTACHMENTS] Error: No recruit_id provided');
      return res.status(400).json({ success: false, message: 'Recruit ID is required' });
    }
    
    console.log(`[PIPELINE-ATTACHMENTS] Uploading via ${USE_SFTP ? 'SFTP' : 'FTP'}...`);
    // Upload file to selected transport
    const uploadResult = USE_SFTP ?
      await uploadFileToSFTP(req.file) :
      await uploadFileToFTP(req.file);
    
    if (!uploadResult.success) {
      console.log('[PIPELINE-ATTACHMENTS] FTP upload failed:', uploadResult.error);
      return res.status(500).json({
        success: false,
        message: 'Error uploading file to server',
        error: uploadResult.error.message
      });
    }
    
    console.log('[PIPELINE-ATTACHMENTS] Upload successful:', uploadResult.fileUrl);
    
    // Insert attachment record
    const query = `
      INSERT INTO pipeline_attachments (
        recruit_id, checklist_item_id, file_name, file_path, 
        file_size, file_type, file_category, description, uploaded_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const values = [
      recruit_id,
      checklist_item_id || null,
      req.file.originalname,
      uploadResult.filename, // Store FTP filename
      req.file.size,
      req.file.mimetype,
      file_category || null,
      description || null,
      userId
    ];
    
    console.log('[PIPELINE-ATTACHMENTS] Inserting into database...');
    const result = await db.query(query, values);
    
    // Get the inserted record
    const selectQuery = `
      SELECT 
        a.*,
        u.lagnname as uploaded_by_name
      FROM pipeline_attachments a
      LEFT JOIN activeusers u ON a.uploaded_by = u.id
      WHERE a.id = ?
    `;
    
    const attachment = await db.query(selectQuery, [result.insertId]);
    
    console.log('[PIPELINE-ATTACHMENTS] Success! Attachment ID:', result.insertId);
    
    // Add file URL to response
    const responseData = attachment[0];
    responseData.file_url = uploadResult.fileUrl;
    
    res.json({
      success: true,
      data: responseData,
      message: 'File uploaded successfully'
    });
    
  } catch (error) {
    console.error('[PIPELINE-ATTACHMENTS] Error uploading attachment:', error);
    
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Error uploading file' 
    });
  }
});

// ============================================================================
// GET /api/pipeline-attachments/recruit/:recruitId
// Get all attachments for a recruit
// ============================================================================
router.get('/recruit/:recruitId', optionalOnboardingAuth, async (req, res) => {
  try {
    const { recruitId } = req.params;
    if (req.onboardingPipelineId && parseInt(recruitId, 10) !== req.onboardingPipelineId) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    
    const query = `
      SELECT 
        a.*,
        u.lagnname as uploaded_by_name,
        c.item_name as checklist_item_name
      FROM pipeline_attachments a
      LEFT JOIN activeusers u ON a.uploaded_by = u.id
      LEFT JOIN pipeline_checklist_items c ON a.checklist_item_id = c.id
      WHERE a.recruit_id = ?
      ORDER BY a.uploaded_at DESC
    `;
    
    const attachments = await db.query(query, [recruitId]);
    
    // Add file URLs to each attachment
    const attachmentsWithUrls = attachments.map(att => ({
      ...att,
      file_url: `${PUBLIC_URL_PREFIX}${att.file_path}`
    }));
    
    res.json({
      success: true,
      data: attachmentsWithUrls
    });
    
  } catch (error) {
    console.error('Error fetching attachments:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching attachments' 
    });
  }
});

// ============================================================================
// GET /api/pipeline-attachments/checklist-item/:checklistItemId
// Get all attachments for a specific checklist item
// ============================================================================
router.get('/checklist-item/:checklistItemId', verifyToken, async (req, res) => {
  try {
    const { checklistItemId } = req.params;
    const { recruitId } = req.query;
    
    let query = `
      SELECT 
        a.*,
        u.lagnname as uploaded_by_name
      FROM pipeline_attachments a
      LEFT JOIN activeusers u ON a.uploaded_by = u.id
      WHERE a.checklist_item_id = ?
    `;
    
    const params = [checklistItemId];
    
    if (recruitId) {
      query += ' AND a.recruit_id = ?';
      params.push(recruitId);
    }
    
    query += ' ORDER BY a.uploaded_at DESC';
    
    const attachments = await db.query(query, params);
    
    res.json({
      success: true,
      attachments: attachments
    });
    
  } catch (error) {
    console.error('Error fetching checklist item attachments:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching attachments' 
    });
  }
});

// ============================================================================
// GET /api/pipeline-attachments/download/:attachmentId
// Download/view an attachment (redirects to FTP URL)
// ============================================================================
router.get('/download/:attachmentId', optionalOnboardingAuth, async (req, res) => {
  try {
    const { attachmentId } = req.params;
    
    // Get attachment record
    const query = 'SELECT * FROM pipeline_attachments WHERE id = ?';
    const attachments = await db.query(query, [attachmentId]);
    
    if (!attachments || attachments.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Attachment not found' 
      });
    }
    
    const attachment = attachments[0];
    if (req.onboardingPipelineId && attachment.recruit_id !== req.onboardingPipelineId) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    
    // Construct the public URL
    const fileUrl = `${PUBLIC_URL_PREFIX}${attachment.file_path}`;
    
    // Redirect to the file
    res.redirect(fileUrl);
    
  } catch (error) {
    console.error('Error downloading attachment:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error downloading file' 
    });
  }
});

// ============================================================================
// DELETE /api/pipeline-attachments/:attachmentId
// Delete an attachment
// ============================================================================
router.delete('/:attachmentId', verifyToken, async (req, res) => {
  console.log('[PIPELINE-ATTACHMENTS] Delete request for attachment:', req.params.attachmentId);
  
  try {
    const { attachmentId } = req.params;
    
    // Get attachment record
    const selectQuery = 'SELECT * FROM pipeline_attachments WHERE id = ?';
    const attachments = await db.query(selectQuery, [attachmentId]);
    
    if (!attachments || attachments.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Attachment not found' 
      });
    }
    
    const attachment = attachments[0];
    
    // Delete file from FTP
    console.log(`[PIPELINE-ATTACHMENTS] Deleting file via ${USE_SFTP ? 'SFTP' : 'FTP'}:`, attachment.file_path);
    const deleteResult = USE_SFTP ?
      await deleteFileFromSFTP(attachment.file_path) :
      await deleteFileFromFTP(attachment.file_path);
    
    if (!deleteResult.success) {
      console.warn('[PIPELINE-ATTACHMENTS] FTP deletion failed, continuing with DB deletion:', deleteResult.error);
    } else {
      console.log('[PIPELINE-ATTACHMENTS] File deleted from FTP successfully');
    }
    
    // Delete database record (even if FTP deletion failed)
    const deleteQuery = 'DELETE FROM pipeline_attachments WHERE id = ?';
    await db.query(deleteQuery, [attachmentId]);
    
    console.log('[PIPELINE-ATTACHMENTS] Attachment deleted from database');
    
    res.json({
      success: true,
      message: 'Attachment deleted successfully'
    });
    
  } catch (error) {
    console.error('[PIPELINE-ATTACHMENTS] Error deleting attachment:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error deleting attachment' 
    });
  }
});

// ============================================================================
// PUT /api/pipeline-attachments/:attachmentId
// Update attachment metadata (description, category)
// ============================================================================
router.put('/:attachmentId', verifyToken, async (req, res) => {
  try {
    const { attachmentId } = req.params;
    const { description, fileCategory } = req.body;
    
    const query = `
      UPDATE pipeline_attachments 
      SET description = ?, file_category = ?
      WHERE id = ?
    `;
    
    await db.query(query, [description || null, fileCategory || null, attachmentId]);
    
    // Get updated record
    const selectQuery = `
      SELECT 
        a.*,
        u.lagnname as uploaded_by_name,
        c.item_name as checklist_item_name
      FROM pipeline_attachments a
      LEFT JOIN activeusers u ON a.uploaded_by = u.id
      LEFT JOIN pipeline_checklist_items c ON a.checklist_item_id = c.id
      WHERE a.id = ?
    `;
    
    const attachment = await db.query(selectQuery, [attachmentId]);
    
    res.json({
      success: true,
      attachment: attachment[0],
      message: 'Attachment updated successfully'
    });
    
  } catch (error) {
    console.error('Error updating attachment:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error updating attachment' 
    });
  }
});

module.exports = router;


const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const db = require('../db');
const { verifyToken } = require('../middleware/authMiddleware');
const ftp = require('basic-ftp');

// Configure multer for memory storage (like your other routes)
const storage = multer.memoryStorage();

// File filter - accept common document types
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
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

  // Generate unique filename
  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
  const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
  const filename = `${uniqueSuffix}-${sanitizedName}`;
  
  const tempFilePath = path.join(__dirname, `../temp/${filename}`);

  try {
    // Write buffer to temporary file
    await fs.outputFile(tempFilePath, file.buffer);

    // Connect to FTP
    await client.access({
      host: "ftp.thekeefersuccess.com",
      user: "uploads@ariaslife.com",
      password: "Atlas2024!!",
      secure: false,
      port: 21
    });

    // Ensure pipeline directory exists (relative to FTP home) and change into it
    await client.ensureDir('uploads/pipeline');
    await client.cd('uploads/pipeline');

    // Upload file
    // We are already in /uploads/pipeline; upload by filename only
    await client.uploadFrom(tempFilePath, filename);

    // Remove temporary file
    await fs.remove(tempFilePath);

    // Return the public URL
    const fileUrl = `https://ariaslife.com/uploads/pipeline/${filename}`;
    
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

// Helper function to delete file from FTP
async function deleteFileFromFTP(filename) {
  const client = new ftp.Client();
  client.ftp.verbose = true;

  try {
    // Connect to FTP
    await client.access({
      host: "ftp.thekeefersuccess.com",
      user: "uploads@ariaslife.com",
      password: "Atlas2024!!",
      secure: false,
      port: 21
    });

    // Delete the file
    const filePath = `uploads/pipeline/${filename}`;
    await client.remove(filePath);
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting file from FTP:', error);
    return { success: false, error };
  } finally {
    client.close();
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
  console.log('[PIPELINE-ATTACHMENTS] User:', req.user ? { id: req.user.id, lagnname: req.user.lagnname } : 'No user');
  
  try {
    const { recruit_id, checklist_item_id, description, file_category } = req.body;
    if (req.onboardingPipelineId && parseInt(recruit_id, 10) !== req.onboardingPipelineId) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    const userId = req.user.id;
    
    if (!req.file) {
      console.log('[PIPELINE-ATTACHMENTS] Error: No file uploaded');
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    
    if (!recruit_id) {
      console.log('[PIPELINE-ATTACHMENTS] Error: No recruit_id provided');
      return res.status(400).json({ success: false, message: 'Recruit ID is required' });
    }
    
    console.log('[PIPELINE-ATTACHMENTS] Uploading to FTP...');
    // Upload file to FTP
    const uploadResult = await uploadFileToFTP(req.file);
    
    if (!uploadResult.success) {
      console.log('[PIPELINE-ATTACHMENTS] FTP upload failed:', uploadResult.error);
      return res.status(500).json({
        success: false,
        message: 'Error uploading file to server',
        error: uploadResult.error.message
      });
    }
    
    console.log('[PIPELINE-ATTACHMENTS] FTP upload successful:', uploadResult.fileUrl);
    
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
      file_url: `https://ariaslife.com/uploads/pipeline/${att.file_path}`
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
    
    // Construct the FTP URL
    const fileUrl = `https://ariaslife.com/uploads/pipeline/${attachment.file_path}`;
    
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
    console.log('[PIPELINE-ATTACHMENTS] Deleting file from FTP:', attachment.file_path);
    const deleteResult = await deleteFileFromFTP(attachment.file_path);
    
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


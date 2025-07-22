/**
 * Image Upload Routes
 * ------------------
 * API endpoints for handling image uploads (Imgur integration)
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const verifyToken = require('../middleware/verifyToken');

// Configure multer for temporary file storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../temp');
    // Ensure temp directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Create unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'temp-' + uniqueSuffix + ext);
  }
});

// File filter to only allow images
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({ 
  storage, 
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size (Imgur limit)
  }
});

// Imgur API client ID
const IMGUR_CLIENT_ID = 'd08c81e700c9978';

/**
 * @route POST /api/upload/imgur
 * @desc Upload an image to Imgur
 * @access Private
 */
router.post('/imgur', verifyToken, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file uploaded' });
    }

    const imagePath = req.file.path;

    // Create form data for the Imgur upload
    const formData = new FormData();
    formData.append('image', fs.createReadStream(imagePath));

    // Upload to Imgur
    const response = await axios.post('https://api.imgur.com/3/image', formData, {
      headers: {
        ...formData.getHeaders(),
        'Authorization': `Client-ID ${IMGUR_CLIENT_ID}`
      }
    });

    // Delete the temporary file
    fs.unlink(imagePath, (err) => {
      if (err) console.error('Error deleting temp file:', err);
    });

    if (response.data.success) {
      res.json({
        success: true,
        data: {
          url: response.data.data.link,
          deleteHash: response.data.data.deletehash
        }
      });
    } else {
      throw new Error(response.data.data.error || 'Upload failed');
    }
  } catch (error) {
    console.error('Imgur upload error:', error);
    
    // Clean up temp file if it exists
    if (req.file && req.file.path) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Error deleting temp file after error:', err);
      });
    }
    
    // Handle specific Imgur API errors
    if (error.response && error.response.status) {
      switch (error.response.status) {
        case 429:
          return res.status(429).json({ 
            success: false, 
            message: 'Rate limit exceeded. Please try again later.'
          });
        case 400:
          return res.status(400).json({ 
            success: false, 
            message: 'Invalid image or request'
          });
        case 403:
          return res.status(403).json({ 
            success: false, 
            message: 'Authentication error with image service'
          });
        default:
          return res.status(500).json({ 
            success: false, 
            message: error.message || 'Image upload failed'
          });
      }
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Server error during image upload'
    });
  }
});

/**
 * @route DELETE /api/upload/imgur/:deleteHash
 * @desc Delete an image from Imgur
 * @access Private
 */
router.delete('/imgur/:deleteHash', verifyToken, async (req, res) => {
  try {
    const { deleteHash } = req.params;
    
    if (!deleteHash) {
      return res.status(400).json({ success: false, message: 'No delete hash provided' });
    }
    
    const response = await axios.delete(`https://api.imgur.com/3/image/${deleteHash}`, {
      headers: {
        'Authorization': `Client-ID ${IMGUR_CLIENT_ID}`
      }
    });
    
    res.json({
      success: response.data.success,
      message: response.data.success ? 'Image deleted successfully' : 'Failed to delete image'
    });
  } catch (error) {
    console.error('Imgur delete error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Image deletion failed'
    });
  }
});

module.exports = router; 
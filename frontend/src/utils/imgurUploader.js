/**
 * Image Upload Utility
 * -------------------
 * Handles image uploads to Imgur via backend API routes
 */

import api from '../api';

/**
 * Upload an image to Imgur via backend
 * @param {File} imageFile - The image file to upload
 * @returns {Promise<Object>} - Object with success status and image data
 */
export const uploadImageToImgur = async (imageFile) => {
  try {
    if (!imageFile) {
      return { success: false, message: 'No image file provided' };
    }
    
    // Check file size (max 10MB for Imgur)
    if (imageFile.size > 10 * 1024 * 1024) {
      return { 
        success: false, 
        message: 'Image file is too large (max 10MB)'
      };
    }
    
    // Create form data for the upload
    const formData = new FormData();
    formData.append('image', imageFile);
    
    // Upload via our backend API
    const response = await api.post('/upload/imgur', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('Imgur upload error:', error);
    
    // Return error message from API if available
    if (error.response && error.response.data) {
      return {
        success: false,
        message: error.response.data.message || 'Image upload failed'
      };
    }
    
    return {
      success: false,
      message: error.message || 'Image upload failed'
    };
  }
};

/**
 * Delete an image from Imgur via backend
 * @param {string} deleteHash - The Imgur deletion hash for the image
 * @returns {Promise<Object>} - Object with success status
 */
export const deleteImageFromImgur = async (deleteHash) => {
  try {
    if (!deleteHash) {
      return { success: false, message: 'No delete hash provided' };
    }
    
    const response = await api.delete(`/upload/imgur/${deleteHash}`);
    return response.data;
  } catch (error) {
    console.error('Imgur delete error:', error);
    
    // Return error message from API if available
    if (error.response && error.response.data) {
      return {
        success: false,
        message: error.response.data.message || 'Image deletion failed'
      };
    }
    
    return {
      success: false,
      message: error.message || 'Image deletion failed'
    };
  }
};

export default {
  uploadImageToImgur,
  deleteImageFromImgur
}; 
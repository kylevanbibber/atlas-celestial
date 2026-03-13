# Discord Bot - Image Upload Feature

## Overview

The Discord bot now supports image uploads with the `/close` command. Users can attach images (receipts, screenshots, etc.) when recording their closes, and these images will be automatically uploaded to Imgur and stored in the database.

## Features

### Image Upload Support
- **File Types**: JPEG, JPG, PNG, GIF, WebP
- **File Size**: Maximum 10MB (Imgur limit)
- **Storage**: Images are uploaded to Imgur and URLs are stored in the `discord_sales.image_url` column

### Command Usage

```
/close alp:1000 refs:2 lead_type:union image:[attached file]
```

### Parameters
- `alp` (required): ALP amount
- `refs` (required): Number of referrals  
- `lead_type` (required): Type of lead (union, credit_union, association, pos, ref, child_safe, free_will_kit, other)
- `image` (optional): Image attachment (receipt, screenshot, etc.)

### Response
The bot will respond with:
- Confirmation of the close recording
- Today's totals for the user
- Link to the uploaded image (if provided)

### Cross-Posting
When a close is recorded with an image, the image will also appear in cross-posted messages to other channels managed by the same manager.

## Technical Implementation

### Database Schema
The `discord_sales` table includes an `image_url` column to store Imgur URLs.

### Image Processing Flow
1. User attaches image to `/close` command
2. Bot validates file type and size
3. Image is downloaded from Discord
4. Image is uploaded to Imgur using existing infrastructure
5. Imgur URL is stored in database
6. Image link is included in response and cross-posted messages

### Error Handling
- Invalid file types are rejected with clear error message
- Files larger than 10MB are rejected
- Upload failures are handled gracefully (close is still recorded)
- Temporary files are cleaned up automatically

## Dependencies
- `axios`: For downloading Discord attachments and uploading to Imgur
- `form-data`: For creating multipart form data for Imgur uploads
- `fs`, `path`, `os`: For temporary file handling

## Configuration
- Imgur Client ID: `d08c81e700c9978` (same as existing upload infrastructure)
- Maximum file size: 10MB
- Allowed file types: image/jpeg, image/jpg, image/png, image/gif, image/webp 
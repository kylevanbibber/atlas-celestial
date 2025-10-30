# Pipeline Attachments System

Complete guide for file upload and attachment management in the recruitment pipeline.

## Overview

The attachment system allows users to upload proof documents, certificates, licenses, and other files for pipeline recruits and their checklist items.

## Features

- ✅ Upload files up to 10MB
- ✅ Support for common file types (PDF, Word, Excel, Images)
- ✅ Link attachments to specific checklist items
- ✅ View/download attachments
- ✅ Delete attachments
- ✅ Track who uploaded and when
- ✅ Add descriptions and categories

## Setup

### 1. Create Database Table

```sql
source atlas/database/create_pipeline_attachments_table.sql;
```

This creates the `pipeline_attachments` table with fields:
- `id` - Primary key
- `recruit_id` - Links to pipeline.id
- `checklist_item_id` - Links to specific checklist item (optional)
- `file_name` - Original filename
- `file_path` - Stored filename on server
- `file_size` - Size in bytes
- `file_type` - MIME type
- `file_category` - Optional category (license, certificate, proof, document)
- `description` - Optional description
- `uploaded_by` - User who uploaded
- `uploaded_at` - Upload timestamp

### 2. FTP Setup

Files are uploaded to your FTP server at `ftp.thekeefersuccess.com` using the existing credentials. The system automatically:
- Connects to FTP on upload/delete
- Creates the `/uploads/pipeline` directory if it doesn't exist
- Uploads files with unique names to prevent conflicts
- Deletes files from FTP when attachments are removed

Files are stored at: `https://ariaslife.com/uploads/pipeline/[filename]`

**Note**: The FTP credentials are already configured in `atlas/backend/routes/pipeline-attachments.js` using the same setup as your other file upload routes (`adminRoutes.js`, etc.).

### 3. Install Multer (if not already installed)

```bash
npm install multer
```

### 4. Backend Already Configured

The routes are already registered in `app.js`:
```javascript
app.use("/api/pipeline-attachments", pipelineAttachmentsRoutes);
```

## API Endpoints

### Upload Attachment

**POST** `/api/pipeline-attachments/upload`

**Headers:**
- `Authorization: Bearer <token>`
- `Content-Type: multipart/form-data`

**Body (FormData):**
```javascript
const formData = new FormData();
formData.append('file', fileObject);
formData.append('recruitId', '123');
formData.append('checklistItemId', '456'); // Optional
formData.append('description', 'License certificate'); // Optional
formData.append('fileCategory', 'license'); // Optional
```

**Response:**
```json
{
  "success": true,
  "attachment": {
    "id": 1,
    "recruit_id": 123,
    "checklist_item_id": 456,
    "file_name": "license.pdf",
    "file_path": "1234567890-license.pdf",
    "file_size": 102400,
    "file_type": "application/pdf",
    "file_category": "license",
    "description": "License certificate",
    "uploaded_by": 92,
    "uploaded_by_name": "VANBIBBER KYLE",
    "uploaded_at": "2025-10-18T17:30:00.000Z"
  },
  "message": "File uploaded successfully"
}
```

### Get Recruit Attachments

**GET** `/api/pipeline-attachments/recruit/:recruitId`

**Response:**
```json
{
  "success": true,
  "attachments": [
    {
      "id": 1,
      "recruit_id": 123,
      "checklist_item_id": 456,
      "file_name": "license.pdf",
      "file_size": 102400,
      "file_type": "application/pdf",
      "uploaded_by_name": "VANBIBBER KYLE",
      "checklist_item_name": "Pass Licensing Test",
      "uploaded_at": "2025-10-18T17:30:00.000Z"
    }
  ]
}
```

### Get Checklist Item Attachments

**GET** `/api/pipeline-attachments/checklist-item/:checklistItemId?recruitId=123`

Returns all attachments for a specific checklist item, optionally filtered by recruit.

### Download Attachment

**GET** `/api/pipeline-attachments/download/:attachmentId`

Downloads the file with proper headers.

### Delete Attachment

**DELETE** `/api/pipeline-attachments/:attachmentId`

Deletes both the database record and the file from the server.

### Update Attachment Metadata

**PUT** `/api/pipeline-attachments/:attachmentId`

**Body:**
```json
{
  "description": "Updated description",
  "fileCategory": "certificate"
}
```

## Allowed File Types

- **Images**: JPEG, PNG, GIF, WebP
- **Documents**: PDF, Word (.doc, .docx)
- **Spreadsheets**: Excel (.xls, .xlsx)
- **Text**: Plain text (.txt)

**File Size Limit:** 10MB per file

## File Categories

Use these categories for organization:
- `license` - License documents
- `certificate` - Certificates and diplomas
- `proof` - Proof of completion/attendance
- `document` - General documents

## Frontend Implementation Example

### Upload Component

```jsx
import React, { useState } from 'react';
import api from '../../../api';

const AttachmentUploader = ({ recruitId, checklistItemId, onUploadComplete }) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file size
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('recruitId', recruitId);
    if (checklistItemId) {
      formData.append('checklistItemId', checklistItemId);
    }
    formData.append('fileCategory', 'proof');
    formData.append('description', 'Uploaded via checklist');

    setUploading(true);
    setError(null);

    try {
      const response = await api.post('/pipeline-attachments/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data.success) {
        onUploadComplete(response.data.attachment);
        event.target.value = ''; // Reset input
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <input
        type="file"
        onChange={handleFileSelect}
        disabled={uploading}
        accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp,.txt"
      />
      {uploading && <span>Uploading...</span>}
      {error && <span style={{ color: 'red' }}>{error}</span>}
    </div>
  );
};

export default AttachmentUploader;
```

### Attachment List Component

```jsx
import React, { useState, useEffect } from 'react';
import api from '../../../api';

const AttachmentList = ({ recruitId }) => {
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAttachments();
  }, [recruitId]);

  const fetchAttachments = async () => {
    try {
      const response = await api.get(`/pipeline-attachments/recruit/${recruitId}`);
      if (response.data.success) {
        setAttachments(response.data.attachments);
      }
    } catch (error) {
      console.error('Error fetching attachments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (attachmentId, fileName) => {
    window.open(
      `${api.defaults.baseURL}/pipeline-attachments/download/${attachmentId}`,
      '_blank'
    );
  };

  const handleDelete = async (attachmentId) => {
    if (!confirm('Delete this attachment?')) return;

    try {
      const response = await api.delete(`/pipeline-attachments/${attachmentId}`);
      if (response.data.success) {
        setAttachments(prev => prev.filter(a => a.id !== attachmentId));
      }
    } catch (error) {
      console.error('Error deleting attachment:', error);
    }
  };

  if (loading) return <div>Loading attachments...</div>;

  return (
    <div>
      <h3>Attachments ({attachments.length})</h3>
      {attachments.length === 0 ? (
        <p>No attachments yet</p>
      ) : (
        <ul>
          {attachments.map(attachment => (
            <li key={attachment.id}>
              <strong>{attachment.file_name}</strong>
              {attachment.checklist_item_name && (
                <span> - {attachment.checklist_item_name}</span>
              )}
              <div>
                <small>
                  Uploaded by {attachment.uploaded_by_name} on{' '}
                  {new Date(attachment.uploaded_at).toLocaleDateString()}
                </small>
              </div>
              <div>
                <button onClick={() => handleDownload(attachment.id, attachment.file_name)}>
                  Download
                </button>
                <button onClick={() => handleDelete(attachment.id)}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AttachmentList;
```

## Checklist Item Integration

### Update Checklist Items to Support Attachments

When displaying checklist items that require proof attachments:

1. Show upload button next to textarea fields
2. Display count of attachments for each item
3. Allow viewing/downloading attached files
4. Show attachment indicator when item has files

```jsx
// In your checklist component
{item.item_type === 'textarea' && (
  <>
    <textarea 
      value={item.value} 
      onChange={(e) => handleValueChange(item.id, e.target.value)}
    />
    <AttachmentUploader
      recruitId={recruitId}
      checklistItemId={item.id}
      onUploadComplete={refreshAttachments}
    />
    <AttachmentCount checklistItemId={item.id} recruitId={recruitId} />
  </>
)}
```

## Database Queries

### Get attachments with recruit and checklist info
```sql
SELECT 
  a.*,
  p.recruit_first,
  p.recruit_last,
  c.item_name,
  u.lagnname as uploaded_by_name
FROM pipeline_attachments a
LEFT JOIN pipeline p ON a.recruit_id = p.id
LEFT JOIN pipeline_checklist_items c ON a.checklist_item_id = c.id
LEFT JOIN activeusers u ON a.uploaded_by = u.id
WHERE a.recruit_id = ?;
```

### Count attachments per checklist item
```sql
SELECT 
  checklist_item_id,
  COUNT(*) as attachment_count
FROM pipeline_attachments
WHERE recruit_id = ?
GROUP BY checklist_item_id;
```

## Security Considerations

1. **Authentication**: All routes require authentication token
2. **File Validation**: Server validates file types and sizes
3. **Access Control**: Users can only access attachments for recruits they have permission to view
4. **File Storage**: Files stored outside web root with unique names
5. **SQL Injection**: Parameterized queries prevent SQL injection

## Troubleshooting

### Upload Fails
- Check file size (must be < 10MB)
- Verify file type is allowed
- Ensure uploads directory exists and is writable
- Check multer is installed: `npm list multer`

### File Not Found on Download
- Verify file exists in `uploads/pipeline/`
- Check file_path in database matches actual filename
- Ensure file wasn't manually deleted from filesystem
- Files should be accessible at `https://ariaslife.com/uploads/pipeline/[filename]`

### Permission Denied
- Verify uploads directory has write permissions
- On Linux/server: `chmod 755 uploads/pipeline`
- Ensure web server has read access to the directory

## Future Enhancements

- [ ] Cloud storage integration (S3, Azure Blob)
- [ ] Image preview/thumbnails
- [ ] Bulk upload multiple files
- [ ] Drag-and-drop upload interface
- [ ] File version history
- [ ] Automatic file compression
- [ ] Virus scanning integration

## Support

For issues or questions:
1. Check console logs for detailed error messages
2. Verify database table was created correctly
3. Ensure proper file permissions on uploads directory
4. Review API endpoint responses for error details


# Pipeline Checklist File Attachments

## Overview

The pipeline checklist now supports file attachments for items requiring proof documents. Users can upload files (licenses, certificates, test scores, etc.) directly to checklist items.

## User Interface

### Where It Appears

File upload functionality appears automatically for any checklist item that includes "attach proof" in its description. For example:
- "Enroll in Pre-Licensing - attach proof"
- "Pass Licensing Test - attach proof"
- "Purchase License - attach proof"
- etc.

### Features

#### Upload Section
Each "attach proof" item shows an **Attachments** section with:
- 📎 Paperclip icon and attachment count
- **Upload File** button (blue button on the right)

#### File Management
Once files are uploaded, users can:
- 📥 **Download** - Download the uploaded file
- 🗑️ **Delete** - Remove the file (with confirmation)
- View file name and size

### Supported File Types

- **Documents**: PDF, DOC, DOCX, XLS, XLSX
- **Images**: JPG, JPEG, PNG, GIF
- **Max Size**: 10MB per file

## Technical Implementation

### Frontend Changes

**File**: `atlas/frontend/src/components/recruiting/Pipeline/PipelineChecklist.js`

#### New States
```javascript
const [attachments, setAttachments] = useState([]);
const [uploadingItems, setUploadingItems] = useState({});
const fileInputRefs = useRef({});
```

#### Key Functions
1. **`fetchChecklistData()`** - Now fetches attachments from `/pipeline-attachments/recruit/{recruitId}`
2. **`handleFileSelect(item, event)`** - Handles file upload via FormData
3. **`handleFileDownload(attachmentId, fileName)`** - Downloads file as blob
4. **`handleFileDelete(attachmentId, itemId)`** - Deletes file with confirmation
5. **`getItemAttachments(itemId)`** - Filters attachments by checklist item
6. **`needsProof(item)`** - Checks if item description includes "attach proof"

#### UI Component
The attachment section is conditionally rendered for items requiring proof:
```jsx
{showAttachments && (
  <div className="checklist-item-attachments">
    {/* Hidden file input */}
    <input type="file" ref={...} onChange={handleFileSelect} />
    
    {/* Header with upload button */}
    <div className="attachments-header">
      <FiPaperclip /> Attachments ({count})
      <button onClick={triggerFileInput}>Upload File</button>
    </div>
    
    {/* List of uploaded files */}
    <div className="attachments-list">
      {/* Download and delete buttons for each file */}
    </div>
  </div>
)}
```

### Backend API Endpoints

**File**: `atlas/backend/routes/pipeline-attachments.js`

All endpoints are under `/api/pipeline-attachments/`

#### Upload File
```
POST /api/pipeline-attachments/upload
Content-Type: multipart/form-data

Body (FormData):
- file: [File]
- recruit_id: [Number]
- checklist_item_id: [Number]
- file_category: [String] (e.g., 'proof')
- description: [String]
```

#### Get Recruit Attachments
```
GET /api/pipeline-attachments/recruit/:recruitId
```
Returns all attachments for a recruit.

#### Download File
```
GET /api/pipeline-attachments/download/:attachmentId
Response: File blob
```

#### Delete File
```
DELETE /api/pipeline-attachments/:attachmentId
```

### Database Schema

**Table**: `pipeline_attachments`

```sql
CREATE TABLE pipeline_attachments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  recruit_id INT NOT NULL,
  checklist_item_id INT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_type VARCHAR(100) NOT NULL,
  file_size INT NOT NULL,
  file_category ENUM('license', 'certificate', 'proof', 'document'),
  description TEXT NULL,
  uploaded_by INT NULL,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (recruit_id) REFERENCES pipeline(id) ON DELETE CASCADE,
  FOREIGN KEY (checklist_item_id) REFERENCES pipeline_checklist_items(id),
  FOREIGN KEY (uploaded_by) REFERENCES activeusers(id)
);
```

### File Storage

**Location**: `atlas/uploads/pipeline/`

**Public URL**: `https://ariaslife.com/uploads/pipeline/[filename]`

**Naming Convention**: `{timestamp}-{random}-{sanitized-filename}`
- Example: `1729366800000-123456789-license-proof.pdf`

### CSS Styling

**File**: `atlas/frontend/src/components/recruiting/Pipeline/PipelineChecklist.css`

New classes added:
- `.checklist-item-attachments` - Container for attachment section
- `.attachments-header` - Header with count and upload button
- `.upload-btn` - Blue upload button
- `.attachments-list` - List of uploaded files
- `.attachment-item` - Individual file row
- `.attachment-action-btn` - Download/delete buttons

## Usage Example

### User Flow

1. **Open Checklist**
   - Navigate to Pipeline Progress
   - Click "View Checklist" on any recruit

2. **Navigate to Item**
   - Expand the stage (e.g., "Licensing")
   - Find item requiring proof (e.g., "Pass Licensing Test - attach proof")

3. **Upload File**
   - Click "Upload File" button in Attachments section
   - Select file from computer (PDF, image, etc.)
   - Wait for "File uploaded successfully!" message
   - File appears in list with download/delete options

4. **Manage Files**
   - Click 📥 download icon to download
   - Click 🗑️ delete icon to remove (confirms first)

## Security

### Authentication
All endpoints require JWT token authentication via `verifyToken` middleware.

### File Validation
- **Size Limit**: 10MB enforced by Multer
- **Type Restriction**: Only allowed file types accepted
- **Sanitization**: Filenames sanitized to remove special characters

### Access Control
- Users can only access attachments for recruits in their hierarchy
- Admins have full access

### Storage Security
- Files stored outside web root with unique names
- Direct file access requires authentication
- Database tracks upload metadata (who, when)

## Error Handling

### Frontend
```javascript
try {
  // Upload logic
  alert('File uploaded successfully!');
} catch (error) {
  console.error('Error uploading file:', error);
  alert('Error uploading file. Please try again.');
}
```

### Backend
- Invalid file type → 400 Bad Request
- File too large → 400 Bad Request  
- Missing authentication → 401 Unauthorized
- File not found → 404 Not Found
- Server errors → 500 with error message

## Future Enhancements

Potential improvements:
- [ ] Preview images/PDFs in-browser
- [ ] Cloud storage integration (S3, Azure Blob)
- [ ] Bulk upload multiple files
- [ ] Attachment thumbnails
- [ ] File versioning (keep history)
- [ ] OCR for automatic text extraction
- [ ] Drag-and-drop upload
- [ ] Progress bar for large uploads

## Testing Checklist

- [x] Upload PDF document
- [x] Upload image (JPG, PNG)
- [x] Download uploaded file
- [x] Delete uploaded file
- [x] Upload file over 10MB (should fail)
- [x] Upload unsupported file type (should fail)
- [x] View attachments across different checklist items
- [x] Multiple files on same checklist item
- [x] Attachment count updates correctly
- [x] Responsive design on mobile

## Support

For issues or questions:
- Backend: `atlas/backend/routes/pipeline-attachments.js`
- Frontend: `atlas/frontend/src/components/recruiting/Pipeline/PipelineChecklist.js`
- Documentation: `atlas/PIPELINE_ATTACHMENTS_GUIDE.md` (comprehensive technical guide)

## Related Files

```
atlas/
├── frontend/src/components/recruiting/Pipeline/
│   ├── PipelineChecklist.js          ✅ Updated
│   └── PipelineChecklist.css         ✅ Updated
├── backend/
│   ├── routes/pipeline-attachments.js ✅ Created
│   └── app.js                         ✅ Routes registered
├── database/
│   └── create_pipeline_attachments_table.sql ✅ Created
└── uploads/
    └── pipeline/                      📁 Upload directory
```


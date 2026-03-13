# Atlas Frontend - Image Uploads with Imgur

## Image Upload Implementation

The frontend uses the `imgurUploader.js` utility to handle image uploads to Imgur:

- `uploadImageToImgur`: Uploads an image to Imgur and returns the URL and delete hash
- `deleteImageFromImgur`: Deletes an image from Imgur using the delete hash

These functions are used in the TeamCustomization component for logo management.

## Imgur Integration

The application uses a hardcoded Imgur client ID (`d08c81e700c9978`) for handling image uploads.

Key features:
- Logo images for teams are hosted on Imgur instead of the local server
- Images are uploaded directly from the browser to Imgur
- Image URLs and delete hashes are stored in the database
- Maximum file size: 10MB (Imgur's limit)

## Security Considerations

- The Client ID is used for anonymous uploads to Imgur
- Imgur rate-limits requests to prevent abuse
- Delete hashes are stored securely to allow image removal when needed

For more information, visit the [Imgur API documentation](https://apidocs.imgur.com/). 
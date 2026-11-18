// Backend/config/cloudinary.js
import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';
import fs from 'fs';
import path from 'path';

// Configure Cloudinary SDK with environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * Checks if real Cloudinary credentials are provided.
 */
export function isCloudinaryConfigured() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  return Boolean(
    cloudName &&
    cloudName !== 'your_cloud_name' &&
    apiKey &&
    apiKey !== 'your_api_key' &&
    apiSecret &&
    apiSecret !== 'your_api_secret'
  );
}

/**
 * Uploads an in-memory buffer to Cloudinary or falls back to local storage if credentials are placeholders.
 * @param {Buffer} buffer - File buffer from multer
 * @param {Object} options - Upload options (folder, public_id)
 * @returns {Promise<{ secure_url: string, public_id: string }>}
 */
export async function uploadBufferToCloudinary(buffer, options = {}) {
  const folder = options.folder || 'dermavision/products';

  if (isCloudinaryConfigured()) {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'image',
          transformation: [{ quality: 'auto', fetch_format: 'auto' }],
          ...options,
        },
        (error, result) => {
          if (error) return reject(error);
          resolve({
            secure_url: result.secure_url,
            public_id: result.public_id,
          });
        }
      );

      Readable.from(buffer).pipe(uploadStream);
    });
  }

  // Graceful fallback: Store locally in public/uploads/products
  const uploadsDir = path.resolve(process.cwd(), 'public/uploads/products');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const filename = `product_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.jpg`;
  const filePath = path.join(uploadsDir, filename);
  fs.writeFileSync(filePath, buffer);

  return {
    secure_url: `/uploads/products/${filename}`,
    public_id: `local_products/${filename}`,
  };
}

/**
 * Deletes an image from Cloudinary (or local storage if local).
 */
export async function deleteCloudinaryImage(publicId) {
  if (!publicId) return;

  if (isCloudinaryConfigured() && !publicId.startsWith('local_')) {
    try {
      await cloudinary.uploader.destroy(publicId);
    } catch (err) {
      console.warn('[Cloudinary] Could not delete remote asset:', err.message);
    }
  } else if (publicId.startsWith('local_products/')) {
    const filename = publicId.replace('local_products/', '');
    const localPath = path.resolve(process.cwd(), 'public/uploads/products', filename);
    if (fs.existsSync(localPath)) {
      try {
        fs.unlinkSync(localPath);
      } catch (err) {
        console.warn('[LocalUpload] Could not delete local file:', err.message);
      }
    }
  }
}

export default cloudinary;

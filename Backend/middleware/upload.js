// Backend/middleware/upload.js
import multer from 'multer';

// Use in-memory buffer storage so files can be piped directly to Cloudinary
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid image format. Only JPEG, PNG, and WebP are supported.'), false);
  }
};

export const uploadProductImage = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB max per product image
  },
  fileFilter,
});

export default uploadProductImage;

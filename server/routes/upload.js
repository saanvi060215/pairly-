import express from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { v2 as cloudinary } from 'cloudinary';
import { authorizeConversationAccess } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '../uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const router = express.Router();

const isCloudinaryConfigured = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
  });
}

const ALLOWED_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg',
  '.pdf', '.txt', '.doc', '.docx', '.xls', '.xlsx',
  '.zip', '.rar', '.mp3', '.wav', '.mp4', '.mov'
]);

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_EXTENSIONS.has(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${ext} is not allowed. Supported formats: images, documents, audio, video, archives.`));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024 // 25 MB max limit
  }
});

router.post('/upload', authorizeConversationAccess, (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File size exceeds maximum limit of 25MB' });
      }
      return res.status(400).json({ error: `Upload error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileExt = path.extname(req.file.originalname).toLowerCase();
    const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(fileExt);

    try {
      if (isCloudinaryConfigured) {
        // Upload to Cloudinary
        const uploadResult = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              folder: 'pairly_uploads',
              resource_type: 'auto',
              public_id: `${crypto.randomUUID()}`
            },
            (error, result) => {
              if (error) return reject(error);
              resolve(result);
            }
          );
          stream.end(req.file.buffer);
        });

        const fileInfo = {
          filename: uploadResult.public_id,
          original_name: req.file.originalname,
          file_size: req.file.size,
          mime_type: req.file.mimetype,
          type: isImage ? 'image' : 'file',
          url: uploadResult.secure_url
        };

        return res.json(fileInfo);
      } else {
        // Local Disk Fallback
        const uniqueId = crypto.randomUUID();
        const filename = `${uniqueId}${fileExt}`;
        const filePath = path.join(uploadsDir, filename);

        fs.writeFileSync(filePath, req.file.buffer);

        const fileInfo = {
          filename,
          original_name: req.file.originalname,
          file_size: req.file.size,
          mime_type: req.file.mimetype,
          type: isImage ? 'image' : 'file',
          url: `/uploads/${filename}`
        };

        return res.json(fileInfo);
      }
    } catch (uploadError) {
      console.error('File upload error:', uploadError);
      return res.status(500).json({ error: 'Failed to process file upload to cloud storage' });
    }
  });
});

export default router;

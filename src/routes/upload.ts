import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { auth, AuthRequest } from '../middleware/auth';

const router = Router();

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

// Image upload
const imageUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// Video upload
const videoUpload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /mp4|mov|avi|mkv|webm/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = /video/.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'));
    }
  },
});

// Audio upload
const audioUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /mp3|wav|m4a|aac|ogg/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = /audio/.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'));
    }
  },
});

// General file upload
const fileUpload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit
});

// Upload single image
router.post('/image', auth, imageUpload.single('image'), async (req: AuthRequest, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }
  const fileUrl = `${process.env.API_URL || 'http://e-commerce-social-app.onrender.com'}/uploads/${req.file.filename}`;
  res.json({ url: fileUrl, filename: req.file.filename, size: req.file.size });
});

// Upload multiple images
router.post('/images', auth, imageUpload.array('images', 10), async (req: AuthRequest, res) => {
  if (!req.files || (req.files as Express.Multer.File[]).length === 0) {
    return res.status(400).json({ message: 'No files uploaded' });
  }
  const files = req.files as Express.Multer.File[];
  const baseUrl = process.env.API_URL || 'http://e-commerce-social-app.onrender.com';
  const urls = files.map((file) => `${baseUrl}/uploads/${file.filename}`);
  res.json({ urls, filenames: files.map((f) => f.filename) });
});

// Upload video
router.post('/video', auth, videoUpload.single('video'), async (req: AuthRequest, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }
  const fileUrl = `${process.env.API_URL || 'http://e-commerce-social-app.onrender.com'}/uploads/${req.file.filename}`;
  res.json({ url: fileUrl, filename: req.file.filename, size: req.file.size });
});

// Upload audio
router.post('/audio', auth, audioUpload.single('audio'), async (req: AuthRequest, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }
  const fileUrl = `${process.env.API_URL || 'http://e-commerce-social-app.onrender.com'}/uploads/${req.file.filename}`;
  res.json({ url: fileUrl, filename: req.file.filename, size: req.file.size });
});

// Upload file
router.post('/file', auth, fileUpload.single('file'), async (req: AuthRequest, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }
  const fileUrl = `${process.env.API_URL || 'http://e-commerce-social-app.onrender.com'}/uploads/${req.file.filename}`;
  res.json({ url: fileUrl, filename: req.file.originalname, size: req.file.size });
});

export default router;


import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import streamifier from 'streamifier';
import { auth, AuthRequest } from '../middleware/auth';
import { env } from '../config/env';
import { Upload } from '../models/Upload';
import { v2 as cloudinary } from 'cloudinary';

const router = Router();

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Use memory storage when Cloudinary is configured (avoid writing to disk on ephemeral hosts)
const cloudConfigured = Boolean(
  env.cloudinary && (env.cloudinary.url || (env.cloudinary.cloudName && env.cloudinary.apiKey && env.cloudinary.apiSecret))
);

const memoryStorage = multer.memoryStorage();
const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const storage = cloudConfigured ? memoryStorage : diskStorage;

// Configure cloudinary if available
if (env.cloudinary && (env.cloudinary.url || (env.cloudinary.cloudName && env.cloudinary.apiKey && env.cloudinary.apiSecret))) {
  if (env.cloudinary.url) {
    cloudinary.config({ secure: true, cloudinary_url: env.cloudinary.url } as any);
  } else {
    cloudinary.config({
      cloud_name: env.cloudinary.cloudName,
      api_key: env.cloudinary.apiKey,
      api_secret: env.cloudinary.apiSecret,
      secure: true,
    });
  }
}

// Image upload
const imageUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

// Video upload
const videoUpload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /mp4|mov|avi|mkv|webm/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = /video/.test(file.mimetype);
    if (extname && mimetype) cb(null, true);
    else cb(new Error('Only video files are allowed'));
  },
});

// Audio upload
const audioUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /mp3|wav|m4a|aac|ogg/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = /audio/.test(file.mimetype);
    if (extname && mimetype) cb(null, true);
    else cb(new Error('Only audio files are allowed'));
  },
});

// Generic file
const fileUpload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

router.post('/image', auth, imageUpload.single('image'), async (req: AuthRequest, res) => {
  console.log('[upload] /image request', { ip: req.ip, headers: req.headers && { origin: req.headers.origin, 'content-length': req.headers['content-length'] } });
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  try {
    if (cloudConfigured && (req.file as any).buffer) {
      // Upload buffer to Cloudinary via stream
      const buffer = (req.file as any).buffer as Buffer;
      const streamUpload = (resourceType: 'raw' | 'auto' | 'image' | 'video' = 'image') => new Promise<any>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream({ resource_type: resourceType as any }, (error, result) => {
          if (error) return reject(error);
          resolve(result);
        });
        streamifier.createReadStream(buffer).pipe(uploadStream);
      });

      const uploaded = await streamUpload('image');
      const saved = await Upload.create({ url: uploaded.secure_url, filename: req.file.originalname || req.file.fieldname, size: req.file.size, mimeType: req.file.mimetype, publicId: uploaded.public_id, uploader: req.user?._id });
      return res.json({ url: saved.url, filename: saved.filename, size: saved.size, id: saved._id });
    }

    // Fallback: file on disk (either because cloud not configured or using disk storage)
    const file = req.file as Express.Multer.File;
    if (!file) return res.status(400).json({ message: 'No file uploaded' });
    const fileUrl = `${process.env.API_URL || 'http://192.168.145.108:4000'}/uploads/${file.filename}`;
    const saved = await Upload.create({ url: fileUrl, filename: file.filename, size: file.size, mimeType: file.mimetype, uploader: req.user?._id });
    return res.json({ url: saved.url, filename: saved.filename, size: saved.size, id: saved._id });
  } catch (err: any) {
    console.error('Upload image error', err);
    return res.status(500).json({ message: err.message || 'Upload failed' });
  }
});

router.post('/images', auth, imageUpload.array('images', 10), async (req: AuthRequest, res) => {
  const files = req.files as Express.Multer.File[];
  if (!files || files.length === 0) return res.status(400).json({ message: 'No files uploaded' });
  try {
    const results: any[] = [];
    if (cloudConfigured) {
      // If memory buffers are available, upload via stream, otherwise use file.path
      for (const file of files) {
        if ((file as any).buffer) {
          const buffer = (file as any).buffer as Buffer;
          const streamUpload = (resourceType: 'raw' | 'auto' | 'image' | 'video' = 'image') => new Promise<any>((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream({ resource_type: resourceType as any }, (error, result) => {
              if (error) return reject(error);
              resolve(result);
            });
            streamifier.createReadStream(buffer).pipe(uploadStream);
          });
          const uploaded = await streamUpload('image');
          const saved = await Upload.create({ url: uploaded.secure_url, filename: file.originalname || file.fieldname || file.filename, size: file.size, mimeType: file.mimetype, publicId: uploaded.public_id, uploader: req.user?._id });
          results.push({ url: saved.url, filename: saved.filename, size: saved.size, id: saved._id });
        } else {
          const uploaded = await cloudinary.uploader.upload(file.path, { resource_type: 'image' });
          try { fs.unlinkSync(file.path); } catch {}
          const saved = await Upload.create({ url: uploaded.secure_url, filename: file.filename, size: file.size, mimeType: file.mimetype, publicId: uploaded.public_id, uploader: req.user?._id });
          results.push({ url: saved.url, filename: saved.filename, size: saved.size, id: saved._id });
        }
      }
    } else {
      const baseUrl = process.env.API_URL || 'http://192.168.145.108:4000';
      for (const file of files) {
        const url = `${baseUrl}/uploads/${file.filename}`;
        const saved = await Upload.create({ url, filename: file.filename, size: file.size, mimeType: file.mimetype, uploader: req.user?._id });
        results.push({ url: saved.url, filename: saved.filename, size: saved.size, id: saved._id });
      }
    }
    return res.json({ files: results });
  } catch (err: any) {
    console.error('Upload images error', err);
    return res.status(500).json({ message: err.message || 'Upload failed' });
  }
});

router.post('/video', auth, videoUpload.single('video'), async (req: AuthRequest, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  try {
    if (cloudConfigured && (req.file as any).buffer) {
      const buffer = (req.file as any).buffer as Buffer;
      const streamUpload = (resourceType: 'raw' | 'auto' | 'image' | 'video' = 'video') => new Promise<any>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream({ resource_type: resourceType as any }, (error, result) => {
          if (error) return reject(error);
          resolve(result);
        });
        streamifier.createReadStream(buffer).pipe(uploadStream);
      });
      const uploaded = await streamUpload('video');
      const saved = await Upload.create({ url: uploaded.secure_url, filename: req.file.originalname || req.file.filename, size: req.file.size, mimeType: req.file.mimetype, publicId: uploaded.public_id, uploader: req.user?._id });
      return res.json({ url: saved.url, filename: saved.filename, size: saved.size, id: saved._id });
    }
    if (cloudConfigured) {
      const uploaded = await cloudinary.uploader.upload(req.file.path, { resource_type: 'video' });
      try { fs.unlinkSync(req.file.path); } catch {}
      const saved = await Upload.create({ url: uploaded.secure_url, filename: req.file.filename, size: req.file.size, mimeType: req.file.mimetype, publicId: uploaded.public_id, uploader: req.user?._id });
      return res.json({ url: saved.url, filename: saved.filename, size: saved.size, id: saved._id });
    }
    const fileUrl = `${process.env.API_URL || 'http://192.168.145.108:4000'}/uploads/${req.file.filename}`;
    const saved = await Upload.create({ url: fileUrl, filename: req.file.filename, size: req.file.size, mimeType: req.file.mimetype, uploader: req.user?._id });
    return res.json({ url: saved.url, filename: saved.filename, size: saved.size, id: saved._id });
  } catch (err: any) {
    console.error('Upload video error', err);
    return res.status(500).json({ message: err.message || 'Upload failed' });
  }
});

router.post('/audio', auth, audioUpload.single('audio'), async (req: AuthRequest, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  try {
    if (cloudConfigured && (req.file as any).buffer) {
      const buffer = (req.file as any).buffer as Buffer;
      const streamUpload = (resourceType: 'raw' | 'auto' | 'image' | 'video' = 'video') => new Promise<any>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream({ resource_type: resourceType as any }, (error, result) => {
          if (error) return reject(error);
          resolve(result);
        });
        streamifier.createReadStream(buffer).pipe(uploadStream);
      });
      const uploaded = await streamUpload('video');
      const saved = await Upload.create({ url: uploaded.secure_url, filename: req.file.originalname || req.file.filename, size: req.file.size, mimeType: req.file.mimetype, publicId: uploaded.public_id, uploader: req.user?._id });
      return res.json({ url: saved.url, filename: saved.filename, size: saved.size, id: saved._id });
    }
    if (cloudConfigured) {
      const uploaded = await cloudinary.uploader.upload(req.file.path, { resource_type: 'video' });
      try { fs.unlinkSync(req.file.path); } catch {}
      const saved = await Upload.create({ url: uploaded.secure_url, filename: req.file.filename, size: req.file.size, mimeType: req.file.mimetype, publicId: uploaded.public_id, uploader: req.user?._id });
      return res.json({ url: saved.url, filename: saved.filename, size: saved.size, id: saved._id });
    }
    const fileUrl = `${process.env.API_URL || 'http://192.168.145.108:4000'}/uploads/${req.file.filename}`;
    const saved = await Upload.create({ url: fileUrl, filename: req.file.filename, size: req.file.size, mimeType: req.file.mimetype, uploader: req.user?._id });
    return res.json({ url: saved.url, filename: saved.filename, size: saved.size, id: saved._id });
  } catch (err: any) {
    console.error('Upload audio error', err);
    return res.status(500).json({ message: err.message || 'Upload failed' });
  }
});

router.post('/file', auth, fileUpload.single('file'), async (req: AuthRequest, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  try {
    if (cloudConfigured && (req.file as any).buffer) {
      const buffer = (req.file as any).buffer as Buffer;
      const streamUpload = (resourceType: 'raw' | 'auto' | 'image' | 'video' = 'auto') => new Promise<any>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream({ resource_type: resourceType as any }, (error, result) => {
          if (error) return reject(error);
          resolve(result);
        });
        streamifier.createReadStream(buffer).pipe(uploadStream);
      });
      const uploaded = await streamUpload('auto');
      const saved = await Upload.create({ url: uploaded.secure_url, filename: req.file.originalname || req.file.filename, size: req.file.size, mimeType: req.file.mimetype, publicId: uploaded.public_id, uploader: req.user?._id });
      return res.json({ url: saved.url, filename: saved.filename, size: saved.size, id: saved._id });
    }
    if (cloudConfigured) {
      const uploaded = await cloudinary.uploader.upload(req.file.path, { resource_type: 'auto' });
      try { fs.unlinkSync(req.file.path); } catch {}
      const saved = await Upload.create({ url: uploaded.secure_url, filename: req.file.originalname, size: req.file.size, mimeType: req.file.mimetype, publicId: uploaded.public_id, uploader: req.user?._id });
      return res.json({ url: saved.url, filename: saved.filename, size: saved.size, id: saved._id });
    }
    const fileUrl = `${process.env.API_URL || 'http://192.168.145.108:4000'}/uploads/${req.file.filename}`;
    const saved = await Upload.create({ url: fileUrl, filename: req.file.originalname, size: req.file.size, mimeType: req.file.mimetype, uploader: req.user?._id });
    return res.json({ url: saved.url, filename: saved.filename, size: saved.size, id: saved._id });
  } catch (err: any) {
    console.error('Upload file error', err);
    return res.status(500).json({ message: err.message || 'Upload failed' });
  }
});

export default router;


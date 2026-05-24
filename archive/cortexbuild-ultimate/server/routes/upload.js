const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const pool    = require('../db');
const authMiddleware = require('../middleware/auth');
const uploadRateLimiter = require('../middleware/uploadRateLimiter');
const { validateFileContent } = require('../lib/file-validation');

const router = express.Router();
router.use(authMiddleware);
// Stricter rate limit for uploads: 20 requests per minute (uploads are expensive)
router.use(uploadRateLimiter);

// ─── Multer config ────────────────────────────────────────────────────────────
const ALLOWED_EXTS = new Set(['.pdf','.doc','.docx','.xls','.xlsx','.png','.jpg','.jpeg','.dwg','.zip']);
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/zip',
  'application/x-zip-compressed',
  'application/octet-stream' // For .dwg files
]);

// Magic numbers for file type validation (prevents extension spoofing)
const MAGIC_NUMBERS = {
  pdf: '25504446',
  png: '89504e470d0a1a0a',
  jpg: 'ffd8ff',
  jpeg: 'ffd8ff',
  gif: '47494638',
  zip: '504b0304',
  docx: '504b0304',
  xlsx: '504b0304',
  dwg: '41433130',
};

function getFileTypeFromBuffer(buffer) {
  const hex = buffer.toString('hex').substring(0, 16).toLowerCase();
  if (hex.startsWith(MAGIC_NUMBERS.pdf)) return 'pdf';
  if (hex.startsWith(MAGIC_NUMBERS.png)) return 'png';
  if (hex.startsWith(MAGIC_NUMBERS.jpg)) return 'jpg';
  if (hex.startsWith(MAGIC_NUMBERS.gif)) return 'gif';
  if (hex.startsWith(MAGIC_NUMBERS.zip)) return 'zip'; // Also matches docx, xlsx
  if (hex.startsWith(MAGIC_NUMBERS.dwg)) return 'dwg';
  return null;
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, path.join(__dirname, '../uploads')),
  filename:    (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();

  // First check extension
  if (!ALLOWED_EXTS.has(ext)) {
    return cb(new Error(`File extension not allowed: ${ext}`), false);
  }

  // Validate MIME type
  if (file.mimetype && !ALLOWED_MIME_TYPES.has(file.mimetype)) {
    // Allow some flexibility for Office documents and CAD files
    const isOfficeFile = ext.match(/\.(docx|xlsx)$/);
    const isCADFile = ext === '.dwg';
    const isZipVariant = file.mimetype.includes('zip') || file.mimetype === 'application/octet-stream';

    if (!(isOfficeFile || isCADFile || isZipVariant)) {
      return cb(new Error(`MIME type not allowed: ${file.mimetype}`), false);
    }
  }

  cb(null, true);
};

// Async wrapper for magic number validation (called after multer buffers the file)
const validateAfterUpload = async (req, res, next) => {
  if (!req.file) return next();

  try {
    const fileBuffer = await fs.promises.readFile(req.file.path);
    const ext = path.extname(req.file.originalname).toLowerCase();
    const validation = validateFileContent(fileBuffer, ext);

    if (!validation.valid) {
      // Delete the uploaded file
      try {
        await fs.promises.unlink(req.file.path);
      } catch (unlinkErr) {
        console.error('[upload.js validateAfterUpload] Failed to delete invalid file:', unlinkErr.message);
      }
      return res.status(400).json({ message: validation.message });
    }

    next();
  } catch (err) {
    console.error('[upload.js validateAfterUpload]', err);
    // Don't pass err to next() - already handled the file deletion
    return res.status(500).json({ message: 'Internal server error during upload validation' });
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

// ─── Format bytes ─────────────────────────────────────────────────────────────
function formatSize(bytes) {
  if (bytes < 1024)           return `${bytes} B`;
  if (bytes < 1024 * 1024)    return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── POST /api/upload ─────────────────────────────────────────────────────────
router.post('/', upload.single('file'), validateAfterUpload, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file provided' });

    const ext      = path.extname(req.file.originalname).replace('.', '').toUpperCase();
    const fileSize = formatSize(req.file.size);
    const name     = req.file.originalname;
    const uploadedBy = req.user?.name || req.user?.email || 'Unknown';
    const category = req.body.category || 'REPORTS';
    const project  = req.body.project  || null;
    const projectId = req.body.project_id || null;

    const { rows } = await pool.query(
      `INSERT INTO documents (name, type, project_id, project, uploaded_by, version, size, status, category, organization_id, company_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [name, ext, projectId, project, uploadedBy, '1.0', fileSize, 'current', category, req.user.organization_id, req.user.company_id || null]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[POST /api/upload]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─── Multer error handler ─────────────────────────────────────────────────────
router.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ message: `Upload error: file processing failed` });
  }
  res.status(500).json({ message: 'Internal server error' });
});

module.exports = router;

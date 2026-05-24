const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const pool    = require('../db');
const authMiddleware = require('../middleware/auth');
const uploadRateLimiter = require('../middleware/uploadRateLimiter');
const { buildTenantFilter, isSuperAdmin, isCompanyOwner } = require('../middleware/tenantFilter');

const router = express.Router();
router.use(authMiddleware);
router.use(uploadRateLimiter);

const UPLOADS_DIR = path.join(__dirname, '../uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const ALLOWED_EXTS = ['.pdf','.doc','.docx','.xls','.xlsx','.png','.jpg','.jpeg','.gif','.webp','.dwg','.dxf','.zip','.rar','.csv'];

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${unique}${ext}`);
  },
});

const fileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_EXTS.includes(ext)) cb(null, true);
  else cb(new Error(`File type not allowed: ${ext}`), false);
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 100 * 1024 * 1024 } });

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── GET /api/files ───────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { category, project_id, search, type, include_versions } = req.query;
    const org = buildTenantFilter(req, 'AND');
    let query = `SELECT * FROM documents WHERE 1=1${org.clause}`;
    const params = [...org.params];
    let paramCount = org.params.length;

    if (category) {
      paramCount++;
      query += ` AND category = $${paramCount}`;
      params.push(category);
    }
    if (project_id) {
      paramCount++;
      query += ` AND project_id = $${paramCount}`;
      params.push(project_id);
    }
    if (search) {
      paramCount++;
      query += ` AND name ILIKE $${paramCount}`;
      params.push(`%${search.replace(/[%_\\]/g, '\\$&')}%`);
    }
    if (type) {
      paramCount++;
      query += ` AND type = $${paramCount}`;
      params.push(type.toUpperCase());
    }

    query += ' ORDER BY created_at DESC';
    const { rows } = await pool.query(query, params);

    if (include_versions === 'true' && rows.length > 0) {
      const docIds = rows.map(r => r.id);
      const { rows: versions } = await pool.query(
        'SELECT * FROM document_versions WHERE document_id = ANY($1) ORDER BY document_id, version DESC',
        [docIds]
      );

      const versionMap = {};
      versions.forEach(v => {
        if (!versionMap[v.document_id]) versionMap[v.document_id] = [];
        versionMap[v.document_id].push(v);
      });

      const docsWithVersions = rows.map(doc => ({
        ...doc,
        versions: versionMap[doc.id] || []
      }));
      return res.json({ data: docsWithVersions });
    }

    res.json({ data: rows });
  } catch (err) {
    console.error('[GET /api/files]', 'Internal server error');
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─── GET /api/files/:id ──────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const org = buildTenantFilter(req, 'AND');
    const { rows } = await pool.query(
      `SELECT d.*, json_agg(dv.*) FILTER (WHERE dv.id IS NOT NULL) as versions
       FROM documents d
       LEFT JOIN document_versions dv ON dv.document_id = d.id
       WHERE d.id = $1${org.clause}
       GROUP BY d.id`,
      [id, ...org.params]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Document not found' });

    const doc = { ...rows[0], versions: rows[0].versions || [] };
    res.json(doc);
  } catch (err) {
    console.error('[GET /api/files/:id]', 'Internal server error');
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─── POST /api/files/upload ───────────────────────────────────────────────────
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file provided' });

    const ext = path.extname(req.file.originalname).replace('.', '').toUpperCase();
    const fileSize = formatSize(req.file.size);
    const name = req.body.name || req.file.originalname;
    const uploadedBy = req.user?.name || req.user?.email || 'Unknown';
    const category = req.body.category || 'REPORTS';
    const projectId = req.body.project_id || null;
    const filePath = `/uploads/${req.file.filename}`;
    const accessLevel = req.body.access_level || 'project';
    const discipline = req.body.discipline || null;
    const dateIssued = req.body.date_issued || null;
    const author = req.body.author || uploadedBy;
    const organizationId = req.user?.organization_id || null;
    const companyId = req.user?.company_id || null;

    const { rows } = await pool.query(
      `INSERT INTO documents (name, type, project_id, uploaded_by, version, size, status, category, file_path, access_level, discipline, date_issued, author, organization_id, company_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [name, ext, projectId, uploadedBy, '1.0', fileSize, 'current', category, filePath, accessLevel, discipline, dateIssued, author, organizationId, companyId]
    );

    await pool.query(
      `INSERT INTO document_versions (document_id, version, file_path, uploaded_by, changes)
       VALUES ($1, $2, $3, $4, $5)`,
      [rows[0].id, '1.0', filePath, uploadedBy, 'Initial version']
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[POST /api/files/upload]', 'Internal server error');
    if (err.message && err.message.startsWith('File type not allowed')) {
      return res.status(400).json({ message: 'Upload failed' });
    }
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─── PUT /api/files/:id ──────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const org = buildTenantFilter(req, 'AND');
    const { name, category, access_level, discipline, date_issued, author } = req.body;
    const updates = [];
    const params = [];
    let paramCount = 0;

    if (name) {
      paramCount++;
      updates.push(`name = $${paramCount}`);
      params.push(name);
    }
    if (category) {
      paramCount++;
      updates.push(`category = $${paramCount}`);
      params.push(category);
    }
    if (access_level) {
      paramCount++;
      updates.push(`access_level = $${paramCount}`);
      params.push(access_level);
    }
    if (discipline !== undefined) {
      paramCount++;
      updates.push(`discipline = $${paramCount}`);
      params.push(discipline);
    }
    if (date_issued !== undefined) {
      paramCount++;
      updates.push(`date_issued = $${paramCount}`);
      params.push(date_issued);
    }
    if (author !== undefined) {
      paramCount++;
      updates.push(`author = $${paramCount}`);
      params.push(author);
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    params.push(id);
    if (org.clause) params.push(...org.params);
    const whereClause = org.clause || '';
    const { rows } = await pool.query(
      `UPDATE documents SET ${updates.join(', ')} WHERE id = $${paramCount + 1}${whereClause} RETURNING *`,
      params
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Document not found' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('[PUT /api/files/:id]', 'Internal server error');
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─── POST /api/files/:id/upload-version ─────────────────────────────────────
router.post('/:id/upload-version', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file provided' });
    const { id } = req.params;
    const org = buildTenantFilter(req, 'AND');

    // SECURITY: Filter by organization_id to prevent cross-tenant access
    const { rows: existing } = await pool.query(`SELECT * FROM documents WHERE id = $1${org.clause}`, [id, ...org.params]);
    if (existing.length === 0) return res.status(404).json({ message: 'Document not found' });

    const currentVersion = existing[0].version;
    const versionParts = currentVersion.split('.');
    const newVersion = `${versionParts[0]}.${parseInt(versionParts[1] || 0) + 1}`;

    const filePath = `/uploads/${req.file.filename}`;
    const uploadedBy = req.user?.name || req.user?.email || 'Unknown';
    const changes = req.body.changes || 'Updated file';

    const ext = path.extname(req.file.originalname).replace('.', '').toUpperCase();
    const fileSize = formatSize(req.file.size);

    // SECURITY: Include organization_id filter in UPDATE
    await pool.query(
      `UPDATE documents SET version = $1, size = $2, type = $3, file_path = $4 WHERE id = $5${org.clause}`,
      [newVersion, fileSize, ext, filePath, id, ...org.params]
    );

    await pool.query(
      `INSERT INTO document_versions (document_id, version, file_path, uploaded_by, changes)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, newVersion, filePath, uploadedBy, changes]
    );

    const { rows } = await pool.query(`SELECT * FROM documents WHERE id = $1${org.clause}`, [id, ...org.params]);
    res.json(rows[0]);
  } catch (err) {
    console.error('[POST /api/files/:id/upload-version]', 'Internal server error');
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─── GET /api/files/:id/download ─────────────────────────────────────────────
router.get('/:id/download', async (req, res) => {
  try {
    const { id } = req.params;
    const org = buildTenantFilter(req, 'AND');
    const { rows } = await pool.query(`SELECT file_path, name, type FROM documents WHERE id = $1${org.clause}`, [id, ...org.params]);
    if (rows.length === 0) return res.status(404).json({ message: 'Document not found' });

    const doc = rows[0];
    if (!doc.file_path) return res.status(404).json({ message: 'File not found on server' });

    // Resolve to absolute path and validate it's within uploads directory
    const fullPath = path.resolve(UPLOADS_DIR, path.basename(doc.file_path));
    if (!fullPath.startsWith(UPLOADS_DIR)) {
      console.error('[SECURITY] Path traversal attempt detected:', doc.file_path);
      return res.status(403).json({ message: 'Invalid file path' });
    }
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ message: 'File not found on server' });
    }

    res.download(fullPath, doc.name);
  } catch (err) {
    console.error('[GET /api/files/:id/download]', 'Internal server error');
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─── GET /api/files/:id/preview ──────────────────────────────────────────────
router.get('/:id/preview', async (req, res) => {
  try {
    const { id } = req.params;
    const org = buildTenantFilter(req, 'AND');
    const { rows } = await pool.query(`SELECT file_path, name, type FROM documents WHERE id = $1${org.clause}`, [id, ...org.params]);
    if (rows.length === 0) return res.status(404).json({ message: 'Document not found' });

    const doc = rows[0];
    if (!doc.file_path) return res.status(404).json({ message: 'File not found on server' });

    // Resolve to absolute path and validate it's within uploads directory
    const fullPath = path.resolve(UPLOADS_DIR, path.basename(doc.file_path));
    if (!fullPath.startsWith(UPLOADS_DIR)) {
      console.error('[SECURITY] Path traversal attempt detected:', doc.file_path);
      return res.status(403).json({ message: 'Invalid file path' });
    }
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ message: 'File not found on server' });
    }

    const ext = path.extname(doc.file_path).toLowerCase();
    const contentTypes = {
      '.pdf': 'application/pdf',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
    };

    const contentType = contentTypes[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${doc.name}"`);

    const fileStream = fs.createReadStream(fullPath);
    fileStream.pipe(res);
  } catch (err) {
    console.error('[GET /api/files/:id/preview]', 'Internal server error');
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─── GET /api/files/folders ──────────────────────────────────────────────────
router.get('/folders/list', async (req, res) => {
  try {
    const { parent } = req.query;
    const { clause: tenantClause, params: tenantParams } = buildTenantFilter(req, 'AND');
    const params = [...tenantParams];
    let query = `SELECT DISTINCT parent_folder FROM documents WHERE parent_folder IS NOT NULL${tenantClause}`;

    if (parent) {
      params.push(parent);
      query += ` AND parent_folder = $${params.length}`;
    }

    const { rows } = await pool.query(query, params);
    res.json({ data: rows.map(r => r.parent_folder) });
  } catch (err) {
    console.error('[GET /api/files/folders]', 'Internal server error');
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─── DELETE /api/files/:id ───────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const org = buildTenantFilter(req, 'AND');

    const { rows } = await pool.query(`SELECT file_path FROM documents WHERE id = $1${org.clause}`, [id, ...org.params]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Document not found' });
    }

    const filePath = rows[0].file_path;

    await pool.query('DELETE FROM document_versions WHERE document_id = $1', [id]);
    await pool.query(`DELETE FROM documents WHERE id = $1${org.clause}`, [id, ...org.params]);

    if (filePath) {
      // Resolve to absolute path and validate it's within uploads directory
      const fullPath = path.resolve(UPLOADS_DIR, path.basename(filePath));
      // Normalize paths to prevent traversal attacks (e.g., ../../etc/passwd)
      const normalizedFull = path.normalize(fullPath);
      const normalizedUploads = path.normalize(UPLOADS_DIR);
      if (!normalizedFull.startsWith(normalizedUploads + path.sep)) {
        console.error('[SECURITY] Path traversal attempt detected:', filePath);
        return res.status(403).json({ message: 'Invalid file path' });
      }
      try {
        await fs.promises.unlink(fullPath);
      } catch (err) {
        if (err.code !== 'ENOENT') {
          console.error('[DELETE /api/files/:id] Error deleting file:', err);
        }
      }
    }

    res.json({ message: 'Document deleted' });
  } catch (err) {
    console.error('[DELETE /api/files/:id]', 'Internal server error');
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

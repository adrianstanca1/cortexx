const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');
const { buildTenantFilter } = require('../middleware/tenantFilter');
const { logAudit } = require('./audit-helper');
const { fileTypeFromBuffer } = require('file-type');

const router = express.Router();

const UPLOAD_BASE = path.join(__dirname, '../uploads/submittals');

/**
 * Resolve a stored (possibly relative) file path safely within the upload dir.
 * Rejects paths that escape the upload directory.
 * @param {string} storedPath — raw path from DB or trusted source
 * @returns {string} safe absolute path
 * @throws {Error} if path traversal detected
 */
function resolveSafePath(storedPath) {
  if (!storedPath || typeof storedPath !== 'string') {
    throw new Error('Invalid file path');
  }
  const resolved = path.resolve(UPLOAD_BASE, storedPath);
  if (!resolved.startsWith(UPLOAD_BASE + path.sep)) {
    throw new Error('Path traversal detected');
  }
  return resolved;
}

// Allowed MIME types for submittals
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/gif',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.ms-excel',
  'application/acad',
  'application/x-autocad',
  'drawing/dwg',
  'image/vnd.dwg',
  'application/x-gltf-binary',
  'model/gltf-binary',
  'text/plain'
]);

// Allowed extensions as fallback
const ALLOWED_EXTENSIONS = new Set([
  '.pdf', '.png', '.jpg', '.jpeg', '.gif',
  '.xlsx', '.docx', '.doc', '.xls',
  '.dwg', '.dxf', '.glb', '.gltf', '.txt', '.csv'
]);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_BASE);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `submittal-${uniqueSuffix}-${file.originalname}`);
  }
});

// File filter with content validation
const fileFilter = async (req, file, cb) => {
  try {
    // Check extension first (quick fail)
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return cb(new Error(`Invalid file type. Allowed: ${Array.from(ALLOWED_EXTENSIONS).join(', ')}`), false);
    }

    // Read first 4100 bytes for magic number detection
    const chunk = await new Promise((resolve, reject) => {
      const chunks = [];
      file.stream.on('data', (chunk) => {
        chunks.push(chunk);
        const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
        if (totalLength >= 4100) {
          file.stream.pause();
          resolve(Buffer.concat(chunks));
        }
      });
      file.stream.on('end', () => resolve(Buffer.concat(chunks)));
      file.stream.on('error', reject);
    });

    // Detect file type from magic numbers
    const detected = await fileTypeFromBuffer(chunk);
    
    if (detected) {
      // If we detected a MIME type, verify it's allowed
      if (!ALLOWED_MIME_TYPES.has(detected.mime)) {
        return cb(new Error(`File content type '${detected.mime}' is not allowed. File extension does not match content.`), false);
      }
    }
    
    // Reset stream for multer to process
    file.stream.unshift(chunk);
    cb(null, true);
  } catch (err) {
    console.error('[submittals fileFilter] Error validating file:', err);
    cb(err, false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

/**
 * GET /api/submittals - Get all submittals for company
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { status, type, projectId } = req.query;
    
    let query = `
      SELECT 
        s.*,
        u1.name as submitted_by_name,
        u2.name as reviewer_full_name,
        p.name as project_name,
        (SELECT COUNT(*) FROM submittal_comments WHERE submittal_id = s.id) as comment_count
      FROM submittals s
      LEFT JOIN users u1 ON s.submitted_by = u1.id
      LEFT JOIN users u2 ON s.reviewer_id = u2.id
      LEFT JOIN projects p ON s.project_id = p.id
      WHERE COALESCE(s.organization_id, s.company_id) = $1
    `;
    
    const params = [req.user.company_id];
    let paramIndex = 2;
    
    if (status) {
      query += ` AND s.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    
    if (type) {
      query += ` AND s.type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }
    
    if (projectId) {
      query += ` AND s.project_id = $${paramIndex}`;
      params.push(projectId);
      paramIndex++;
    }
    
    query += ' ORDER BY s.submitted_date DESC';
    
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('[submittals GET]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * GET /api/submittals/:id - Get single submittal with details
 */
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT 
        s.*,
        u1.name as submitted_by_name,
        u2.name as reviewer_full_name,
        p.name as project_name
       FROM submittals s
       LEFT JOIN users u1 ON s.submitted_by = u1.id
       LEFT JOIN users u2 ON s.reviewer_id = u2.id
       LEFT JOIN projects p ON s.project_id = p.id
       WHERE s.id = $1 AND COALESCE(s.organization_id, s.company_id) = $2`,
      [req.params.id, req.user.company_id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: 'Submittal not found' });
    }

    // Get attachments
    const { clause: attClause, params: attParams } = buildTenantFilter(req, 'AND', 's', 2);
    const attachments = await pool.query(
      `SELECT sa.* FROM submittal_attachments sa
       JOIN submittals s ON sa.submittal_id = s.id
       WHERE sa.submittal_id = $1${attClause}`,
      [req.params.id, ...attParams]
    );

    // Get comments (tenant-scoped)
    const { clause: commentClause, params: commentParams } = buildTenantFilter(req, 'AND', 's', 2);
    const comments = await pool.query(
      `SELECT sc.* FROM submittal_comments sc
       JOIN submittals s ON sc.submittal_id = s.id
       WHERE sc.submittal_id = $1${commentClause}
       ORDER BY sc.created_at ASC`,
      [req.params.id, ...commentParams]
    );

    res.json({
      ...rows[0],
      attachments: attachments.rows,
      comments: comments.rows
    });
  } catch (err) {
    console.error('[submittals/:id GET]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * POST /api/submittals - Create new submittal
 */
router.post('/', authMiddleware, upload.array('files'), async (req, res) => {
  const {
    submittalNumber, title, description, type, trade,
    projectId, reviewerId, priority, dueDate
  } = req.body;

  if (!submittalNumber || !title || !type) {
    return res.status(400).json({ message: 'Submittal number, title, and type are required' });
  }

  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO submittals (
        organization_id, company_id, project_id,
        submittal_number, title, description, type, trade,
        submitted_by, reviewer_id, priority, due_date,
        submitted_by_company, status, revision_number
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'pending', 1)
       RETURNING *`,
      [
        req.user.organization_id,
        req.user.company_id,
        projectId || null,
        submittalNumber,
        title,
        description || null,
        type,
        trade || null,
        req.user.id,
        reviewerId || null,
        priority || 'medium',
        dueDate || null,
        null
      ]
    );

    // Upload files if any
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        await client.query(
          `INSERT INTO submittal_attachments (submittal_id, file_name, file_path, file_size, file_type, uploaded_by)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            rows[0].id,
            file.originalname,
            file.path,
            file.size,
            file.mimetype,
            req.user.id
          ]
        );
      }
    }

    await client.query('COMMIT');

    logAudit({
      auth: req.user,
      action: 'create',
      entityType: 'submittals',
      entityId: rows[0].id,
      newData: { submittal_number: submittalNumber, title, type }
    });

    res.status(201).json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[submittals POST]', err);
    if (err.code === '23505') {
      return res.status(409).json({ message: 'Submittal number already exists' });
    }
    res.status(500).json({ message: 'Server error' });
  } finally {
    client.release();
  }
});

/**
 * PUT /api/submittals/:id - Update submittal (including review)
 */
router.put('/:id', authMiddleware, async (req, res) => {
  const {
    status, reviewerId, responseNotes, priority, dueDate, title, description
  } = req.body;

  try {
    const updateFields = [];
    const values = [];
    let paramIndex = 1;

    if (status !== undefined) {
      updateFields.push(`status = $${paramIndex}`);
      values.push(status);
      paramIndex++;
      if (status === 'approved' || status === 'approved-with-comments' || status === 'rejected') {
        updateFields.push(`reviewed_date = NOW()`);
      }
    }

    if (reviewerId !== undefined) {
      updateFields.push(`reviewer_id = $${paramIndex}`);
      values.push(reviewerId);
      paramIndex++;
    }

    if (responseNotes !== undefined) {
      updateFields.push(`response_notes = $${paramIndex}`);
      values.push(responseNotes);
      paramIndex++;
    }

    if (priority !== undefined) {
      updateFields.push(`priority = $${paramIndex}`);
      values.push(priority);
      paramIndex++;
    }

    if (dueDate !== undefined) {
      updateFields.push(`due_date = $${paramIndex}`);
      values.push(dueDate);
      paramIndex++;
    }

    if (title !== undefined) {
      updateFields.push(`title = $${paramIndex}`);
      values.push(title);
      paramIndex++;
    }

    if (description !== undefined) {
      updateFields.push(`description = $${paramIndex}`);
      values.push(description);
      paramIndex++;
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    updateFields.push(`updated_at = NOW()`);
    values.push(req.params.id);
    values.push(req.user.company_id);

    const { rows } = await pool.query(
      `UPDATE submittals SET ${updateFields.join(', ')}
       WHERE id = $${paramIndex} AND COALESCE(organization_id, company_id) = $${paramIndex + 1}
       RETURNING *`,
      values
    );

    if (!rows.length) {
      return res.status(404).json({ message: 'Submittal not found' });
    }

    logAudit({
      auth: req.user,
      action: 'update',
      entityType: 'submittals',
      entityId: req.params.id,
      newData: { status, reviewer_id: reviewerId }
    }).catch(err => {
      console.error('[submittals PUT] logAudit error:', err.message);
    });

    res.json(rows[0]);
  } catch (err) {
    console.error('[submittals PUT]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * DELETE /api/submittals/:id - Delete submittal
 */
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    // Get attachments first to delete files
    const attachments = await pool.query(
      'SELECT file_path FROM submittal_attachments WHERE submittal_id = $1',
      [req.params.id]
    );

    await pool.query('DELETE FROM submittals WHERE id = $1 AND COALESCE(organization_id, company_id) = $2', [req.params.id, req.user.company_id]);

    // Delete physical files
    for (const attachment of attachments.rows) {
      try {
        try {
          const safePath = resolveSafePath(attachment.file_path);
          if (fs.existsSync(safePath)) {
            fs.unlinkSync(safePath);
          }
        } catch (safeErr) {
        }
      } catch (err) {
        console.error('[submittals DELETE] Failed to delete file:', attachment.file_path, safeErr||err);
      }
    }

    logAudit({
      auth: req.user,
      action: 'delete',
      entityType: 'submittals',
      entityId: req.params.id
    });

    res.json({ message: 'Submittal deleted' });
  } catch (err) {
    console.error('[submittals DELETE]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * POST /api/submittals/:id/comments - Add comment to submittal
 */
router.post('/:id/comments', authMiddleware, async (req, res) => {
  const { comment, isReviewComment, requiresResponse } = req.body;

  if (!comment) {
    return res.status(400).json({ message: 'Comment is required' });
  }

  try {
    // Verify submittal belongs to user's company before adding comment
    const submittal = await pool.query(
      `SELECT id FROM submittals WHERE id = $1 AND COALESCE(organization_id, company_id) = $2`,
      [req.params.id, req.user.company_id]
    );
    if (!submittal.rows.length) {
      return res.status(404).json({ message: 'Submittal not found' });
    }

    const { rows } = await pool.query(
      `INSERT INTO submittal_comments (submittal_id, author_id, author_name, comment, is_review_comment, requires_response)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        req.params.id,
        req.user.id,
        req.user.name || '',
        comment,
        isReviewComment || false,
        requiresResponse || false
      ]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[submittals/:id/comments POST]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * GET /api/submittals/stats - Get submittal statistics
 */
router.get('/stats/summary', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'under-review' THEN 1 END) as under_review,
        COUNT(CASE WHEN status IN ('approved', 'approved-with-comments') THEN 1 END) as approved,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected,
        COUNT(CASE WHEN status = 'resubmit-required' THEN 1 END) as resubmit_required,
        COUNT(CASE WHEN due_date < NOW() AND status NOT IN ('approved', 'approved-with-comments', 'cancelled') THEN 1 END) as overdue
       FROM submittals
       WHERE COALESCE(organization_id, company_id) = $1`,
      [req.user.company_id]
    );

    res.json(rows[0]);
  } catch (err) {
    console.error('[submittals/stats GET]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

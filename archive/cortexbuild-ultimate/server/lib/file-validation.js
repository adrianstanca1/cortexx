/**
 * Centralized file validation utilities for secure file uploads
 * Provides magic number validation to prevent extension spoofing attacks
 */

const path = require('path');

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
  webp: '52494646', // RIFF header, need to check WEBP at offset 8
};

/**
 * Detect file type from buffer magic numbers
 * @param {Buffer} buffer - First bytes of file (at least 16 bytes recommended)
 * @returns {string|null} - Detected file type or null if unknown
 */
function getFileTypeFromBuffer(buffer) {
  const hex = buffer.toString('hex').substring(0, 16).toLowerCase();
  if (hex.startsWith(MAGIC_NUMBERS.pdf)) return 'pdf';
  if (hex.startsWith(MAGIC_NUMBERS.png)) return 'png';
  if (hex.startsWith(MAGIC_NUMBERS.jpg)) return 'jpg';
  if (hex.startsWith(MAGIC_NUMBERS.gif)) return 'gif';
  if (hex.startsWith(MAGIC_NUMBERS.zip)) return 'zip'; // Also matches docx, xlsx
  if (hex.startsWith(MAGIC_NUMBERS.dwg)) return 'dwg';
  // WebP: RIFF....WEBP
  if (hex.startsWith(MAGIC_NUMBERS.webp) && hex.substring(16, 24) === '57454250') return 'webp';
  return null;
}

/**
 * Validate file content matches expected type based on extension
 * @param {Buffer} buffer - File buffer chunk
 * @param {string} extension - File extension (e.g., '.pdf')
 * @returns {object} - { valid: boolean, detectedType: string|null, message: string }
 */
function validateFileContent(buffer, extension) {
  const detectedType = getFileTypeFromBuffer(buffer);
  const ext = extension.toLowerCase();

  // For text-based formats (IFC, STEP), we can't validate via magic numbers
  if (['.ifc', '.step', '.stp'].includes(ext)) {
    const textStart = buffer.toString('utf8', 0, 100);
    if (textStart.includes('ISO-10303')) {
      return { valid: true, detectedType: 'step', message: 'Valid STEP/IFC file' };
    }
    return { valid: false, detectedType: null, message: 'Invalid STEP/IFC file content' };
  }

  // Extension to expected type mapping
  const extToType = {
    '.pdf': 'pdf',
    '.png': 'png',
    '.jpg': 'jpg',
    '.jpeg': 'jpg',
    '.gif': 'gif',
    '.webp': 'webp',
    '.zip': 'zip',
    '.docx': 'zip', // DOCX is ZIP-based
    '.xlsx': 'zip', // XLSX is ZIP-based
    '.dwg': 'dwg',
  };

  const expectedType = extToType[ext];
  if (!expectedType) {
    return { valid: true, detectedType: null, message: 'Unknown extension type, skipping validation' };
  }

  if (!detectedType) {
    // Some formats may not be detected (e.g., plain text files)
    return { valid: true, detectedType: null, message: 'Could not detect file type, allowing based on extension' };
  }

  // ZIP-based formats need special handling
  if (detectedType === 'zip' && ['.docx', '.xlsx', '.zip'].includes(ext)) {
    return { valid: true, detectedType: 'zip', message: 'Valid ZIP-based file' };
  }

  if (detectedType !== expectedType) {
    return {
      valid: false,
      detectedType,
      message: `File content (${detectedType}) does not match extension (${ext})`
    };
  }

  return { valid: true, detectedType, message: 'File content validated' };
}

/**
 * Async file filter for multer that validates file content
 * @param {Object} file - Multer file object
 * @param {Set} allowedExtensions - Set of allowed extensions
 * @param {Function} callback - Multer callback
 */
async function validateFileWithMagicNumbers(file, allowedExtensions, callback) {
  const ext = path.extname(file.originalname).toLowerCase();

  if (!allowedExtensions.has(ext)) {
    return callback(new Error(`File extension not allowed: ${ext}`), false);
  }

  // Read first chunk for magic number validation
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

  const validation = validateFileContent(chunk, ext);

  if (!validation.valid) {
    return callback(new Error(validation.message), false);
  }

  // Reset stream for multer
  file.stream.unshift(chunk);
  callback(null, true);
}

module.exports = {
  MAGIC_NUMBERS,
  getFileTypeFromBuffer,
  validateFileContent,
  validateFileWithMagicNumbers,
};

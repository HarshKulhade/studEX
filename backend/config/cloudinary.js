'use strict';

const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// ── Configure Cloudinary SDK ──────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// ── Reusable factory: create a Multer upload middleware ──
/**
 * @param {string} folder  - Cloudinary folder path (e.g. 'student-ids')
 * @param {string[]} allowedFormats - e.g. ['jpg', 'png', 'pdf']
 * @param {number} maxSizeMB - max file size in MB (default 5)
 * @returns multer middleware instance
 */
const createUploader = (folder, allowedFormats = ['jpg', 'jpeg', 'png'], maxSizeMB = 5) => {
  const storage = new CloudinaryStorage({
    cloudinary,
    params: {
      folder,
      allowed_formats: allowedFormats,
      resource_type: 'auto',         // handles images, PDFs, etc.
      use_filename: true,
      unique_filename: true,
    },
  });

  return multer({
    storage,
    limits: { fileSize: maxSizeMB * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const ext = file.originalname.split('.').pop().toLowerCase();
      if (!allowedFormats.includes(ext)) {
        return cb(new Error(`File type '${ext}' is not supported. Allowed: ${allowedFormats.join(', ')}`));
      }
      cb(null, true);
    },
  });
};

// ── Pre-built uploaders ───────────────────────────

/** For student college ID images */
const collegeIdUploader = createUploader('student-super-app/college-ids', ['jpg', 'jpeg', 'png'], 5);

/** For vendor logos */
const logoUploader = createUploader('student-super-app/vendor-logos', ['jpg', 'jpeg', 'png', 'webp'], 2);

/** For student avatars */
const avatarUploader = createUploader('student-super-app/avatars', ['jpg', 'jpeg', 'png', 'webp'], 2);

/** For print documents */
const documentUploader = createUploader(
  'student-super-app/print-docs',
  ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx'],
  20
);

module.exports = {
  cloudinary,
  createUploader,
  collegeIdUploader,
  logoUploader,
  avatarUploader,
  documentUploader,
};

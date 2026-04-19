'use strict';

const PrintJob = require('../models/PrintJob');
const CashbackWallet = require('../models/CashbackWallet');
const Transaction = require('../models/Transaction');
const ApiResponse = require('../utils/ApiResponse');
const { documentUploader } = require('../config/cloudinary');
const { filterByRadius } = require('../utils/geoFilter');

// ── Pricing constants ──────────────────────────────
const PRINT_PRICE = {
  bw: 2,    // ₹2 per page (black & white)
  color: 8, // ₹8 per page (colour)
};
const CASHBACK_RATE = 0.10; // 10% of total cost

// ── Sample kiosks (MVP hardcoded data) ────────────
const SAMPLE_KIOSKS = [
  {
    id: 'kiosk-001',
    name: 'UniPrint — Main Gate',
    address: 'Shop 12, Main Gate Complex, Anna Nagar, Chennai - 600040',
    location: { type: 'Point', coordinates: [80.2095, 13.0847] },
    operatingHours: '8:00 AM – 9:00 PM',
    phone: '9876543210',
    supportedFormats: ['PDF', 'DOCX', 'JPG', 'PNG'],
    paperSizes: ['A4', 'A5', 'Legal'],
  },
  {
    id: 'kiosk-002',
    name: 'CampusCopy — Engineering Block',
    address: 'Near Canteen, Engineering Block, T. Nagar, Chennai - 600017',
    location: { type: 'Point', coordinates: [80.2341, 13.0418] },
    operatingHours: '9:00 AM – 8:00 PM',
    phone: '9123456780',
    supportedFormats: ['PDF', 'JPG', 'PNG'],
    paperSizes: ['A4', 'A5'],
  },
  {
    id: 'kiosk-003',
    name: 'QuickPrint Hub — Library Road',
    address: '45, Library Road, Guindy, Chennai - 600032',
    location: { type: 'Point', coordinates: [80.2208, 13.0067] },
    operatingHours: '7:30 AM – 10:00 PM',
    phone: '9988776655',
    supportedFormats: ['PDF', 'DOCX', 'XLSX', 'JPG', 'PNG'],
    paperSizes: ['A4', 'A5', 'Legal'],
  },
];

// ─────────────────────────────────────────────────
//  POST /api/print/upload
// ─────────────────────────────────────────────────
const uploadDocument = [
  documentUploader.single('document'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return ApiResponse.error(res, 400, 'No file uploaded. Please attach a document.');
      }

      const fileUrl = req.file.path;
      const fileName = req.file.originalname;
      const mimeType = req.file.mimetype;

      let pageCount = 1;
      if (mimeType === 'application/pdf') {
        try {
          pageCount = req.file.pages || 1;
        } catch (_pdfErr) {
          pageCount = 1;
        }
      }

      return ApiResponse.success(res, 200, 'Document uploaded successfully', {
        fileUrl,
        fileName,
        mimeType,
        pageCount,
        size: req.file.size,
        cloudinaryPublicId: req.file.filename,
      });
    } catch (err) {
      next(err);
    }
  },
];

// ─────────────────────────────────────────────────
//  POST /api/print/book
// ─────────────────────────────────────────────────
const bookPrintJob = async (req, res, next) => {
  try {
    const { fileUrl, fileName, pageCount, printType, copies, paperSize, kioskId, slotTime } = req.body;

    const pages = parseInt(pageCount, 10) || 1;
    const numCopies = parseInt(copies, 10) || 1;

    if (!['bw', 'color'].includes(printType)) {
      return ApiResponse.error(res, 400, 'printType must be "bw" or "color".');
    }

    const pricePerPage = PRINT_PRICE[printType];
    const totalCost = pages * numCopies * pricePerPage;
    const cashbackEarned = Math.round(totalCost * CASHBACK_RATE * 100) / 100;

    const kiosk = SAMPLE_KIOSKS.find((k) => k.id === kioskId) || null;
    if (!kiosk) {
      return ApiResponse.error(res, 400, `Kiosk with ID '${kioskId}' not found.`);
    }

    const printJob = await PrintJob.create({
      student: req.user._id,
      fileUrl,
      fileName,
      pageCount: pages,
      printType,
      copies: numCopies,
      paperSize: paperSize || 'A4',
      kiosk: { name: kiosk.name, address: kiosk.address, location: kiosk.location },
      status: 'queued',
      totalCost,
      cashbackEarned,
      slotTime: slotTime ? new Date(slotTime) : null,
    });

    // Credit cashback to wallet
    if (cashbackEarned > 0) {
      let wallet = await CashbackWallet.findOne({ student: req.user._id });
      if (!wallet) {
        wallet = await CashbackWallet.create({ student: req.user._id });
      }

      wallet.balance += cashbackEarned;
      wallet.totalEarned += cashbackEarned;
      await CashbackWallet.save(wallet);

      await Transaction.create({
        wallet: wallet._id,
        student: req.user._id,
        type: 'credit',
        amount: cashbackEarned,
        source: 'print_job',
        referenceId: printJob._id,
        description: `Cashback for print job: ${fileName} (${pages} pages × ${numCopies} copies)`,
      });
    }

    return ApiResponse.success(res, 201, 'Print job booked successfully', {
      printJobId: printJob._id,
      fileName,
      totalCost,
      cashbackEarned,
      status: printJob.status,
      kiosk: { name: kiosk.name, address: kiosk.address },
      slotTime: printJob.slotTime,
      costBreakdown: {
        pricePerPage,
        pages,
        copies: numCopies,
        totalCost,
        cashbackRate: `${CASHBACK_RATE * 100}%`,
        cashbackEarned,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────
//  GET /api/print/my-jobs
// ─────────────────────────────────────────────────
const getMyPrintJobs = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));

    const query = { student: req.user._id };
    if (req.query.status) query.status = req.query.status;

    const allJobs = await PrintJob.find(query);
    const total = allJobs.length;
    const jobs = allJobs.slice((page - 1) * limit, (page - 1) * limit + limit);

    return ApiResponse.paginated(res, 200, 'Print jobs fetched', jobs, { page, limit, total });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────
//  GET /api/print/kiosks
// ─────────────────────────────────────────────────
const getKiosks = async (req, res, next) => {
  try {
    const { lat, lng, radius } = req.query;

    if (lat && lng) {
      const refLat = parseFloat(lat);
      const refLng = parseFloat(lng);
      const maxRadius = parseInt(radius, 10) || 5000;

      if (isNaN(refLat) || isNaN(refLng)) {
        return ApiResponse.error(res, 400, 'lat and lng must be valid numbers.');
      }

      const nearby = filterByRadius(SAMPLE_KIOSKS, refLat, refLng, maxRadius);
      const kiosksWithDistance = nearby.map(({ item, distanceMetres }) => ({
        ...item,
        distanceMetres: Math.round(distanceMetres),
      }));

      return ApiResponse.success(res, 200, `${kiosksWithDistance.length} kiosks found nearby`, kiosksWithDistance);
    }

    return ApiResponse.success(res, 200, 'All available kiosks', SAMPLE_KIOSKS);
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────
//  PUT /api/print/:id/status
// ─────────────────────────────────────────────────
const updatePrintJobStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'queued', 'printing', 'completed', 'failed'];

    if (!status || !validStatuses.includes(status)) {
      return ApiResponse.error(res, 400, `Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    const printJob = await PrintJob.findByIdAndUpdate(req.params.id, { status });

    if (!printJob) {
      return ApiResponse.error(res, 404, 'Print job not found.');
    }

    return ApiResponse.success(res, 200, `Print job status updated to '${status}'`, {
      printJobId: printJob._id,
      status: printJob.status,
      updatedAt: new Date(),
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  uploadDocument,
  bookPrintJob,
  getMyPrintJobs,
  getKiosks,
  updatePrintJobStatus,
};

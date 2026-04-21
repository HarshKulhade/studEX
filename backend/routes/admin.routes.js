'use strict';

const express = require('express');
const router = express.Router();
const { protectAdmin } = require('../middleware/adminAuth');
const {
  getStats,
  getAllDeals,
  adminCreateDeal,
  adminUpdateDeal,
  adminDeleteDeal,
  getAllUsers,
  adminVerifyUser,
  getAllOpportunities,
  adminCreateOpportunity,
  adminDeleteOpportunity,
} = require('../controllers/admin.controller');

// All admin routes require admin auth
router.use(protectAdmin);

router.get('/stats', getStats);

const { dealCoverUploader } = require('../config/cloudinary');

// Deals
router.get('/deals', getAllDeals);
router.post('/deals', dealCoverUploader.single('coverImage'), adminCreateDeal);
router.put('/deals/:id', dealCoverUploader.single('coverImage'), adminUpdateDeal);
router.delete('/deals/:id', adminDeleteDeal);

// Users
router.get('/users', getAllUsers);
router.put('/users/:id/verify', adminVerifyUser);

// Opportunities
router.get('/opportunities', getAllOpportunities);
router.post('/opportunities', adminCreateOpportunity);
router.delete('/opportunities/:id', adminDeleteOpportunity);

module.exports = router;

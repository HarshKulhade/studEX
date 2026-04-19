'use strict';

const Opportunity = require('../models/Opportunity');
const ApiResponse = require('../utils/ApiResponse');

// ─────────────────────────────────────────────────
//  GET /api/opportunities
// ─────────────────────────────────────────────────
const getOpportunities = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));

    const query = { isActive: true };
    if (req.query.type) query.type = req.query.type;

    const studentCollege = req.user ? req.user.college : req.query.college;
    if (studentCollege) query._collegeFilter = studentCollege;

    const allOpportunities = await Opportunity.find(query);
    const total = allOpportunities.length;
    const opportunities = allOpportunities.slice((page - 1) * limit, (page - 1) * limit + limit);

    return ApiResponse.paginated(res, 200, 'Opportunities fetched', opportunities, { page, limit, total });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────
//  GET /api/opportunities/:id
// ─────────────────────────────────────────────────
const getOpportunityById = async (req, res, next) => {
  try {
    const opportunity = await Opportunity.findOne({ _id: req.params.id, isActive: true });

    if (!opportunity) {
      return ApiResponse.error(res, 404, 'Opportunity not found or is no longer active.');
    }

    return ApiResponse.success(res, 200, 'Opportunity fetched', opportunity);
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────
//  POST /api/opportunities
// ─────────────────────────────────────────────────
const createOpportunity = async (req, res, next) => {
  try {
    const {
      postedBy,
      title,
      type,
      description,
      location,
      isRemote,
      stipend,
      stipendType,
      applicationLink,
      deadline,
      targetColleges,
    } = req.body;

    const opportunity = await Opportunity.create({
      postedBy,
      title,
      type,
      description,
      location,
      isRemote: isRemote || false,
      stipend: stipend ? parseFloat(stipend) : null,
      stipendType: stipendType || 'monthly',
      applicationLink,
      deadline: deadline ? new Date(deadline) : null,
      targetColleges: Array.isArray(targetColleges) ? targetColleges : [],
    });

    return ApiResponse.success(res, 201, 'Opportunity posted successfully', opportunity);
  } catch (err) {
    next(err);
  }
};

module.exports = { getOpportunities, getOpportunityById, createOpportunity };

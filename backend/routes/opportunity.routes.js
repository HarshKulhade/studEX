'use strict';

const express = require('express');
const { body } = require('express-validator');

const router = express.Router();
const {
  getOpportunities,
  getOpportunityById,
  createOpportunity,
} = require('../controllers/opportunity.controller');
const { protectStudent } = require('../middleware/auth');
const validate = require('../middleware/validate');

// GET /api/opportunities  — optionally authenticated (student JWT for college filtering)
// We use an optional auth approach: try to extract user, but don't block unauthenticated access
router.get('/', (req, res, next) => {
  // Attach user if JWT present, otherwise pass through
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }
  return protectStudent(req, res, next);
}, getOpportunities);

// GET /api/opportunities/:id
router.get('/:id', getOpportunityById);

// POST /api/opportunities  — No auth for MVP (admin-only in future)
const createOpportunityValidator = [
  body('postedBy').trim().notEmpty().withMessage('postedBy (company/org name) is required'),
  body('title')
    .trim()
    .notEmpty().withMessage('Title is required')
    .isLength({ max: 150 }).withMessage('Title cannot exceed 150 characters'),
  body('type')
    .isIn(['internship', 'part-time', 'freelance', 'event', 'hackathon'])
    .withMessage('Type must be: internship, part-time, freelance, event, or hackathon'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('applicationLink')
    .optional()
    .isURL().withMessage('applicationLink must be a valid URL'),
  body('deadline')
    .optional()
    .isISO8601().withMessage('deadline must be a valid ISO 8601 date'),
  body('stipend')
    .optional()
    .isFloat({ min: 0 }).withMessage('stipend must be a positive number'),
  body('stipendType')
    .optional()
    .isIn(['monthly', 'weekly', 'one-time', 'unpaid'])
    .withMessage('stipendType must be: monthly, weekly, one-time, or unpaid'),
  body('targetColleges')
    .optional()
    .isArray().withMessage('targetColleges must be an array of strings'),
];

router.post('/', createOpportunityValidator, validate, createOpportunity);

module.exports = router;

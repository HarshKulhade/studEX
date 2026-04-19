'use strict';

const { validationResult } = require('express-validator');

/**
 * Middleware wrapper that runs after express-validator chains.
 *
 * If there are validation errors, it immediately returns a 400 response
 * with the full errors array. Otherwise it calls next() to continue.
 *
 * Usage:
 *   router.post('/register', [...validationChain], validate, controller);
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed. Please check your input.',
      errors: errors.array().map((e) => ({
        field: e.path || e.param,
        message: e.msg,
        value: e.value,
      })),
    });
  }

  next();
};

module.exports = validate;

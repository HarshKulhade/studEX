'use strict';

/**
 * Global error handler middleware.
 *
 * Must be registered last in Express (after all routes).
 * Converts known error types into consistent API responses and
 * never exposes stack traces in production.
 *
 * @param {Error} err
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const errorHandler = (err, req, res, next) => { // eslint-disable-line no-unused-vars
  const isProduction = process.env.NODE_ENV === 'production';

  // Default error shape
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let errors = [];

  // ── Mongoose: Invalid ObjectId ────────────────
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid ${err.path}: '${err.value}' is not a valid ID format.`;
  }

  // ── Mongoose: Schema validation failed ────────
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation failed';
    errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
  }

  // ── MongoDB: Duplicate key ─────────────────────
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    const value = err.keyValue ? err.keyValue[field] : '';
    message = `An account with this ${field} ('${value}') already exists.`;
  }

  // ── JWT: Invalid token ────────────────────────
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token. Please log in again.';
  }

  // ── JWT: Expired token ────────────────────────
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Your session has expired. Please log in again.';
  }

  // ── Multer: File size exceeded ────────────────
  if (err.code === 'LIMIT_FILE_SIZE') {
    statusCode = 400;
    message = 'File size exceeds the allowed limit.';
  }

  // ── Build response body ───────────────────────
  const body = {
    success: false,
    message,
  };

  if (errors.length > 0) {
    body.errors = errors;
  }

  // Only expose stack in development
  if (!isProduction && err.stack) {
    body.stack = err.stack;
  }

  return res.status(statusCode).json(body);
};

module.exports = errorHandler;

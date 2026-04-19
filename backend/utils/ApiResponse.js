'use strict';

/**
 * Standardised API response helpers.
 *
 * Usage (success):
 *   ApiResponse.success(res, 201, 'User created', { user });
 *
 * Usage (error):
 *   ApiResponse.error(res, 400, 'Validation failed', [{ msg: '...' }]);
 *
 * Usage (paginated):
 *   ApiResponse.paginated(res, 200, 'Deals fetched', items, { page, limit, total });
 */
class ApiResponse {
  /**
   * Send a successful response.
   * @param {import('express').Response} res
   * @param {number} statusCode
   * @param {string} message
   * @param {*} data
   */
  static success(res, statusCode = 200, message = 'Operation successful', data = null) {
    const body = { success: true, message };
    if (data !== null && data !== undefined) body.data = data;
    return res.status(statusCode).json(body);
  }

  /**
   * Send an error response.
   * @param {import('express').Response} res
   * @param {number} statusCode
   * @param {string} message
   * @param {Array} [errors=[]]
   */
  static error(res, statusCode = 500, message = 'An error occurred', errors = []) {
    const body = { success: false, message };
    if (errors && errors.length > 0) body.errors = errors;
    return res.status(statusCode).json(body);
  }

  /**
   * Send a paginated list response.
   * @param {import('express').Response} res
   * @param {number} statusCode
   * @param {string} message
   * @param {Array} items
   * @param {{ page: number, limit: number, total: number }} pagination
   */
  static paginated(res, statusCode = 200, message = 'Data fetched', items = [], pagination = {}) {
    const { page = 1, limit = 10, total = 0 } = pagination;
    return res.status(statusCode).json({
      success: true,
      message,
      data: items,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    });
  }
}

module.exports = ApiResponse;

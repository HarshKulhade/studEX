'use strict';

const QRCode = require('qrcode');

/**
 * Generate a QR code from a string token and return it as a Base64 PNG data URL.
 *
 * @param {string} token - The data to encode in the QR (e.g. a UUID redemption token)
 * @returns {Promise<string>} Base64 PNG data URL (data:image/png;base64,...)
 */
const generateQRBase64 = async (token) => {
  try {
    const dataUrl = await QRCode.toDataURL(token, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      quality: 0.95,
      margin: 2,
      color: {
        dark: '#1a1a2e',  // dark navy foreground
        light: '#ffffff', // white background
      },
      width: 300,
    });
    return dataUrl; // data:image/png;base64,iVBOR...
  } catch (err) {
    throw new Error(`QR generation failed: ${err.message}`);
  }
};

/**
 * Generate a QR code and return it as a raw Base64 string (without the data-URL prefix).
 *
 * @param {string} token
 * @returns {Promise<string>} raw Base64 PNG string
 */
const generateQRBase64Raw = async (token) => {
  const dataUrl = await generateQRBase64(token);
  // strip "data:image/png;base64," prefix
  return dataUrl.split(',')[1];
};

module.exports = { generateQRBase64, generateQRBase64Raw };

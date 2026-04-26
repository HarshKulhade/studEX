'use strict';

const nodemailer = require('nodemailer');

// ── Transporter (created once, reused) ───────────
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT, 10) || 587,
    secure: false, // STARTTLS (port 587)
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production',
    },
  });
};

let transporter = null;

const getTransporter = () => {
  if (!transporter) {
    transporter = createTransporter();
  }
  return transporter;
};

// ── Low-level send helper ─────────────────────────
/**
 * Send a generic email.
 * @param {{ to: string, subject: string, html: string, text?: string }} options
 */
const sendEmail = async ({ to, subject, html, text }) => {
  const t = getTransporter();
  await t.sendMail({
    from: `"StudEX" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
    text,
  });
};

// ── OTP Email ─────────────────────────────────────
/**
 * Send a 6-digit OTP to the student's email address.
 * @param {string} to     - recipient email
 * @param {string} otp    - the 6-digit OTP string
 * @param {string} name   - recipient's first name (for personalisation)
 */
const sendOTPEmail = async (to, otp, name = 'Student') => {
  const otpDigits = otp.split('').map(d => `
    <td style="width:48px;height:56px;text-align:center;vertical-align:middle;background:#F7F4EF;border:2px solid #D4A017;border-radius:8px;font-family:'Courier New',Courier,monospace;font-size:28px;font-weight:700;color:#1C1917;letter-spacing:0;">${d}</td>
  `).join('<td style="width:8px;"></td>');

  const html = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Verify Your Email — StudEX</title>
  </head>
  <body style="margin:0;padding:0;background:#E8E4DF;font-family:Georgia,'Times New Roman',Times,serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#E8E4DF;">
      <tr>
        <td align="center" style="padding:40px 16px;">
          <table width="600" cellpadding="0" cellspacing="0" style="background:#F7F4EF;overflow:hidden;box-shadow:0 2px 24px rgba(28,25,23,0.12);">
            <!-- Header -->
            <tr>
              <td style="background:#1C1917;padding:32px 40px;text-align:center;">
                <h1 style="color:#D4A017;margin:0;font-family:'Courier New',Courier,monospace;font-size:32px;font-weight:900;letter-spacing:6px;text-transform:uppercase;">STUDEX</h1>
                <p style="color:rgba(255,255,255,0.5);margin:10px 0 0;font-family:'Courier New',Courier,monospace;font-size:10px;letter-spacing:3px;text-transform:uppercase;">The Student Exchange</p>
              </td>
            </tr>
            <!-- Divider line -->
            <tr>
              <td style="padding:0 40px;">
                <div style="border-top:3px solid #1C1917;border-bottom:1px solid #1C1917;height:4px;margin:0;"></div>
              </td>
            </tr>
            <!-- Body -->
            <tr>
              <td style="padding:40px 40px 16px;">
                <p style="font-family:'Courier New',Courier,monospace;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#78716C;margin:0 0 8px;">Email Verification</p>
                <h2 style="color:#1C1917;margin:0 0 20px;font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:700;line-height:1.3;">Hi ${name},</h2>
                <p style="color:#44403C;margin:0 0 32px;line-height:1.7;font-size:15px;">
                  Use the one-time verification code below to confirm your email address and activate your StudEX account. This code is valid for <strong style="color:#1C1917;">10 minutes</strong>.
                </p>
              </td>
            </tr>
            <!-- OTP Box -->
            <tr>
              <td style="padding:0 40px 32px;">
                <div style="background:#1C1917;border-radius:12px;padding:32px 24px;text-align:center;">
                  <p style="margin:0 0 16px;font-family:'Courier New',Courier,monospace;font-size:10px;letter-spacing:4px;text-transform:uppercase;color:#D4A017;font-weight:700;">Your Verification Code</p>
                  <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
                    <tr>${otpDigits}</tr>
                  </table>
                  <p style="margin:16px 0 0;font-family:'Courier New',Courier,monospace;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.35);">Expires in 10 minutes</p>
                </div>
              </td>
            </tr>
            <!-- Security note -->
            <tr>
              <td style="padding:0 40px 40px;">
                <div style="border-top:1px solid #D6D3CF;padding-top:20px;">
                  <p style="color:#78716C;font-size:13px;margin:0;line-height:1.6;">
                    If you didn't create a StudEX account, you can safely ignore this email. Your information remains secure.
                  </p>
                </div>
              </td>
            </tr>
            <!-- Footer -->
            <tr>
              <td style="background:#1C1917;padding:24px 40px;text-align:center;">
                <p style="margin:0 0 4px;font-family:'Courier New',Courier,monospace;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#D4A017;font-weight:700;">STUDEX</p>
                <p style="margin:0;font-family:'Courier New',Courier,monospace;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.3);">© ${new Date().getFullYear()} StudEX · All rights reserved</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;

  await sendEmail({
    to,
    subject: `${otp} — Your StudEX verification code`,
    html,
    text: `Hi ${name}, your StudEX verification code is: ${otp}. It expires in 10 minutes.`,
  });
};

/**
 * Send a vendor registration notification email (to admin).
 * @param {string} adminEmail
 * @param {{ businessName: string, ownerName: string, email: string, phone: string }} vendor
 */
const sendVendorRegistrationAlert = async (adminEmail, vendor) => {
  const html = `
  <h2>New Vendor Registration — Action Required</h2>
  <p>A new vendor has registered and is awaiting approval:</p>
  <ul>
    <li><strong>Business Name:</strong> ${vendor.businessName}</li>
    <li><strong>Owner:</strong> ${vendor.ownerName}</li>
    <li><strong>Email:</strong> ${vendor.email}</li>
    <li><strong>Phone:</strong> ${vendor.phone}</li>
  </ul>
  <p>Please review and approve/reject via the Admin Panel.</p>
  `;

  await sendEmail({
    to: adminEmail,
    subject: `New Vendor Registration: ${vendor.businessName}`,
    html,
    text: `New vendor registered: ${vendor.businessName} (${vendor.email}). Approve via admin panel.`,
  });
};

/**
 * Generate a random 6-digit OTP string.
 * @returns {string}
 */
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

module.exports = { sendEmail, sendOTPEmail, sendVendorRegistrationAlert, generateOTP };

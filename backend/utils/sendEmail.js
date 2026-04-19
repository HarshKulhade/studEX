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
    from: `"Student Super App" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
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
  const html = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Email Verification — Student Super App</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="padding:40px 0;">
          <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
            <!-- Header -->
            <tr>
              <td style="background:linear-gradient(135deg,#6c63ff,#4fc3f7);padding:30px;text-align:center;">
                <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:700;">🎓 Student Super App</h1>
                <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">Your Campus. Your Perks. Amplified.</p>
              </td>
            </tr>
            <!-- Body -->
            <tr>
              <td style="padding:40px 32px;">
                <h2 style="color:#1a1a2e;margin:0 0 16px;font-size:20px;">Hi ${name} 👋</h2>
                <p style="color:#555;margin:0 0 24px;line-height:1.6;">
                  Use the one-time password (OTP) below to verify your email address.
                  This code expires in <strong>10 minutes</strong>.
                </p>
                <!-- OTP box -->
                <div style="background:#f8f6ff;border:2px dashed #6c63ff;border-radius:10px;padding:24px;text-align:center;margin:0 0 24px;">
                  <p style="margin:0 0 8px;color:#6c63ff;font-size:13px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Your OTP</p>
                  <span style="font-size:42px;font-weight:700;letter-spacing:10px;color:#1a1a2e;">${otp}</span>
                </div>
                <p style="color:#888;font-size:13px;margin:0;">
                  If you did not request this, please ignore this email. Your account remains secure.
                </p>
              </td>
            </tr>
            <!-- Footer -->
            <tr>
              <td style="background:#f8f8f8;padding:20px 32px;text-align:center;border-top:1px solid #eee;">
                <p style="margin:0;color:#aaa;font-size:12px;">© ${new Date().getFullYear()} Student Super App. All rights reserved.</p>
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
    subject: `${otp} is your Student Super App verification code`,
    html,
    text: `Your OTP is: ${otp}. It expires in 10 minutes.`,
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

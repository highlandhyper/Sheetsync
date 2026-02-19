
'use server';

import nodemailer from 'nodemailer';

interface ExpiredItemDetails {
    productName: string;
    barcode: string;
    staffName: string;
    expiryDate: Date;
}

// IMPORTANT: CONFIGURE YOUR EMAIL TRANSPORT HERE
// 1. Create environment variables in your .env.local file for your email service credentials
//    EMAIL_SERVER_HOST=smtp.example.com
//    EMAIL_SERVER_PORT=587
//    EMAIL_SERVER_USER=user@example.com
//    EMAIL_SERVER_PASSWORD=your_password
//    EMAIL_SENDER=sender_address@example.com
//    EMAIL_RECIPIENT=recipient_address@example.com
//
// 2. You might need to generate an "App Password" for services like Gmail if 2-Factor Auth is enabled.

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_SERVER_HOST,
  port: Number(process.env.EMAIL_SERVER_PORT || 587),
  secure: (process.env.EMAIL_SERVER_PORT || 587) === '465', // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_SERVER_USER,
    pass: process.env.EMAIL_SERVER_PASSWORD,
  },
});

// The recipient email is now fetched from an environment variable
const RECIPIENT_EMAIL = process.env.EMAIL_RECIPIENT; 

export async function sendExpiredItemNotification(details: ExpiredItemDetails) {
  const { productName, barcode, staffName, expiryDate } = details;

  const mailOptions = {
    from: `SheetSync Notifier <${process.env.EMAIL_SENDER || process.env.EMAIL_SERVER_USER}>`,
    to: RECIPIENT_EMAIL,
    subject: `⚠️ Expired Item Logged: ${productName}`,
    html: `
      <div style="font-family: sans-serif; line-height: 1.6;">
        <h2>Expired Item Alert</h2>
        <p>An item was logged in the inventory system that has already passed its expiry date.</p>
        <h3>Item Details:</h3>
        <ul>
          <li><strong>Product Name:</strong> ${productName}</li>
          <li><strong>Barcode:</strong> ${barcode}</li>
          <li><strong>Expiry Date:</strong> ${expiryDate.toLocaleDateString('en-GB')}</li>
          <li><strong>Logged By:</strong> ${staffName}</li>
        </ul>
        <p>Please review this item in the inventory system.</p>
        <hr>
        <p style="font-size: 0.8em; color: #888;">This is an automated notification from the SheetSync application.</p>
      </div>
    `,
  };

  // For development, we can log to console if email server is not configured
  if (!process.env.EMAIL_SERVER_HOST || !RECIPIENT_EMAIL) {
    console.log('--- EMAIL SIMULATION ---');
    if (!RECIPIENT_EMAIL) {
        console.log("WARNING: EMAIL_RECIPIENT is not set in .env.local. No email will be sent.");
    }
    console.log(`To: ${RECIPIENT_EMAIL || 'not configured'}`);
    console.log(`Subject: ${mailOptions.subject}`);
    console.log('Body:', mailOptions.html.replace(/<[^>]*>/g, '\n').replace(/\n\s*\n/g, '\n'));
    console.log('------------------------');
    console.log('NOTE: Email service is not configured. Please set EMAIL_... variables in .env.local to send real emails.');
    return;
  }

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Expired item notification sent for barcode: ${barcode}`);
  } catch (error) {
    console.error(`Failed to send expired item notification for barcode ${barcode}:`, error);
    // You might want to add more robust error handling here, like a retry mechanism or logging to a different service.
  }
}

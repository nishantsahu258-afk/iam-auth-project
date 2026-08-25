# Implementation Plan: Switch to Gmail Nodemailer

To allow your application to send verification emails to **anyone** for free, we will replace the restrictive `resend` service with `nodemailer` and route the emails through your personal Gmail account.

## Proposed Changes

### 1. Dependencies
- We will run `npm install nodemailer`.
- We will uninstall `resend`.

### 2. Environment Variables
You will need to update your `.env` and Vercel environment variables. We will replace `RESEND_API_KEY` with:
```env
GMAIL_USER=your_email@gmail.com
GMAIL_APP_PASSWORD=your_16_digit_app_password
```

### 3. Updates to `src/server.js`
- Remove all Resend initialization.
- Initialize Nodemailer transporter:
```javascript
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
    }
});
```
- Replace the `resend.emails.send` function with `transporter.sendMail` inside the `/api/register` route, retaining the exact same beautiful HTML email template.

## User Review Required

> [!IMPORTANT]
> **How to get your Gmail App Password:**
> 1. Go to your [Google Account Manage Settings](https://myaccount.google.com/).
> 2. Search for **"App Passwords"** in the top search bar. *(Note: You MUST have 2-Step Verification turned on for your Google account to see this option).*
> 3. Create a new app (call it "SecureID Auth").
> 4. Google will give you a **16-character password**. Copy it.
> 5. Add `GMAIL_USER` and `GMAIL_APP_PASSWORD` to your `.env` file.

Click **Proceed** if you are ready for me to implement this new email system!

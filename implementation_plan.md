# Implement Twilio API for SMS OTP

We will implement real SMS delivery using the **Twilio API**.

## Proposed Changes

### Dependencies
- Install the `twilio` npm package.

### `src/server.js` Updates
1. **Initialize Twilio**:
```javascript
const twilio = require('twilio');
const twilioClient = new twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
```

2. **Send SMS OTP** (`/api/send-sms-otp` and `/api/setup-mfa` for SMS method):
We will replace the current logic with actual Twilio API calls to send the OTP to the user's mobile number:
```javascript
await twilioClient.messages.create({
    body: `Your SecureID Verification Code is ${otp}`,
    from: process.env.TWILIO_PHONE_NUMBER,
    to: user.mobile
});
```

## User Review Required

> [!IMPORTANT]
> To use Twilio, you need a free Twilio account.
> 1. Sign up at [Twilio.com](https://www.twilio.com/) (if you don't have an account).
> 2. Get a trial phone number.
> 3. Verify the mobile number you are going to use for testing (Twilio trial accounts can only send SMS to verified numbers).
> 4. Add the following to your `.env` file:
> ```env
> TWILIO_ACCOUNT_SID=your_account_sid
> TWILIO_AUTH_TOKEN=your_auth_token
> TWILIO_PHONE_NUMBER=your_twilio_phone_number
> ```

Click **Proceed** when you have added your Twilio credentials to the `.env` file and are ready for me to implement this code!

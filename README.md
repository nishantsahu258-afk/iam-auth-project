# IAM Authentication & Registration

This project provides the frontend and backend implementation for the IAM Authentication & Registration module. It simulates a modern, secure registration flow with Multi-Factor Authentication (MFA).

## Tech Stack
- **Frontend**: HTML5, CSS3, Vanilla JavaScript (No external UI frameworks)
- **Backend**: Node.js, Express.js
- **Architecture**: In-memory state (No external database dependencies yet)

## Registration Flow Implemented
The application implements a fully responsive, step-by-step registration journey:
1. **Account Details**: Capture Name, Email, Mobile, and Password with real-time validation.
2. **Email Verification**: OTP-based email verification flow.
3. **Mobile Verification**: OTP-based SMS verification flow.
4. **MFA Setup**: Setup Authenticator App with QR code (or SMS/Email on mobile).
5. **MFA Verification**: 6-digit Authenticator OTP verification.
6. **Registration Success**: Final confirmation screen.

## Setup and Installation
1. Ensure you have Node.js (v18+) installed.
2. Open a terminal in the root directory.
3. Install dependencies:
   ```bash
   npm install
   ```

## Running Locally
Start the development server with auto-restart:
```bash
npm run dev
```
The server will be available at `http://localhost:3000`.

## Testing the Application
- Open `http://localhost:3000/` in your browser.
- Fill out the registration form.
- The backend simulates email and SMS OTPs. When prompted for a code on the frontend, check the **server console (terminal)** where the mock 6-digit OTPs will be printed.
- Enter the code from the console into the frontend to proceed through the steps.

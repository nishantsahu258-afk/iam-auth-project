require('dotenv').config();
const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const session = require('express-session');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Nodemailer transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
    }
});

// Middleware to parse JSON bodies
app.use(express.json());


// Session Configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'secureid_prototype_secret_key_123',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production'
    }
}));
// Serve static files from the frontend directory
app.use(express.static(path.join(__dirname, '../frontend')));

// ---------------------------------------------------------
// In-Memory Database (For assignment purposes only)
// ---------------------------------------------------------
const users = []; // Stores user records
const otpChallenges = []; // Stores active OTP challenges

// ---------------------------------------------------------
// Routes
// ---------------------------------------------------------

/**
 * POST /api/register
 * Register a new user
 */
app.post('/api/register', async (req, res) => {
    try {
        const { fullName, email, mobile, password } = req.body;

        // 1. Validate required fields
        if (!fullName || !email || !mobile || !password) {
            return res.status(400).json({
                status: 'error',
                message: 'All fields (fullName, email, mobile, password) are required.'
            });
        }

        // Basic check to see if user already exists
        const userExists = users.find(u => u.email === email);
        if (userExists) {
            return res.status(400).json({
                status: 'error',
                message: 'A user with this email already exists.'
            });
        }

        // 2. Hash the password before storing it
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // 3. Create a unique user ID
        const userId = crypto.randomUUID();

        // 4. Store user in memory
        const newUser = {
            id: userId,
            fullName,
            email,
            mobile,
            passwordHash: hashedPassword, // Store hash, NEVER plain text
            createdAt: new Date().toISOString()
        };
        users.push(newUser);

        // 5. Generate Email, SMS, and MFA OTPs
        const emailOtp = crypto.randomInt(100000, 1000000).toString();
        const smsOtp = crypto.randomInt(100000, 1000000).toString();
        const mfaOtp = crypto.randomInt(100000, 1000000).toString();
        
        // 6. Protect OTPs (Hash them)
        const emailOtpHash = crypto.createHash('sha256').update(emailOtp).digest('hex');
        const smsOtpHash = crypto.createHash('sha256').update(smsOtp).digest('hex');
        const mfaOtpHash = crypto.createHash('sha256').update(mfaOtp).digest('hex');

        // 7. Create OTP Challenges
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // Expiry: 15 minutes for the whole journey
        
        const emailChallengeId = crypto.randomUUID();
        const smsChallengeId = crypto.randomUUID();
        const mfaChallengeId = crypto.randomUUID();

        otpChallenges.push({ challengeId: emailChallengeId, userId, channel: 'email', otpHash: emailOtpHash, expiresAt: expiresAt.toISOString(), attempts: 0 });
        otpChallenges.push({ challengeId: smsChallengeId, userId, channel: 'sms', otpHash: smsOtpHash, expiresAt: expiresAt.toISOString(), attempts: 0 });
        otpChallenges.push({ challengeId: mfaChallengeId, userId, channel: 'mfa_pregenerated', otpHash: mfaOtpHash, expiresAt: expiresAt.toISOString(), attempts: 0 });

        // 8. Send Unified Beautiful Email via Nodemailer
        if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
            const htmlTemplate = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9f9fa; padding: 20px; border-radius: 8px;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <h2 style="color: #4f46e5; margin: 0;">SecureID Identity Service</h2>
                    </div>
                    
                    <div style="background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                        <h3 style="color: #111827; margin-top: 0;">Welcome, ${fullName}!</h3>
                        <p style="color: #4b5563; line-height: 1.6;">Please use the following verification codes to complete your account registration journey.</p>
                        
                        <div style="margin: 30px 0;">
                            <div style="margin-bottom: 20px; padding: 15px; border-left: 4px solid #4f46e5; background-color: #f3f4f6;">
                                <p style="margin: 0 0 5px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #6b7280;">Step 1: Email Verification Code</p>
                                <strong style="font-size: 24px; letter-spacing: 4px; color: #111827;">${emailOtp}</strong>
                            </div>
                            
                            <div style="margin-bottom: 20px; padding: 15px; border-left: 4px solid #10b981; background-color: #f3f4f6;">
                                <p style="margin: 0 0 5px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #6b7280;">Step 2: Mobile Verification Code (Simulated)</p>
                                <strong style="font-size: 24px; letter-spacing: 4px; color: #111827;">${smsOtp}</strong>
                                <p style="margin: 5px 0 0 0; font-size: 12px; color: #6b7280;">Intended for mobile: ${mobile}</p>
                            </div>
                            
                            <div style="padding: 15px; border-left: 4px solid #8b5cf6; background-color: #f3f4f6;">
                                <p style="margin: 0 0 5px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #6b7280;">Step 3: MFA Setup Code (Simulated)</p>
                                <strong style="font-size: 24px; letter-spacing: 4px; color: #111827;">${mfaOtp}</strong>
                            </div>
                        </div>
                        
                        <p style="color: #6b7280; font-size: 14px;">These codes will expire in 15 minutes. Do not share them with anyone.</p>
                    </div>
                    
                    <div style="text-align: center; margin-top: 20px; color: #9ca3af; font-size: 12px;">
                        <p><em>Note: This is for prototype purposes only. The actual functionality can be implemented after getting the proper service and authenticator app credentials for actual implementation for the application.</em></p>
                    </div>
                </div>
            `;

            await transporter.sendMail({
                from: `"SecureID Identity Service" <${process.env.GMAIL_USER}>`,
                to: email,
                subject: 'Your SecureID Registration Codes',
                html: htmlTemplate
            });
        }

        // 9. Return safe success response with challengeId
        res.status(201).json({
            status: 'success',
            message: 'User registered. Please check your email for the verification codes.',
            data: {
                challengeId: emailChallengeId,
                method: 'email'
            }
        });

    } catch (error) {
        console.error('Registration Error:', error);
        res.status(500).json({
            status: 'error',
            message: 'An internal error occurred during registration.'
        });
    }
});

/**
 * POST /api/verify-email-otp
 * Verify the OTP sent to the user's email
 */
app.post('/api/verify-email-otp', (req, res) => {
    try {
        const { challengeId, otp } = req.body;

        // 1. Validate required fields
        if (!challengeId || !otp) {
            return res.status(400).json({
                status: 'error',
                message: 'challengeId and otp are required.'
            });
        }

        // 2. Find the corresponding OTP challenge
        const challengeIndex = otpChallenges.findIndex(c => c.challengeId === challengeId);
        if (challengeIndex === -1) {
            return res.status(404).json({
                status: 'error',
                message: 'Invalid or expired OTP challenge.'
            });
        }

        const challenge = otpChallenges[challengeIndex];

        // 3. Check if challenge has expired
        if (new Date() > new Date(challenge.expiresAt)) {
            otpChallenges.splice(challengeIndex, 1); // Remove expired challenge
            return res.status(400).json({
                status: 'error',
                message: 'OTP has expired. Please request a new one.'
            });
        }

        // 4. Check attempts (limit to 3 max)
        if (challenge.attempts >= 3) {
            otpChallenges.splice(challengeIndex, 1); // Remove blocked challenge
            return res.status(400).json({
                status: 'error',
                message: 'Maximum attempts exceeded. Please request a new OTP.'
            });
        }

        // 5. Hash submitted OTP and compare
        const submittedHash = crypto.createHash('sha256').update(otp.toString()).digest('hex');
        
        if (submittedHash !== challenge.otpHash) {
            challenge.attempts += 1;
            
            // Re-check attempts after incrementing to see if they just hit the limit
            if (challenge.attempts >= 3) {
                otpChallenges.splice(challengeIndex, 1);
                return res.status(400).json({
                    status: 'error',
                    message: 'Maximum attempts exceeded. Please request a new OTP.'
                });
            }

            return res.status(400).json({
                status: 'error',
                message: `Incorrect OTP. You have ${3 - challenge.attempts} attempt(s) remaining.`
            });
        }

        // 6. OTP is correct! Mark verification as successful
        const user = users.find(u => u.id === challenge.userId);
        if (user) {
            user.emailVerified = true;
        }

        // 7. Invalidate the OTP challenge so it cannot be reused
        otpChallenges.splice(challengeIndex, 1);

        // 8. Return success response
        res.status(200).json({
            status: 'success',
            message: 'Email successfully verified.',
            data: {
                userId: user.id
            }
        });

    } catch (error) {
        console.error('Verification Error:', error);
        res.status(500).json({
            status: 'error',
            message: 'An internal error occurred during OTP verification.'
        });
    }
});

/**
 * POST /api/send-sms-otp
 * Generate and send an SMS OTP for the second step of verification
 */
app.post('/api/send-sms-otp', async (req, res) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({
                status: 'error',
                message: 'userId is required.'
            });
        }

        const user = users.find(u => u.id === userId);
        if (!user) {
            return res.status(404).json({
                status: 'error',
                message: 'User not found.'
            });
        }

        if (!user.emailVerified) {
            return res.status(400).json({
                status: 'error',
                message: 'Email must be verified before requesting SMS OTP.'
            });
        }

        // 1. Retrieve pre-generated SMS challenge
        const existingChallenge = otpChallenges.find(c => c.userId === user.id && c.channel === 'sms');
        if (!existingChallenge) {
            return res.status(400).json({ status: 'error', message: 'SMS Challenge not found. Please restart registration.' });
        }

        // 2. Return success response with existing challengeId
        res.status(200).json({
            status: 'success',
            message: 'SMS OTP request acknowledged (Check your initial email).',
            data: {
                challengeId: existingChallenge.challengeId,
                method: 'sms'
            }
        });

    } catch (error) {
        console.error('Send SMS Error:', error);
        res.status(500).json({
            status: 'error',
            message: 'An internal error occurred while sending SMS.'
        });
    }
});

/**
 * POST /api/verify-sms-otp
 * Verify the SMS OTP sent to the user's mobile number
 */
app.post('/api/verify-sms-otp', (req, res) => {
    try {
        const { challengeId, otp } = req.body;

        // 1. Validate required fields
        if (!challengeId || !otp) {
            return res.status(400).json({
                status: 'error',
                message: 'challengeId and otp are required.'
            });
        }

        // 2. Find the corresponding OTP challenge
        const challengeIndex = otpChallenges.findIndex(c => c.challengeId === challengeId);
        if (challengeIndex === -1) {
            return res.status(404).json({
                status: 'error',
                message: 'Invalid or expired OTP challenge.'
            });
        }

        const challenge = otpChallenges[challengeIndex];

        // Ensure this is an SMS challenge
        if (challenge.channel !== 'sms') {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid challenge channel.'
            });
        }

        // 3. Check if challenge has expired
        if (new Date() > new Date(challenge.expiresAt)) {
            otpChallenges.splice(challengeIndex, 1); // Remove expired challenge
            return res.status(400).json({
                status: 'error',
                message: 'OTP has expired. Please request a new one.'
            });
        }

        // 4. Check attempts (limit to 3 max)
        if (challenge.attempts >= 3) {
            otpChallenges.splice(challengeIndex, 1); // Remove blocked challenge
            return res.status(400).json({
                status: 'error',
                message: 'Maximum attempts exceeded. Please request a new OTP.'
            });
        }

        // 5. Hash submitted OTP and compare
        const submittedHash = crypto.createHash('sha256').update(otp.toString()).digest('hex');
        
        if (submittedHash !== challenge.otpHash) {
            challenge.attempts += 1;
            
            if (challenge.attempts >= 3) {
                otpChallenges.splice(challengeIndex, 1);
                return res.status(400).json({
                    status: 'error',
                    message: 'Maximum attempts exceeded. Please request a new OTP.'
                });
            }

            return res.status(400).json({
                status: 'error',
                message: `Incorrect OTP. You have ${3 - challenge.attempts} attempt(s) remaining.`
            });
        }

        // 6. OTP is correct! Mark mobile as verified
        const user = users.find(u => u.id === challenge.userId);
        if (user) {
            user.mobileVerified = true;
        }

        // 7. Invalidate the OTP challenge so it cannot be reused
        otpChallenges.splice(challengeIndex, 1);

        // 8. Return success response
        res.status(200).json({
            status: 'success',
            message: 'SMS successfully verified. Mobile verified.',
            data: {
                userId: challenge.userId
            }
        });

    } catch (error) {
        console.error('Verify SMS Error:', error);
        res.status(500).json({
            status: 'error',
            message: 'An internal error occurred during SMS verification.'
        });
    }
});

/**
 * POST /api/setup-mfa
 * Start the MFA setup process for a verified user
 */
app.post('/api/setup-mfa', async (req, res) => {
    try {
        const { userId, method } = req.body;

        if (!userId || !method) {
            return res.status(400).json({
                status: 'error',
                message: 'userId and method are required.'
            });
        }

        const allowedMethods = ['authenticator', 'sms', 'email'];
        if (!allowedMethods.includes(method)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid MFA method.'
            });
        }

        const user = users.find(u => u.id === userId);
        if (!user) {
            return res.status(404).json({
                status: 'error',
                message: 'User not found.'
            });
        }

        if (!user.emailVerified || !user.mobileVerified) {
            return res.status(400).json({
                status: 'error',
                message: 'Email and mobile must be verified before setting up MFA.'
            });
        }

        // Store selected method (not enabled yet)
        user.mfaMethod = method;
        user.mfaEnabled = false;

        // Retrieve pre-generated MFA challenge
        const existingChallenge = otpChallenges.find(c => c.userId === user.id && c.channel === 'mfa_pregenerated');
        if (!existingChallenge) {
            return res.status(400).json({ status: 'error', message: 'MFA Challenge not found. Please restart registration.' });
        }
        
        // Update the channel for verify-mfa check
        existingChallenge.channel = method;

        res.status(200).json({
            status: 'success',
            message: `MFA setup started for ${method} (Check your initial email).`,
            data: {
                challengeId: existingChallenge.challengeId,
                method: method
            }
        });

    } catch (error) {
        console.error('Setup MFA Error:', error);
        res.status(500).json({
            status: 'error',
            message: 'An internal error occurred during MFA setup.'
        });
    }
});

/**
 * POST /api/verify-mfa
 * Verify the MFA setup code and enable MFA for the user
 */
app.post('/api/verify-mfa', (req, res) => {
    try {
        const { challengeId, otp } = req.body;

        if (!challengeId || !otp) {
            return res.status(400).json({
                status: 'error',
                message: 'challengeId and otp are required.'
            });
        }

        const challengeIndex = otpChallenges.findIndex(c => c.challengeId === challengeId);
        if (challengeIndex === -1) {
            return res.status(404).json({
                status: 'error',
                message: 'Invalid or expired MFA challenge.'
            });
        }

        const challenge = otpChallenges[challengeIndex];

        // Ensure this is an MFA challenge (authenticator, sms, email)
        const allowedMfaChannels = ['authenticator', 'sms', 'email'];
        if (!allowedMfaChannels.includes(challenge.channel)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid challenge channel.'
            });
        }

        // Check if expired
        if (new Date() > new Date(challenge.expiresAt)) {
            otpChallenges.splice(challengeIndex, 1);
            return res.status(400).json({
                status: 'error',
                message: 'Verification code has expired. Please try again.'
            });
        }

        // Check attempts
        if (challenge.attempts >= 3) {
            otpChallenges.splice(challengeIndex, 1);
            return res.status(400).json({
                status: 'error',
                message: 'Maximum attempts exceeded. Please restart MFA setup.'
            });
        }

        // Hash and compare
        const submittedHash = crypto.createHash('sha256').update(otp.toString()).digest('hex');
        
        if (submittedHash !== challenge.otpHash) {
            challenge.attempts += 1;
            
            if (challenge.attempts >= 3) {
                otpChallenges.splice(challengeIndex, 1);
                return res.status(400).json({
                    status: 'error',
                    message: 'Maximum attempts exceeded. Please restart MFA setup.'
                });
            }

            return res.status(400).json({
                status: 'error',
                message: `Incorrect code. You have ${3 - challenge.attempts} attempt(s) remaining.`
            });
        }

        // Correct OTP! Enable MFA for the user
        const user = users.find(u => u.id === challenge.userId);
        if (user) {
            user.mfaEnabled = true;
            // user.mfaMethod is already stored from the setup step
        }

        // Invalidate challenge
        otpChallenges.splice(challengeIndex, 1);

        res.status(200).json({
            status: 'success',
            message: 'MFA setup successfully verified and enabled.',
            data: {
                userId: challenge.userId
            }
        });

    } catch (error) {
        console.error('Verify MFA Error:', error);
        res.status(500).json({
            status: 'error',
            message: 'An internal error occurred during MFA verification.'
        });
    }
});

/**
 * POST /api/login
 * Validates credentials and checks MFA status
 */
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ status: 'error', message: 'Email and password are required.' });
        }

        const user = users.find(u => u.email === email);
        if (!user) {
            return res.status(401).json({ status: 'error', message: 'Invalid credentials.' });
        }

        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
            return res.status(401).json({ status: 'error', message: 'Invalid credentials.' });
        }

        if (user.mfaEnabled) {
            return res.status(200).json({ 
                status: 'mfa_required', 
                data: { userId: user.id, method: user.mfaMethod } 
            });
        }

        req.session.userId = user.id;
        return res.status(200).json({ status: 'authenticated', data: { userId: user.id } });
    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ status: 'error', message: 'An internal error occurred during login.' });
    }
});

/**
 * POST /api/send-login-otp
 * Generate and send Login OTP
 */
app.post('/api/send-login-otp', async (req, res) => {
    try {
        const { userId, method } = req.body;

        if (!userId || !method) {
            return res.status(400).json({ status: 'error', message: 'userId and method are required.' });
        }

        const user = users.find(u => u.id === userId);
        if (!user || !user.mfaEnabled) {
            return res.status(400).json({ status: 'error', message: 'Invalid request or MFA not enabled.' });
        }

        const allowedMethods = ['email', 'sms'];
        if (!allowedMethods.includes(method)) {
            return res.status(400).json({ status: 'error', message: 'Unsupported MFA method for this step.' });
        }

        const otp = crypto.randomInt(100000, 1000000).toString();
        const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        const challengeId = crypto.randomUUID();
        const channel = `login_${method}`;

        const existingIndex = otpChallenges.findIndex(c => c.userId === userId && c.channel.startsWith('login_'));
        if (existingIndex !== -1) {
            otpChallenges.splice(existingIndex, 1);
        }

        otpChallenges.push({ challengeId, userId, channel, otpHash, expiresAt, attempts: 0 });

        if (method === 'email' && process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
            console.log(`\n[SIMULATED LOGIN EMAIL]\nTo: ${user.email}\nOTP: ${otp}\n`);
            const htmlTemplate = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9f9fa; padding: 20px; border-radius: 8px;">
                    <div style="background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                        <h3 style="color: #111827; margin-top: 0;">Login Verification</h3>
                        <p style="color: #4b5563; line-height: 1.6;">Your SecureID Login code is:</p>
                        <strong style="font-size: 24px; letter-spacing: 4px; color: #111827;">${otp}</strong>
                        <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">This code expires in 15 minutes.</p>
                    </div>
                </div>
            `;
            await transporter.sendMail({
                from: `"SecureID Identity Service" <${process.env.GMAIL_USER}>`,
                to: user.email,
                subject: 'Your SecureID Login Code',
                html: htmlTemplate
            });
        } else if (method === 'sms') {
            console.log(`\n[SIMULATED LOGIN SMS]\nTo: ${user.mobile}\nOTP: ${otp}\n`);
        }

        res.status(200).json({ status: 'success', data: { challengeId, method } });

    } catch (error) {
        console.error('Send Login OTP Error:', error);
        res.status(500).json({ status: 'error', message: 'An error occurred while sending Login OTP.' });
    }
});

/**
 * POST /api/verify-login-otp
 * Verify Login OTP
 */
app.post('/api/verify-login-otp', async (req, res) => {
    try {
        const { challengeId, otp } = req.body;

        if (!challengeId || !otp) {
            return res.status(400).json({ status: 'error', message: 'Challenge ID and OTP are required.' });
        }

        const challengeIndex = otpChallenges.findIndex(c => c.challengeId === challengeId && c.channel.startsWith('login_'));
        
        if (challengeIndex === -1) {
            return res.status(400).json({ status: 'error', message: 'Invalid or expired challenge.' });
        }

        const challenge = otpChallenges[challengeIndex];

        if (new Date() > new Date(challenge.expiresAt)) {
            otpChallenges.splice(challengeIndex, 1);
            return res.status(400).json({ status: 'error', code: 'OTP_EXPIRED', message: 'OTP has expired.' });
        }

        challenge.attempts += 1;
        const MAX_ATTEMPTS = 3;

        const hashedInput = crypto.createHash('sha256').update(otp).digest('hex');

        if (hashedInput !== challenge.otpHash) {
            if (challenge.attempts >= MAX_ATTEMPTS) {
                otpChallenges.splice(challengeIndex, 1);
                return res.status(400).json({ status: 'error', attemptsRemaining: 0, message: 'Maximum attempts reached. Please request a new code.' });
            }
            return res.status(400).json({ status: 'error', attemptsRemaining: MAX_ATTEMPTS - challenge.attempts, message: 'Incorrect OTP.' });
        }

        // Correct OTP
        otpChallenges.splice(challengeIndex, 1);
        
        req.session.userId = challenge.userId;
        return res.status(200).json({ status: 'authenticated', data: { userId: challenge.userId } });

    } catch (error) {
        console.error('Verify Login OTP Error:', error);
        res.status(500).json({ status: 'error', message: 'An error occurred during verification.' });
    }
});

/**
 * Authentication Middleware
 */
const requireAuth = (req, res, next) => {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({ status: 'unauthenticated', message: 'Authentication required.' });
    }
    next();
};

/**
 * GET /api/me
 * Returns authenticated user info
 */
app.get('/api/me', requireAuth, (req, res) => {
    const user = users.find(u => u.id === req.session.userId);
    if (!user) {
        return res.status(401).json({ status: 'unauthenticated', message: 'User not found.' });
    }
    
    const safeUser = {
        id: user.id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        emailVerified: user.emailVerified,
        mobileVerified: user.mobileVerified,
        mfaEnabled: user.mfaEnabled,
        mfaMethod: user.mfaMethod
    };

    res.status(200).json({ status: 'authenticated', data: { user: safeUser } });
});

/**
 * POST /api/logout
 * Destroys session
 */
app.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ status: 'error', message: 'Could not log out.' });
        }
        res.clearCookie('connect.sid');
        return res.status(200).json({ status: 'success', message: 'Logged out successfully.' });
    });
});

// ---------------------------------------------------------
// JWT Authentication Flow
// ---------------------------------------------------------

/**
 * JWT Authentication Middleware
 */
const requireJwt = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ status: 'error', message: 'Missing or invalid Authorization header.' });
    }

    const token = authHeader.split(' ')[1];
    
    if (!process.env.JWT_SECRET) {
        console.error('JWT_SECRET is missing.');
        return res.status(500).json({ status: 'error', message: 'Server configuration error.' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({ status: 'error', message: 'Invalid or expired token.' });
        }
        req.jwtUserId = decoded.sub;
        next();
    });
};

/**
 * POST /api/token
 * Issues a short-lived JWT for valid credentials
 */
app.post('/api/token', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ status: 'error', message: 'Email and password are required.' });
        }

        const user = users.find(u => u.email === email);
        if (!user) {
            return res.status(401).json({ status: 'error', message: 'Invalid email or password.' });
        }

        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
            return res.status(401).json({ status: 'error', message: 'Invalid email or password.' });
        }

        if (!process.env.JWT_SECRET) {
            console.error('JWT_SECRET is missing.');
            return res.status(500).json({ status: 'error', message: 'Server configuration error.' });
        }

        const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: '15m' });

        return res.status(200).json({ status: 'success', data: { token } });
    } catch (error) {
        console.error('Token Error:', error);
        res.status(500).json({ status: 'error', message: 'An internal error occurred.' });
    }
});

/**
 * GET /api/protected
 * Protected by JWT only
 */
app.get('/api/protected', requireJwt, (req, res) => {
    const user = users.find(u => u.id === req.jwtUserId);
    if (!user) {
        return res.status(401).json({ status: 'error', message: 'User no longer exists.' });
    }

    return res.status(200).json({
        status: 'success',
        data: {
            authenticated: true,
            userId: user.id
        }
    });
});

// Basic health check endpoint
app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: 'success',
        message: 'Server is up and running smoothly!'
    });
});

// Start the server
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });
}

// Export for Vercel serverless functions
module.exports = app;

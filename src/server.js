require('dotenv').config();
const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { Resend } = require('resend');

const app = express();
const PORT = process.env.PORT || 3000;
const resend = new Resend(process.env.RESEND_API_KEY);

// Middleware to parse JSON bodies
app.use(express.json());

const path = require('path');
// Serve static files from the public directory
app.use(express.static(path.join(__dirname, '../public')));

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

        // 5. Generate Email OTP (6 random digits)
        // Using crypto.randomInt is cryptographically secure compared to Math.random
        const otp = crypto.randomInt(100000, 1000000).toString(); 
        
        // 6. Protect OTP (Hash it)
        // A simple SHA-256 hash is often used for short-lived OTPs to avoid plain-text storage
        const otpHash = crypto.createHash('sha256').update(otp).digest('hex');

        // 7. Create OTP Challenge
        const challengeId = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // Expiry: 5 minutes from now

        const challenge = {
            challengeId,
            userId,
            channel: 'email',
            otpHash,
            expiresAt: expiresAt.toISOString(),
            attempts: 0
        };
        otpChallenges.push(challenge);

        // 8. Send Email OTP via Resend
        if (process.env.RESEND_API_KEY) {
            await resend.emails.send({
                from: 'SecureID <onboarding@resend.dev>',
                to: email,
                subject: 'Your Registration OTP',
                html: `
                    <p>Your secure verification code is: <strong>${otp}</strong></p>
                    <br/>
                    <p style="font-size: 0.85em; color: #666;">
                        <em>Note: This is for prototype purposes only. The actual functionality can be implemented after getting the proper service and authenticator app credentials for actual implementation for the application.</em>
                    </p>
                `
            });
        }

        // 9. Return safe success response with challengeId
        res.status(201).json({
            status: 'success',
            message: 'User registered. Please verify your email.',
            data: {
                challengeId: challengeId,
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

        // 1. Generate SMS OTP (6 random digits)
        const otp = crypto.randomInt(100000, 1000000).toString();
        
        // 2. Protect OTP (Hash it)
        const otpHash = crypto.createHash('sha256').update(otp).digest('hex');

        // 3. Create OTP Challenge
        const challengeId = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // Expiry: 5 minutes

        const challenge = {
            challengeId,
            userId: user.id,
            channel: 'sms',
            otpHash,
            expiresAt: expiresAt.toISOString(),
            attempts: 0
        };
        otpChallenges.push(challenge);

        // 4. Send "SMS" OTP via Resend (Prototype fallback)
        if (process.env.RESEND_API_KEY) {
            await resend.emails.send({
                from: 'SecureID <onboarding@resend.dev>',
                to: user.email,
                subject: 'Your Mobile Registration OTP (Simulated)',
                html: `
                    <p>Your mobile verification code is: <strong>${otp}</strong></p>
                    <p><em>(Intended for mobile number: ${user.mobile})</em></p>
                    <br/>
                    <p style="font-size: 0.85em; color: #666;">
                        <em>Note: This is for prototype purposes only. The actual SMS functionality can be implemented after getting the proper service and authenticator app credentials for actual implementation for the application.</em>
                    </p>
                `
            });
        }

        // 5. Return success response with new challengeId
        res.status(200).json({
            status: 'success',
            message: 'SMS OTP sent successfully.',
            data: {
                challengeId: challengeId,
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

        // Generate MFA Verification Code (Simulated for all methods in this assignment)
        const otp = crypto.randomInt(100000, 1000000).toString();
        
        // Protect OTP
        const otpHash = crypto.createHash('sha256').update(otp).digest('hex');

        // Create Challenge
        const challengeId = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

        const challenge = {
            challengeId,
            userId: user.id,
            channel: method, // 'authenticator', 'sms', or 'email'
            otpHash,
            expiresAt: expiresAt.toISOString(),
            attempts: 0
        };
        otpChallenges.push(challenge);

        // Delivery/Generation (All MFA OTPs routed to Resend for prototype)
        if (process.env.RESEND_API_KEY) {
            let subject = 'Your MFA Setup Code';
            let extraInfo = '';
            
            if (method === 'sms') {
                subject = 'Your MFA SMS Code (Simulated)';
                extraInfo = `<p><em>(Intended for mobile number: ${user.mobile})</em></p>`;
            } else if (method === 'authenticator') {
                subject = 'Your Authenticator App Code (Simulated)';
                extraInfo = `<p><em>(Usually generated by your authenticator app)</em></p>`;
            }

            await resend.emails.send({
                from: 'SecureID MFA <onboarding@resend.dev>',
                to: user.email,
                subject: subject,
                html: `
                    <p>Your MFA setup code is: <strong>${otp}</strong></p>
                    ${extraInfo}
                    <br/>
                    <p style="font-size: 0.85em; color: #666;">
                        <em>Note: This is for prototype purposes only. The actual functionality can be implemented after getting the proper service and authenticator app credentials for actual implementation for the application.</em>
                    </p>
                `
            });
        }

        res.status(200).json({
            status: 'success',
            message: `MFA setup started for ${method}.`,
            data: {
                challengeId: challengeId,
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

// Basic health check endpoint
app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: 'success',
        message: 'Server is up and running smoothly!'
    });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

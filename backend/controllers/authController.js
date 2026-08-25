
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { users, otpChallenges } = require('../config/db');
const transporter = require('../config/mailer');

exports.register = async (req, res) => {
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
};

/**
 * POST /api/verify-email-otp
 * Verify the OTP sent to the user's email
 */
exports.verifyEmailOtp = (req, res) => {
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
};

/**
 * POST /api/send-sms-otp
 * Generate and send an SMS OTP for the second step of verification
 */
exports.sendSmsOtp = async (req, res) => {
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
};

/**
 * POST /api/verify-sms-otp
 * Verify the SMS OTP sent to the user's mobile number
 */
exports.verifySmsOtp = (req, res) => {
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
};

/**
 * POST /api/setup-mfa
 * Start the MFA setup process for a verified user
 */
exports.setupMfa = async (req, res) => {
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
};

/**
 * POST /api/verify-mfa
 * Verify the MFA setup code and enable MFA for the user
 */
exports.verifyMfa = (req, res) => {
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
};

// Basic health check endpoint


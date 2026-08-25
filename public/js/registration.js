document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('registrationForm');
    
    // Inputs
    const fullNameInput = document.getElementById('fullName');
    const emailInput = document.getElementById('email');
    const mobileInput = document.getElementById('mobile');
    const passwordInput = document.getElementById('password');
    const termsCheckbox = document.getElementById('terms');
    
    // Password visibility toggle
    const togglePasswordBtn = document.querySelector('.toggle-password');
    
    // Password Requirements List Items
    const reqLength = document.getElementById('req-length');
    const reqUpper = document.getElementById('req-upper');
    const reqNumber = document.getElementById('req-number');
    const reqSpecial = document.getElementById('req-special');

    // 1. Toggle Password Visibility
    togglePasswordBtn.addEventListener('click', () => {
        const currentType = passwordInput.getAttribute('type');
        passwordInput.setAttribute('type', currentType === 'password' ? 'text' : 'password');
        
        // Optional: Update opacity/color of icon when toggled to indicate state
        if (currentType === 'password') {
            togglePasswordBtn.style.color = 'var(--primary-color)';
        } else {
            togglePasswordBtn.style.color = '#9CA3AF';
        }
    });

    // 2. Dynamic Password Validation as user types
    passwordInput.addEventListener('input', () => {
        const value = passwordInput.value;
        
        // At least 8 characters
        if (value.length >= 8) reqLength.classList.add('valid');
        else reqLength.classList.remove('valid');
        
        // At least 1 uppercase letter
        if (/[A-Z]/.test(value)) reqUpper.classList.add('valid');
        else reqUpper.classList.remove('valid');
        
        // At least 1 number
        if (/[0-9]/.test(value)) reqNumber.classList.add('valid');
        else reqNumber.classList.remove('valid');
        
        // At least 1 special character
        if (/[^A-Za-z0-9]/.test(value)) reqSpecial.classList.add('valid');
        else reqSpecial.classList.remove('valid');
    });

    // 3. Clear error states when user starts typing again
    const clearErrorOnInput = (inputElement, groupPrefix) => {
        inputElement.addEventListener('input', () => {
            const group = document.getElementById(`${groupPrefix}-${inputElement.id}`);
            if (group && group.classList.contains('has-error')) {
                group.classList.remove('has-error');
                inputElement.classList.remove('error');
            }
        });
    };
    clearErrorOnInput(fullNameInput, 'group');
    clearErrorOnInput(emailInput, 'group');
    clearErrorOnInput(mobileInput, 'group');
    clearErrorOnInput(passwordInput, 'group');

    termsCheckbox.addEventListener('change', () => {
        const group = document.getElementById('group-terms');
        if (group && group.classList.contains('has-error')) {
            group.classList.remove('has-error');
        }
    });

    // 4. Form Submission & Validation
    form.addEventListener('submit', (e) => {
        e.preventDefault(); // Prevent default browser submission
        
        let isValid = true;
        
        // Helper to show errors
        const setError = (elementId, message) => {
            const group = document.getElementById(`group-${elementId}`);
            if (group) {
                group.classList.add('has-error');
                const input = group.querySelector('.input-control');
                if(input) input.classList.add('error');
                const errorText = group.querySelector('.error-text');
                if (errorText) errorText.textContent = message;
            }
            isValid = false;
        };

        // Reset all errors before running validation
        document.querySelectorAll('.has-error').forEach(el => el.classList.remove('has-error'));
        document.querySelectorAll('.input-control.error').forEach(el => el.classList.remove('error'));

        // Validate Full Name
        if (!fullNameInput.value.trim()) {
            setError('fullName', 'Full Name is required.');
        }

        // Validate Email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailInput.value.trim()) {
            setError('email', 'Email is required.');
        } else if (!emailRegex.test(emailInput.value.trim())) {
            setError('email', 'Please enter a valid email address.');
        }

        // Validate Mobile
        // Simplistic validation: 10 to 15 digits
        const mobileRegex = /^[0-9]{10,15}$/; 
        const cleanMobile = mobileInput.value.trim().replace(/[\s-]/g, ''); // strip spaces/dashes
        
        if (!mobileInput.value.trim()) {
            setError('mobile', 'Mobile number is required.');
        } else if (!mobileRegex.test(cleanMobile)) {
            setError('mobile', 'Please enter a valid 10-15 digit mobile number.');
        }

        // Validate Password
        const pw = passwordInput.value;
        const pwValid = pw.length >= 8 && /[A-Z]/.test(pw) && /[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw);
        if (!pw) {
            setError('password', 'Password is required.');
        } else if (!pwValid) {
            setError('password', 'Password must meet all requirements listed.');
        }

        // Validate Terms
        if (!termsCheckbox.checked) {
            const termsGroup = document.getElementById('group-terms');
            if(termsGroup) {
                termsGroup.classList.add('has-error');
                const termsError = termsGroup.querySelector('.error-text');
                if(termsError) termsError.textContent = 'You must agree to the terms to continue.';
            }
            isValid = false;
        }

        // 5. Submit to API if valid
        if (isValid) {
            const submitBtn = form.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn.textContent;
            submitBtn.textContent = 'Creating Account...';
            submitBtn.disabled = true;

            const formError = document.getElementById('formError');
            formError.style.display = 'none';

            // Clean up mobile format for API
            const cleanMobile = mobileInput.value.trim().replace(/[\s-]/g, '');

            fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fullName: fullNameInput.value.trim(),
                    email: emailInput.value.trim(),
                    mobile: cleanMobile,
                    password: passwordInput.value // Send password securely over HTTPS
                })
            })
            .then(async response => {
                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.message || 'Registration failed.');
                }
                
                // Success: store challengeId globally
                window.currentChallengeId = data.data.challengeId;
                
                // Transition UI to OTP screen
                form.style.display = 'none';
                document.getElementById('mainHeader').style.display = 'none';
                document.getElementById('otpScreen').style.display = 'block';
                
                // Update email display in OTP screen
                document.getElementById('displayEmail').textContent = emailInput.value.trim();

                // Update stepper visual
                const steps = document.querySelectorAll('.step');
                if(steps.length > 1) {
                    steps[0].classList.remove('active');
                    steps[0].classList.add('completed');
                    steps[0].style.backgroundColor = 'var(--success-color)';
                    steps[0].style.borderColor = 'var(--success-color)';
                    steps[0].style.color = 'white';
                    steps[0].innerHTML = '&#10003;'; // Checkmark
                    
                    steps[1].classList.add('active');
                }
            })
            .catch(error => {
                formError.textContent = error.message;
                formError.style.display = 'block';
            })
            .finally(() => {
                submitBtn.textContent = originalBtnText;
                submitBtn.disabled = false;
            });
        }
    });

    // ---------------------------------------------------------
    // OTP Screen Logic
    // ---------------------------------------------------------
    
    // OTP Box auto-advance behavior
    const otpBoxes = document.querySelectorAll('#otpForm .otp-box');
    otpBoxes.forEach((box, index) => {
        box.addEventListener('input', (e) => {
            const otpError = document.getElementById('otpError');
            if(otpError) otpError.style.display = 'none';
            otpBoxes.forEach(b => b.classList.remove('error'));

            box.value = box.value.replace(/[^0-9]/g, ''); // Numeric only
            if (e.target.value.length === 1 && index < otpBoxes.length - 1) {
                otpBoxes[index + 1].focus();
            } else if (e.target.value.length === 1 && index === otpBoxes.length - 1) {
                document.getElementById('verifyBtn').click();
            }
        });
        
        box.addEventListener('keydown', (e) => {
            // Move to previous box on backspace if current box is empty
            if (e.key === 'Backspace' && !e.target.value && index > 0) {
                otpBoxes[index - 1].focus();
            }
        });
    });

    // OTP Form Submission
    const otpForm = document.getElementById('otpForm');
    if (otpForm) {
        otpForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const otpError = document.getElementById('otpError');
            if(otpError) otpError.style.display = 'none';

            // Gather OTP from boxes
            const otpCode = Array.from(otpBoxes).map(box => box.value).join('');
            
            if(otpCode.length < 6) {
                if(otpError) {
                    otpError.textContent = 'Please enter all 6 digits.';
                    otpError.style.display = 'block';
                    otpBoxes.forEach(b => b.classList.add('error'));
                }
                return;
            }
            
            const submitBtn = document.getElementById('verifyBtn');
            const originalBtnText = submitBtn.textContent;
            submitBtn.textContent = 'Verifying...';
            submitBtn.disabled = true;

            fetch('/api/verify-email-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    challengeId: window.currentChallengeId,
                    otp: otpCode
                })
            })
            .then(async response => {
                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.message || 'Verification failed.');
                }
                
                // Success: Update UI
                const otpScreen = document.getElementById('otpScreen');
                const smsOtpScreen = document.getElementById('smsOtpScreen');

                if (otpScreen && smsOtpScreen) {
                    // Hide Email OTP, Show SMS OTP
                    otpScreen.style.display = 'none';
                    smsOtpScreen.style.display = 'block';

                    // Display mobile number
                    const mobileInputVal = document.getElementById('mobile').value;
                    document.getElementById('displayMobile').textContent = mobileInputVal;

                    // Automatically trigger the send-sms-otp endpoint
                    fetch('/api/send-sms-otp', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId: data.data.userId })
                    })
                    .then(r => r.json())
                    .then(smsData => {
                        if(smsData.status === 'success') {
                            window.currentSmsChallengeId = smsData.data.challengeId;
                        }
                    })
                    .catch(err => console.error("Error sending SMS:", err));
                }

                // Update stepper to Step 3
                const steps = document.querySelectorAll('.step');
                if (steps.length > 2) {
                    steps[1].classList.remove('active');
                    steps[1].classList.add('completed');
                    steps[1].style.backgroundColor = 'var(--success-color)';
                    steps[1].style.borderColor = 'var(--success-color)';
                    steps[1].style.color = 'white';
                    steps[1].innerHTML = '&#10003;'; // Checkmark
                    
                    steps[2].classList.add('active');
                }
            })
            .catch(error => {
                // Show API error message
                if(otpError) {
                    otpError.textContent = error.message;
                    otpError.style.display = 'block';
                    otpBoxes.forEach(b => b.classList.add('error'));
                }

                // Clear input boxes on error for easy re-entry
                otpBoxes.forEach(box => box.value = '');
                otpBoxes[0].focus();
            })
            .finally(() => {
                if (submitBtn) {
                    submitBtn.textContent = originalBtnText;
                    submitBtn.disabled = false;
                }
            });
        });
    }

    // Back to Registration button
    const backBtn = document.getElementById('backToRegister');
    if (backBtn) {
        backBtn.addEventListener('click', (e) => {
            e.preventDefault();
            // Just reload the page for simplicity to reset state
            window.location.reload();
        });
    }

    // ---------------------------------------------------------
    // SMS OTP Screen Logic
    // ---------------------------------------------------------
    
    // SMS OTP Box auto-advance behavior
    const smsOtpBoxes = document.querySelectorAll('#smsOtpForm .otp-box');
    smsOtpBoxes.forEach((box, index) => {
        box.addEventListener('input', (e) => {
            const smsOtpError = document.getElementById('smsOtpError');
            if(smsOtpError) smsOtpError.style.display = 'none';
            smsOtpBoxes.forEach(b => b.classList.remove('error'));

            box.value = box.value.replace(/[^0-9]/g, ''); // Numeric only
            if (e.target.value.length === 1 && index < smsOtpBoxes.length - 1) {
                smsOtpBoxes[index + 1].focus();
            } else if (e.target.value.length === 1 && index === smsOtpBoxes.length - 1) {
                document.getElementById('verifySmsBtn').click();
            }
        });
        
        box.addEventListener('keydown', (e) => {
            // Move to previous box on backspace if current box is empty
            if (e.key === 'Backspace' && !e.target.value && index > 0) {
                smsOtpBoxes[index - 1].focus();
            }
        });
    });

    // SMS OTP Form Submission
    const smsOtpForm = document.getElementById('smsOtpForm');
    if (smsOtpForm) {
        smsOtpForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const smsOtpError = document.getElementById('smsOtpError');
            if(smsOtpError) smsOtpError.style.display = 'none';

            // Gather OTP from boxes
            const otpCode = Array.from(smsOtpBoxes).map(box => box.value).join('');
            
            if(otpCode.length < 6) {
                if(smsOtpError) {
                    smsOtpError.textContent = 'Please enter all 6 digits.';
                    smsOtpError.style.display = 'block';
                    smsOtpBoxes.forEach(b => b.classList.add('error'));
                }
                return;
            }
            
            const submitBtn = document.getElementById('verifySmsBtn');
            const originalBtnText = submitBtn.textContent;
            submitBtn.textContent = 'Verifying...';
            submitBtn.disabled = true;

            fetch('/api/verify-sms-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    challengeId: window.currentSmsChallengeId,
                    otp: otpCode
                })
            })
            .then(async response => {
                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.message || 'SMS Verification failed.');
                }
                
                // Success: Update UI
                const smsOtpScreen = document.getElementById('smsOtpScreen');
                const mfaSelectionScreen = document.getElementById('mfaSelectionScreen');
                const mfaSetupScreen = document.getElementById('mfaSetupScreen');
                
                if (smsOtpScreen) smsOtpScreen.style.display = 'none';

                if (window.matchMedia("(min-width: 768px)").matches) {
                    // DESKTOP: Skip selection, force authenticator setup
                    if (mfaSelectionScreen) mfaSelectionScreen.style.display = 'none';
                    if (mfaSetupScreen) mfaSetupScreen.style.display = 'block';
                    
                    fetch('/api/setup-mfa', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId: data.data.userId, method: 'authenticator' })
                    })
                    .then(r => r.json())
                    .then(mfaData => {
                        if(mfaData.status === 'success') {
                            window.currentMfaChallengeId = mfaData.data.challengeId;
                        }
                    })
                    .catch(err => console.error("Error setting up MFA:", err));

                } else {
                    // MOBILE: Show method selection screen
                    if (mfaSetupScreen) mfaSetupScreen.style.display = 'none';
                    if (mfaSelectionScreen) mfaSelectionScreen.style.display = 'block';
                    // Remember userId for when they click Continue
                    window.verifiedUserId = data.data.userId;
                }

                // Update stepper to Step 4
                const steps = document.querySelectorAll('.step');
                if (steps.length > 3) {
                    steps[2].classList.remove('active');
                    steps[2].classList.add('completed');
                    steps[2].style.backgroundColor = 'var(--success-color)';
                    steps[2].style.borderColor = 'var(--success-color)';
                    steps[2].style.color = 'white';
                    steps[2].innerHTML = '&#10003;'; // Checkmark
                    
                    steps[3].classList.add('active');
                }
            })
            .catch(error => {
                if(smsOtpError) {
                    smsOtpError.textContent = error.message;
                    smsOtpError.style.display = 'block';
                    smsOtpBoxes.forEach(b => b.classList.add('error'));
                }

                // Clear input boxes on error for easy re-entry
                smsOtpBoxes.forEach(box => box.value = '');
                smsOtpBoxes[0].focus();
            })
            .finally(() => {
                if (submitBtn) {
                    submitBtn.textContent = originalBtnText;
                    submitBtn.disabled = false;
                }
            });
        });
    }

    // Back button in SMS screen
    const backToEmailBtn = document.getElementById('backToEmail');
    if (backToEmailBtn) {
        backToEmailBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.reload(); // Simple reset for now
        });
    }

    // ---------------------------------------------------------
    // MFA Screen Logic
    // ---------------------------------------------------------
    
    const mfaOptions = document.querySelectorAll('.mfa-option');
    const continueMfaSelectionBtn = document.getElementById('continueMfaSelectionBtn');
    let selectedMfaMethod = 'authenticator';

    mfaOptions.forEach(option => {
        option.addEventListener('click', () => {
            // Remove active from all
            mfaOptions.forEach(opt => {
                opt.classList.remove('active');
                opt.querySelector('.radio-circle').classList.remove('checked');
            });

            // Add active to selected
            option.classList.add('active');
            option.querySelector('.radio-circle').classList.add('checked');
            selectedMfaMethod = option.getAttribute('data-method');
        });
    });

    if (continueMfaSelectionBtn) {
        continueMfaSelectionBtn.addEventListener('click', (e) => {
            e.preventDefault();
            
            const originalBtnText = continueMfaSelectionBtn.textContent;
            continueMfaSelectionBtn.textContent = 'Setting up...';
            continueMfaSelectionBtn.disabled = true;

            fetch('/api/setup-mfa', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: window.verifiedUserId, method: selectedMfaMethod })
            })
            .then(async response => {
                const data = await response.json();
                if (!response.ok) throw new Error(data.message || 'Setup failed.');
                
                window.currentMfaChallengeId = data.data.challengeId;
                
                // Hide selection, show setup/verify screen
                const mfaSelectionScreen = document.getElementById('mfaSelectionScreen');
                const mfaSetupScreen = document.getElementById('mfaSetupScreen');
                if(mfaSelectionScreen) mfaSelectionScreen.style.display = 'none';
                if(mfaSetupScreen) mfaSetupScreen.style.display = 'block';

            })
            .catch(error => {
                alert(error.message); // Basic error handling for setup step
            })
            .finally(() => {
                continueMfaSelectionBtn.textContent = originalBtnText;
                continueMfaSelectionBtn.disabled = false;
            });
        });
    }

    const skipMfaBtn = document.getElementById('skipMfaBtn');
    if (skipMfaBtn) {
        skipMfaBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Skip MFA Placeholder');
        });
    }

    const mfaVerifyForm = document.getElementById('mfaVerifyForm');
    
    // MFA Setup screen navigation
    const continueToMfaVerifyBtn = document.getElementById('continueToMfaVerifyBtn');
    if (continueToMfaVerifyBtn) {
        continueToMfaVerifyBtn.addEventListener('click', (e) => {
            const mfaSetupScreen = document.getElementById('mfaSetupScreen');
            const mfaVerifyScreen = document.getElementById('mfaVerifyScreen');
            if (mfaSetupScreen) mfaSetupScreen.style.display = 'none';
            if (mfaVerifyScreen) {
                mfaVerifyScreen.style.display = 'block';
                const firstBox = mfaVerifyScreen.querySelector('.mfa-otp-box');
                if (firstBox) firstBox.focus();
            }
        });
    }

    const backFromSetupBtn = document.getElementById('backFromSetupBtn');
    if (backFromSetupBtn) {
        backFromSetupBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.reload();
        });
    }

    // MFA Verify OTP Box auto-advance
    const mfaOtpBoxes = document.querySelectorAll('.mfa-otp-box');
    mfaOtpBoxes.forEach((box, index) => {
        box.addEventListener('input', (e) => {
            const mfaVerifyError = document.getElementById('mfaVerifyError');
            if(mfaVerifyError) mfaVerifyError.style.display = 'none';
            mfaOtpBoxes.forEach(b => b.classList.remove('error'));

            box.value = box.value.replace(/[^0-9]/g, ''); // Numeric only
            if (e.target.value.length === 1 && index < mfaOtpBoxes.length - 1) {
                mfaOtpBoxes[index + 1].focus();
            } else if (e.target.value.length === 1 && index === mfaOtpBoxes.length - 1) {
                document.getElementById('verifyMfaBtn').click();
            }
        });
        
        box.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !e.target.value && index > 0) {
                mfaOtpBoxes[index - 1].focus();
            }
        });
    });

    if (mfaVerifyForm) {
        mfaVerifyForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const mfaVerifyError = document.getElementById('mfaVerifyError');
            if(mfaVerifyError) mfaVerifyError.style.display = 'none';

            const mfaBoxes = document.querySelectorAll('.mfa-otp-box');
            let otpCode = '';
            mfaBoxes.forEach(box => otpCode += box.value);
            
            if(otpCode.length < 6) {
                if(mfaVerifyError) {
                    mfaVerifyError.textContent = 'Please enter the 6-digit code.';
                    mfaVerifyError.style.display = 'block';
                    mfaOtpBoxes.forEach(b => b.classList.add('error'));
                }
                return;
            }

            const submitBtn = document.getElementById('verifyMfaBtn');
            const originalBtnText = submitBtn.textContent;
            submitBtn.textContent = 'Verifying...';
            submitBtn.disabled = true;

            fetch('/api/verify-mfa', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    challengeId: window.currentMfaChallengeId,
                    otp: otpCode
                })
            })
            .then(async response => {
                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.message || 'MFA Verification failed.');
                }
                
                // Success: Registration Complete!
                const mfaVerifyScreen = document.getElementById('mfaVerifyScreen');
                const successScreen = document.getElementById('successScreen');
                const stepperContainer = document.querySelector('.stepper-container');
                
                if (mfaVerifyScreen) mfaVerifyScreen.style.display = 'none';
                if (stepperContainer) stepperContainer.style.display = 'none';
                if (successScreen) successScreen.style.display = 'block';
            })
            .catch(error => {
                if(mfaVerifyError) {
                    mfaVerifyError.textContent = error.message;
                    mfaVerifyError.style.display = 'block';
                    mfaOtpBoxes.forEach(b => b.classList.add('error'));
                }
                const boxes = document.querySelectorAll('.mfa-otp-box');
                boxes.forEach(box => box.value = '');
                if (boxes.length > 0) boxes[0].focus();
            })
            .finally(() => {
                if (submitBtn) {
                    submitBtn.textContent = originalBtnText;
                    submitBtn.disabled = false;
                }
            });
        });
    }
});

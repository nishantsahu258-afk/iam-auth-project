document.addEventListener('DOMContentLoaded', () => {
    
    // ---------------------------------------------------------
    // Session Initialization Check
    // ---------------------------------------------------------
    const showAuthenticatedState = (user) => {
        document.querySelectorAll('.step-container').forEach(el => el.style.display = 'none');
        const authStep = document.getElementById('step-authenticated');
        if (authStep) {
            authStep.style.display = 'block';
            document.getElementById('authUserName').textContent = user.name || 'User';
            document.getElementById('authUserEmail').textContent = user.email || '';
            document.getElementById('authMfaStatus').textContent = user.mfaEnabled ? `Enabled (${user.mfaMethod})` : 'Disabled';
        }
    };

    fetch('/api/me')
        .then(res => res.json())
        .then(data => {
            if (data.status === 'authenticated' && data.data && data.data.user) {
                showAuthenticatedState(data.data.user);
            }
        })
        .catch(err => console.error('Session check failed:', err));

    // ---------------------------------------------------------
    // Logout Logic
    // ---------------------------------------------------------
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            fetch('/api/logout', { method: 'POST' })
                .then(() => window.location.reload())
                .catch(err => console.error('Logout failed:', err));
        });
    }

    // ---------------------------------------------------------
    // Password Visibility Toggle
    // ---------------------------------------------------------
    const togglePasswordBtn = document.querySelector('.toggle-password');
    const passwordInput = document.getElementById('password');

    if (togglePasswordBtn && passwordInput) {
        togglePasswordBtn.addEventListener('click', () => {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            
            if (type === 'text') {
                togglePasswordBtn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>';
            } else {
                togglePasswordBtn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
            }
        });
    }

    // ---------------------------------------------------------
    // Frontend Validation & Login Submit
    // ---------------------------------------------------------
    const loginForm = document.getElementById('loginForm');
    const emailInput = document.getElementById('email');
    const loginError = document.getElementById('loginError');

    const clearErrorOnInput = (inputElement, groupPrefix) => {
        if (!inputElement) return;
        inputElement.addEventListener('input', () => {
            const group = document.getElementById(`${groupPrefix}-${inputElement.id}`);
            if (group && group.classList.contains('has-error')) {
                group.classList.remove('has-error');
                inputElement.classList.remove('error');
                const errorIcon = group.querySelector('.error-icon');
                if (errorIcon) errorIcon.style.display = 'none';
            }
            if (loginError) loginError.style.display = 'none';
            const mobileLogo = document.querySelector('#mobileLogoContainer svg');
            if (mobileLogo) mobileLogo.style.color = '#1A56DB';
        });
    };

    clearErrorOnInput(emailInput, 'group');
    clearErrorOnInput(passwordInput, 'group');

    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            document.querySelectorAll('.has-error').forEach(el => el.classList.remove('has-error'));
            document.querySelectorAll('.input-control.error').forEach(el => el.classList.remove('error'));
            if (loginError) loginError.style.display = 'none';

            const setError = (elementId, message) => {
                const group = document.getElementById(`group-${elementId}`);
                const input = document.getElementById(elementId);
                
                if (group) {
                    group.classList.add('has-error');
                    if (input) input.classList.add('error');
                    const errorText = group.querySelector('.error-text');
                    if (errorText) errorText.textContent = message;
                    const errorIcon = group.querySelector('.error-icon');
                    if (errorIcon) errorIcon.style.display = 'flex';
                }
            };

            document.querySelectorAll('.error-icon').forEach(el => el.style.display = 'none');
            
            const setInvalidCredentials = () => {
                if (loginError) {
                    loginError.textContent = 'Invalid email or password. Please try again.';
                    loginError.style.display = 'block';
                    setError('email', '');
                    setError('password', '');
                    const mobileLogo = document.querySelector('#mobileLogoContainer svg');
                    if (mobileLogo) mobileLogo.style.color = '#EF4444';
                }
            };

            let isValid = true;

            if (!emailInput.value.trim()) {
                setError('email', 'Email or Username is required.');
                isValid = false;
            }

            if (!passwordInput.value.trim()) {
                setError('password', 'Password is required.');
                isValid = false;
            }

            if (isValid) {
                const submitBtn = document.querySelector('#loginForm button[type="submit"]');
                const originalText = submitBtn.textContent;
                submitBtn.textContent = 'Logging in...';
                submitBtn.disabled = true;

                fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: emailInput.value.trim(),
                        password: passwordInput.value
                    })
                })
                .then(async response => {
                    const data = await response.json();
                    
                    if (response.status === 401) {
                        setInvalidCredentials();
                    } else if (!response.ok) {
                        if (loginError) {
                            loginError.textContent = data.message || 'An error occurred.';
                            loginError.style.display = 'block';
                        }
                    } else {
                        if (data.status === 'mfa_required') {
                            window.currentUserId = data.data.userId;
                            window.currentMfaMethod = data.data.method;
                            document.getElementById('step-login').style.display = 'none';
                            document.getElementById('step-choose-method').style.display = 'block';
                            document.getElementById('step-choose-method').classList.add('active');
                        } else if (data.status === 'authenticated') {
                            // MFA was disabled, login success
                            fetch('/api/me')
                                .then(res => res.json())
                                .then(meData => {
                                    if (meData.status === 'authenticated') {
                                        showAuthenticatedState(meData.data.user);
                                    }
                                });
                        }
                    }
                })
                .catch(error => {
                    console.error('Login request failed:', error);
                    if (loginError) {
                        loginError.textContent = 'Network error. Please try again.';
                        loginError.style.display = 'block';
                    }
                })
                .finally(() => {
                    submitBtn.textContent = originalText;
                    submitBtn.disabled = false;
                });
            }
        });
    }

    // ---------------------------------------------------------
    // Back Buttons
    // ---------------------------------------------------------
    const backBtnChoose = document.getElementById('backBtnChoose');
    if (backBtnChoose) {
        backBtnChoose.addEventListener('click', () => {
            document.getElementById('step-choose-method').style.display = 'none';
            document.getElementById('step-login').style.display = 'block';
        });
    }

    const backBtnOtp = document.getElementById('backBtnOtp');
    if (backBtnOtp) {
        backBtnOtp.addEventListener('click', () => {
            document.getElementById('step-otp-verify').style.display = 'none';
            document.getElementById('step-choose-method').style.display = 'block';
        });
    }

    // ---------------------------------------------------------
    // Step 3: Choose Method Logic
    // ---------------------------------------------------------
    const chooseMethodForm = document.getElementById('chooseMethodForm');
    const mfaOptions = document.querySelectorAll('#step-choose-method .mfa-option');

    if (chooseMethodForm) {
        mfaOptions.forEach(option => {
            option.addEventListener('click', function() {
                mfaOptions.forEach(opt => {
                    opt.classList.remove('active');
                    const circle = opt.querySelector('.radio-circle');
                    if(circle) circle.classList.remove('checked');
                });
                this.classList.add('active');
                const circle = this.querySelector('.radio-circle');
                if(circle) circle.classList.add('checked');
            });
        });

        chooseMethodForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const submitBtn = chooseMethodForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = 'Sending...';
            submitBtn.disabled = true;

            const activeOption = document.querySelector('#step-choose-method .mfa-option.active .mfa-option-title').textContent.trim();
            let selectedMethod = 'email';
            if (activeOption.includes('SMS')) selectedMethod = 'sms';
            else if (activeOption.includes('Authenticator')) {
                alert('Authenticator app is not implemented yet.');
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
                return;
            }

            fetch('/api/send-login-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: window.currentUserId,
                    method: selectedMethod
                })
            })
            .then(async response => {
                const data = await response.json();
                if (response.ok) {
                    window.currentLoginChallengeId = data.data.challengeId;
                    
                    const methodTitle = document.getElementById('verify-method-title');
                    const targetDisplay = document.getElementById('verify-target-display');
                    if (methodTitle && targetDisplay) {
                        if (selectedMethod === 'sms') {
                            methodTitle.textContent = 'SMS Verification';
                            targetDisplay.textContent = 'your registered mobile number';
                        } else {
                            methodTitle.textContent = 'Email Verification';
                            targetDisplay.textContent = document.getElementById('email').value;
                        }
                    }

                    document.getElementById('step-choose-method').style.display = 'none';
                    document.getElementById('step-otp-verify').style.display = 'block';
                    const firstOtpBox = document.querySelector('.login-otp');
                    if(firstOtpBox) firstOtpBox.focus();
                } else {
                    alert(data.message || 'Error sending OTP');
                }
            })
            .catch(error => {
                console.error('Send OTP failed:', error);
                alert('Network error while sending OTP.');
            })
            .finally(() => {
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            });
        });
    }

    // ---------------------------------------------------------
    // Step 4-6: OTP Verification Logic
    // ---------------------------------------------------------
    const otpBoxes = document.querySelectorAll('.login-otp');
    const otpErrorText = document.getElementById('otpErrorText');
    const otpExpiredText = document.getElementById('otpExpiredText');
    const resendLink = document.getElementById('resendLink');
    const resendBtnSolid = document.getElementById('resendBtnSolid');

    const setWrongOtpState = (attemptsRemaining, message) => {
        if(otpErrorText) {
            otpErrorText.textContent = message || `Incorrect code. You have ${attemptsRemaining} attempt(s) left.`;
            otpErrorText.style.display = 'block';
        }
        otpBoxes.forEach(b => b.classList.add('error'));
        otpBoxes.forEach(b => b.value = '');
        if(otpBoxes[0]) otpBoxes[0].focus();
    };

    const setExpiredOtpState = () => {
        if(otpErrorText) {
            otpErrorText.textContent = 'Code expired.';
            otpErrorText.style.display = 'block';
        }
        otpBoxes.forEach(b => {
            b.classList.add('error');
            b.disabled = true;
        });
        const otpResendContainer = document.getElementById('otpResendContainer');
        if (otpResendContainer) otpResendContainer.style.display = 'flex';
        const authLinks = document.querySelector('.auth-links.text-center');
        if (authLinks) authLinks.style.display = 'none';
        const otpTimerText = document.getElementById('otpTimerText');
        if (otpTimerText) otpTimerText.style.display = 'none';
    };

    const verifyLoginOtp = () => {
        const otpCode = Array.from(otpBoxes).map(b => b.value).join('');
        if (otpCode.length < 6) return;

        fetch('/api/verify-login-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                challengeId: window.currentLoginChallengeId,
                otp: otpCode
            })
        })
        .then(async response => {
            const data = await response.json();
            
            if (response.ok && data.status === 'authenticated') {
                console.log('Login OTP verified successfully.');
                fetch('/api/me')
                    .then(res => res.json())
                    .then(meData => {
                        if (meData.status === 'authenticated') {
                            showAuthenticatedState(meData.data.user);
                        }
                    });
            } else if (data.code === 'OTP_EXPIRED') {
                setExpiredOtpState();
            } else if (!response.ok) {
                setWrongOtpState(data.attemptsRemaining, data.message);
            }
        })
        .catch(error => {
            console.error('Verify OTP failed:', error);
            if(otpErrorText) {
                otpErrorText.textContent = 'Network error verifying code.';
                otpErrorText.style.display = 'block';
            }
        });
    };

    if (otpBoxes.length > 0) {
        otpBoxes.forEach((box, index) => {
            box.addEventListener('input', function() {
                if (this.value.length === 1) {
                    if (index < otpBoxes.length - 1) {
                        otpBoxes[index + 1].focus();
                    } else {
                        verifyLoginOtp();
                    }
                }
                
                if(otpErrorText) otpErrorText.style.display = 'none';
                otpBoxes.forEach(b => b.classList.remove('error'));
                
                this.value = this.value.replace(/[^0-9]/g, '');
            });

            box.addEventListener('keydown', (e) => {
                if (e.key === 'Backspace' && !e.target.value && index > 0) {
                    otpBoxes[index - 1].focus();
                }
            });
        });

        // Numpad for mobile
        const numpadKeys = document.querySelectorAll('.login-numpad .numpad-key');
        numpadKeys.forEach(key => {
            key.addEventListener('click', function() {
                if (this.classList.contains('numpad-delete')) {
                    for (let i = otpBoxes.length - 1; i >= 0; i--) {
                        if (otpBoxes[i].value !== '') {
                            otpBoxes[i].value = '';
                            otpBoxes[i].focus();
                            break;
                        }
                    }
                } else {
                    const number = this.textContent.trim();
                    for (let i = 0; i < otpBoxes.length; i++) {
                        if (otpBoxes[i].value === '') {
                            otpBoxes[i].value = number;
                            if (i < otpBoxes.length - 1) {
                                otpBoxes[i + 1].focus();
                            } else {
                                verifyLoginOtp();
                            }
                            break;
                        }
                    }
                }
                
                if(otpErrorText) otpErrorText.style.display = 'none';
                otpBoxes.forEach(b => b.classList.remove('error'));
            });
        });
    }

    const handleResend = (e) => {
        e.preventDefault();
        
        const activeOption = document.querySelector('#step-choose-method .mfa-option.active .mfa-option-title');
        let selectedMethod = 'email';
        if (activeOption && activeOption.textContent.includes('SMS')) selectedMethod = 'sms';

        fetch('/api/send-login-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: window.currentUserId,
                method: selectedMethod
            })
        })
        .then(async response => {
            const data = await response.json();
            if (response.ok) {
                window.currentLoginChallengeId = data.data.challengeId;
                
                // Reset UI state
                if(otpErrorText) otpErrorText.style.display = 'none';
                otpBoxes.forEach(b => {
                    b.classList.remove('error');
                    b.value = '';
                    b.disabled = false;
                });
                if(otpBoxes[0]) otpBoxes[0].focus();
                
                const otpResendContainer = document.getElementById('otpResendContainer');
                if (otpResendContainer) otpResendContainer.style.display = 'none';
                
                const authLinks = document.querySelector('.auth-links.text-center');
                if (authLinks) authLinks.style.display = 'block';
                
                const otpTimerText = document.getElementById('otpTimerText');
                if (otpTimerText) otpTimerText.style.display = 'block';
                
                alert('New code sent.');
            } else {
                alert(data.message || 'Error resending OTP');
            }
        })
        .catch(error => {
            console.error('Resend failed:', error);
            alert('Network error while resending.');
        });
    };

    if (resendLink) {
        resendLink.addEventListener('click', handleResend);
    }

    if (resendBtnSolid) {
        resendBtnSolid.addEventListener('click', handleResend);
    }
});

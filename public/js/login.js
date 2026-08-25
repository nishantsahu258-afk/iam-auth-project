document.addEventListener('DOMContentLoaded', () => {
    
    // ---------------------------------------------------------
    // Password Visibility Toggle
    // ---------------------------------------------------------
    const togglePasswordBtn = document.querySelector('.toggle-password');
    const passwordInput = document.getElementById('password');

    if (togglePasswordBtn && passwordInput) {
        togglePasswordBtn.addEventListener('click', () => {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            
            // Update icon
            if (type === 'text') {
                togglePasswordBtn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>';
            } else {
                togglePasswordBtn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
            }
        });
    }

    // ---------------------------------------------------------
    // Frontend Validation
    // ---------------------------------------------------------
    const loginForm = document.getElementById('loginForm');
    const emailInput = document.getElementById('email');
    const loginError = document.getElementById('loginError');

    // Helper to clear error when user types
    const clearErrorOnInput = (inputElement, groupPrefix) => {
        if (!inputElement) return;
        inputElement.addEventListener('input', () => {
            const group = document.getElementById(`${groupPrefix}-${inputElement.id}`);
            if (group && group.classList.contains('has-error')) {
                group.classList.remove('has-error');
                inputElement.classList.remove('error');
            }
            if (loginError) {
                loginError.style.display = 'none';
            }
        });
    };

    clearErrorOnInput(emailInput, 'group');
    clearErrorOnInput(passwordInput, 'group');

    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            // Reset errors
            document.querySelectorAll('.has-error').forEach(el => el.classList.remove('has-error'));
            document.querySelectorAll('.input-control.error').forEach(el => el.classList.remove('error'));
            if (loginError) loginError.style.display = 'none';

            // Helper to show errors
            const setError = (elementId, message) => {
                const group = document.getElementById(`group-${elementId}`);
                const input = document.getElementById(elementId);
                
                if (group) {
                    group.classList.add('has-error');
                    if (input) input.classList.add('error');
                    const errorText = group.querySelector('.error-text');
                    if (errorText) errorText.textContent = message;
                }
            };

            let isValid = true;

            // Validate Email/Username
            if (!emailInput.value.trim()) {
                setError('email', 'Email or Username is required.');
                isValid = false;
            }

            // Validate Password
            if (!passwordInput.value.trim()) {
                setError('password', 'Password is required.');
                isValid = false;
            }

            if (isValid) {
                // If everything is valid, we don't do API calls per requirements.
                // Just for testing UI state, we can simulate an invalid credential state.
                // For now, we will just show a top-level fake error to show that the submit action worked.
                if (loginError) {
                    loginError.textContent = 'Invalid email or password. Please try again.';
                    loginError.style.display = 'block';
                    
                    // Add error class to inputs to match invalid credentials mockup
                    setError('email', '');
                    setError('password', '');
                }
            }
        });
    }
});

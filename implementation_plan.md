# Phase 2: Login Journey - Step 1

This plan outlines the steps to build the Default Login screen to perfectly match the provided SecureID mockups (Mobile and Web), keeping the existing Registration Journey completely untouched.

## Proposed Changes

### 1. Create Login HTML (`public/login.html`)
- **Structure**: Create a brand new HTML file for the login flow.
- **Form Layout**: 
  - Email/Username field.
  - Password field with a Show/Hide toggle.
  - A flex row for the "Remember me" checkbox and "Forgot password?" link.
  - Primary "Login" button.
  - Visual "or" divider.
  - Secondary "Continue with Google" button.
  - "New here? Create an account" link pointing to `index.html`.
- **Responsive Layout**:
  - **Mobile**: Centered structure with top logo, similar to the mobile registration flow.
  - **Desktop**: A split-card layout. The left side will feature a blue sidebar with the SecureID logo and tagline ("Secure access to your account"). The right side will contain the login form.

### 2. Add Login-Specific CSS (`public/css/style.css`)
- Re-use existing variables (`--primary-color`, etc.) and classes (`.input-control`, `.btn-primary`).
- **New Classes**:
  - `.login-wrapper`: Flex container that switches to a 2-column grid on desktop screens (`@media (min-width: 1024px)`).
  - `.login-sidebar`: The blue left panel (visible on Desktop only).
  - `.login-form-area`: The right panel containing the form.
  - `.divider`: For the "or" text with lines on the sides.
  - `.btn-google`: Styling for the secondary Google button with an icon.

### 3. Add Frontend Validation (`public/js/login.js`)
- Handle the **Password Visibility** toggle.
- Implement **Frontend Validation** on form submit:
  - If Email/Username is empty: Show existing `.error-text` (red border, red text).
  - If Password is empty: Show error.
- **Strictly No Backend**: As per your constraints, `login.js` will *only* handle visual validation and will *not* contain API calls, OTP logic, or session handling at this stage.

## Open Questions / Clarifications
- I will reuse the existing Shield logo SVG that is currently blue, but I will make a white version of it for the blue desktop sidebar.
- "Forgot password?" will just be an anchor tag `href="#"` since there is no destination yet.
- I'll use the existing `public/css/style.css` so we don't duplicate fonts and variables, appending the new login classes to the bottom.

If this approach perfectly aligns with your instructions for Step 1, click **Proceed** and I will implement the code!

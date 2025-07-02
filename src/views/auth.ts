export const loginPage = (error?: string): string => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Hangman Game - Login</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/static/styles.css">
  <style>
    .auth-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
      padding: 1rem;
    }
    .auth-card {
      background: white;
      padding: 2rem;
      border-radius: 1rem;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
      max-width: 400px;
      width: 100%;
      text-align: center;
    }
    .auth-title {
      color: var(--primary-color);
      margin-bottom: 1.5rem;
      font-size: 2rem;
      font-weight: 600;
    }
    .auth-subtitle {
      color: var(--text-color);
      margin-bottom: 2rem;
      line-height: 1.6;
    }
    .username-form {
      margin-bottom: 1.5rem;
    }
    .username-input {
      width: 100%;
      padding: 0.75rem;
      border: 2px solid #e0e0e0;
      border-radius: 0.5rem;
      font-size: 1rem;
      margin-bottom: 1rem;
      box-sizing: border-box;
      transition: border-color 0.2s;
    }
    .username-input:focus {
      outline: none;
      border-color: var(--secondary-color);
    }
    .auth-button {
      width: 100%;
      padding: 0.75rem 1.5rem;
      background: var(--secondary-color);
      color: white;
      border: none;
      border-radius: 0.5rem;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      margin-bottom: 0.5rem;
    }
    .auth-button:hover:not(:disabled) {
      background: #2980b9;
      transform: translateY(-1px);
    }
    .auth-button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }
    .auth-button.secondary {
      background: var(--success-color);
    }
    .auth-button.secondary:hover:not(:disabled) {
      background: #27ae60;
    }
    .error-message {
      color: var(--danger-color);
      margin-top: 1rem;
      padding: 0.75rem;
      background: #ffebee;
      border-radius: 0.5rem;
      border-left: 4px solid var(--danger-color);
    }
    .webauthn-info {
      font-size: 0.9rem;
      color: #666;
      margin-top: 1rem;
      padding: 1rem;
      background: #f8f9fa;
      border-radius: 0.5rem;
    }
    .loading {
      display: none;
    }
    .loading.active {
      display: inline-block;
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="auth-container">
    <div class="auth-card">
      <h1 class="auth-title">🎮 Hangman Game</h1>
      <p class="auth-subtitle">
        Welcome! Enter your username and use your biometric device (fingerprint, face ID, or security key) to securely login.
      </p>
      
      <div class="username-form">
        <input 
          type="text" 
          id="username" 
          class="username-input" 
          placeholder="Enter your username"
          autocomplete="username webauthn"
          required
        />
        <button id="loginBtn" class="auth-button">
          <span class="loading">⏳</span>
          <span class="text">Login with Biometrics</span>
        </button>
        <button id="registerBtn" class="auth-button secondary">
          <span class="loading">⏳</span>
          <span class="text">Register New Device</span>
        </button>
      </div>

      ${error ? `<div class="error-message">${error}</div>` : ''}
      
      <div class="webauthn-info">
        <strong>🔒 Secure Authentication</strong><br>
        This site uses WebAuthn for passwordless authentication. Your biometric data never leaves your device.
      </div>
    </div>
  </div>

  <script>
    const usernameInput = document.getElementById('username');
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');

    // Utility functions
    function showLoading(button) {
      button.disabled = true;
      button.querySelector('.loading').classList.add('active');
      button.querySelector('.text').style.opacity = '0.7';
    }

    function hideLoading(button) {
      button.disabled = false;
      button.querySelector('.loading').classList.remove('active');
      button.querySelector('.text').style.opacity = '1';
    }

    function showError(message) {
      const existing = document.querySelector('.error-message');
      if (existing) existing.remove();
      
      const error = document.createElement('div');
      error.className = 'error-message';
      error.textContent = message;
      document.querySelector('.auth-card').appendChild(error);
    }

    function arrayBufferToBase64(buffer) {
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
      // Convert to base64url: replace + with -, / with _, and remove padding
      return base64.replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '');
    }

    function base64ToArrayBuffer(base64) {
      // Convert from base64url to base64: replace - with +, _ with /, and add padding
      let standardBase64 = base64.replace(/-/g, '+').replace(/_/g, '/');
      // Add padding if needed
      while (standardBase64.length % 4) {
        standardBase64 += '=';
      }
      return Uint8Array.from(atob(standardBase64), c => c.charCodeAt(0));
    }

    // Registration flow
    registerBtn.addEventListener('click', async () => {
      const username = usernameInput.value.trim();
      if (!username) {
        showError('Please enter a username');
        return;
      }

      showLoading(registerBtn);

      try {
        // Get registration options
        const optionsResponse = await fetch(\`/auth/register/options?username=\${encodeURIComponent(username)}\`);
        if (!optionsResponse.ok) {
          throw new Error('Failed to get registration options');
        }
        
        const options = await optionsResponse.json();
        options.challenge = base64ToArrayBuffer(options.challenge);
        options.user.id = base64ToArrayBuffer(arrayBufferToBase64(options.user.id));

        // Create credential
        const credential = await navigator.credentials.create({ publicKey: options });
        
        // Verify registration
        const verifyResponse = await fetch(\`/auth/register/verify?username=\${encodeURIComponent(username)}\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: credential.id,
            rawId: arrayBufferToBase64(credential.rawId),
            response: {
              clientDataJSON: arrayBufferToBase64(credential.response.clientDataJSON),
              attestationObject: arrayBufferToBase64(credential.response.attestationObject),
            },
          }),
        });

        if (verifyResponse.ok) {
          alert('Registration successful! You can now login.');
        } else {
          throw new Error('Registration verification failed');
        }
      } catch (error) {
        console.error('Registration error:', error);
        showError(error.message || 'Registration failed');
      } finally {
        hideLoading(registerBtn);
      }
    });

    // Login flow
    loginBtn.addEventListener('click', async () => {
      const username = usernameInput.value.trim();
      if (!username) {
        showError('Please enter a username');
        return;
      }

      showLoading(loginBtn);

      try {
        // Get authentication options
        const optionsResponse = await fetch(\`/auth/login/options?username=\${encodeURIComponent(username)}\`);
        if (!optionsResponse.ok) {
          throw new Error('Failed to get login options');
        }
        
        const options = await optionsResponse.json();
        console.log("Login options received:", options);
        options.challenge = base64ToArrayBuffer(options.challenge);
        
        // Convert credential IDs from base64url strings to ArrayBuffers
        options.allowCredentials = options.allowCredentials.map(cred => {
          console.log("Converting credential ID:", cred.id, "type:", typeof cred.id);
          return {
            ...cred,
            id: base64ToArrayBuffer(cred.id),
          };
        });
        
        console.log("Processed options:", options);

        // Get assertion
        const assertion = await navigator.credentials.get({ publicKey: options });
        
        // Verify authentication
        const verifyResponse = await fetch(\`/auth/login/verify?username=\${encodeURIComponent(username)}\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: assertion.id,
            rawId: arrayBufferToBase64(assertion.rawId),
            response: {
              clientDataJSON: arrayBufferToBase64(assertion.response.clientDataJSON),
              authenticatorData: arrayBufferToBase64(assertion.response.authenticatorData),
              signature: arrayBufferToBase64(assertion.response.signature),
              userHandle: assertion.response.userHandle ? arrayBufferToBase64(assertion.response.userHandle) : null,
            },
          }),
        });

        const result = await verifyResponse.json();
        if (result.success) {
          window.location.href = '/';
        } else {
          throw new Error('Authentication failed');
        }
      } catch (error) {
        console.error('Login error:', error);
        showError(error.message || 'Login failed. Try registering first.');
      } finally {
        hideLoading(loginBtn);
      }
    });

    // Enter key support
    usernameInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        loginBtn.click();
      }
    });
  </script>
</body>
</html>
`;
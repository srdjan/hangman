export const loginPage = (error?: string): string => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Hangman Game - Login</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/static/styles.css">
</head>
<body>
  <div class="auth-container">
    <div class="auth-card">
      <h1 class="auth-title">🎮 Hangman Game</h1>
      <p class="auth-subtitle">
        Welcome! Enter your @fadv.com email address and use your biometric device (fingerprint, face ID, or security key) to securely login.
      </p>
      
      <div class="username-form">
        <input 
          type="email" 
          id="username" 
          class="username-input" 
          placeholder="Enter your @fadv.com email"
          autocomplete="username webauthn"
          pattern="[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
          title="Please enter a valid @fadv.com email address"
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

    // Global variable to track if conditional UI is available
    let conditionalUIAvailable = false;

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

    // Email validation function
    function validateEmail(email) {
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      return emailRegex.test(email);
    }

    // Conditional UI (Autofill) function
    async function startConditionalUI() {
      try {
        console.log('Starting conditional UI...');
        
        // Check if conditional UI is supported
        if (!window.PublicKeyCredential || !PublicKeyCredential.isConditionalMediationAvailable) {
          console.log('Conditional UI not supported');
          return;
        }
        
        const available = await PublicKeyCredential.isConditionalMediationAvailable();
        if (!available) {
          console.log('Conditional UI not available');
          return;
        }
        
        conditionalUIAvailable = true;
        console.log('Conditional UI available, starting background request...');
        
        // Get conditional authentication options from server
        const optionsResponse = await fetch('/auth/conditional/options');
        if (!optionsResponse.ok) {
          console.log('Failed to get conditional UI options');
          return;
        }
        
        const options = await optionsResponse.json();
        console.log('Conditional UI options:', options);
        
        // Convert challenge to ArrayBuffer
        options.challenge = base64ToArrayBuffer(options.challenge);
        
        const credential = await navigator.credentials.get({
          publicKey: options,
          mediation: 'conditional' // This is the key for conditional UI
        });
        
        if (credential) {
          console.log('User selected a passkey from conditional UI');
          await handleConditionalLogin(credential);
        }
      } catch (error) {
        console.log('Conditional UI error (this is normal if user cancels):', error);
      }
    }

    // Handle login when user selects a passkey from conditional UI
    async function handleConditionalLogin(credential) {
      console.log('Handling conditional login...');
      
      try {
        showLoading(loginBtn);
        
        // First, identify the user from the credential
        const identifyResponse = await fetch('/auth/identify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            credentialId: credential.id
          })
        });
        
        if (!identifyResponse.ok) {
          throw new Error('Failed to identify user from passkey');
        }
        
        const { username } = await identifyResponse.json();
        console.log('Identified user:', username);
        
        // Fill in the username field
        usernameInput.value = username;
        
        // Now verify the credential using the conditional challenge
        const verifyResponse = await fetch('/auth/conditional/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: username,
            credential: {
              id: credential.id,
              rawId: arrayBufferToBase64(credential.rawId),
              response: {
                clientDataJSON: arrayBufferToBase64(credential.response.clientDataJSON),
                authenticatorData: arrayBufferToBase64(credential.response.authenticatorData),
                signature: arrayBufferToBase64(credential.response.signature),
                userHandle: credential.response.userHandle ? arrayBufferToBase64(credential.response.userHandle) : null,
              },
            }
          }),
        });
        
        if (!verifyResponse.ok) {
          throw new Error('Authentication failed');
        }
        
        const result = await verifyResponse.json();
        
        if (result.success && result.redirect) {
          window.location.href = result.redirect;
        } else if (result.success) {
          window.location.href = '/';
        } else {
          throw new Error('Login verification failed');
        }
      } catch (error) {
        console.error('Conditional login error:', error);
        showError('Login failed. Please try again.');
      } finally {
        hideLoading(loginBtn);
      }
    }

    // Perform login with credential and username
    async function performLogin(credential, username) {
      showLoading(loginBtn);
      
      try {
        // Get authentication options for this specific user
        const optionsResponse = await fetch(\`/auth/login/options?username=\${encodeURIComponent(username)}\`);
        if (!optionsResponse.ok) {
          throw new Error('Failed to get login options');
        }
        
        const options = await optionsResponse.json();
        
        // Verify the credential we already have
        const verifyResponse = await fetch(\`/auth/login/verify?username=\${encodeURIComponent(username)}\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: credential.id,
            rawId: arrayBufferToBase64(credential.rawId),
            response: {
              clientDataJSON: arrayBufferToBase64(credential.response.clientDataJSON),
              authenticatorData: arrayBufferToBase64(credential.response.authenticatorData),
              signature: arrayBufferToBase64(credential.response.signature),
              userHandle: credential.response.userHandle ? arrayBufferToBase64(credential.response.userHandle) : null,
            },
          }),
        });
        
        if (!verifyResponse.ok) {
          throw new Error('Authentication failed');
        }
        
        const result = await verifyResponse.json();
        
        if (result.success && result.redirect) {
          window.location.href = result.redirect;
        } else if (result.success) {
          window.location.href = '/';
        } else {
          throw new Error('Login verification failed');
        }
      } catch (error) {
        console.error('Login error:', error);
        showError(error.message || 'Login failed');
      } finally {
        hideLoading(loginBtn);
      }
    }

    // Registration flow
    registerBtn.addEventListener('click', async () => {
      const username = usernameInput.value.trim();
      if (!username) {
        showError('Please enter an email address');
        return;
      }
      
      if (!validateEmail(username)) {
        showError('Please enter a valid @fadv.com email address');
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
          const result = await verifyResponse.json();
          console.log('Registration result:', result);
          
          if (result.success && result.redirect) {
            console.log('Registration successful, redirecting to:', result.redirect);
            // Add newUser flag to URL so we can show welcome message
            const redirectUrl = result.newUser ? result.redirect + '?welcome=true' : result.redirect;
            window.location.href = redirectUrl;
            return;
          } else if (result.success) {
            // Fallback redirect if no redirect specified
            console.log('Registration successful, redirecting to home page...');
            window.location.href = '/?welcome=true';
            return;
          } else {
            throw new Error('Registration verification failed');
          }
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
      console.log('=== LOGIN BUTTON CLICKED ===');
      const username = usernameInput.value.trim();
      console.log('Username value:', username);
      
      if (!username) {
        console.log('No username provided');
        showError('Please enter an email address');
        return;
      }
      
      if (!validateEmail(username)) {
        console.log('Email validation failed for:', username);
        showError('Please enter a valid @fadv.com email address');
        return;
      }

      console.log('Starting login process for:', username);
      showLoading(loginBtn);

      try {
        // Get authentication options
        console.log('Fetching login options...');
        const optionsResponse = await fetch(\`/auth/login/options?username=\${encodeURIComponent(username)}\`);
        console.log('Options response status:', optionsResponse.status);
        
        if (!optionsResponse.ok) {
          console.log('Failed to get login options, status:', optionsResponse.status);
          const errorText = await optionsResponse.text();
          console.log('Error response:', errorText);
          throw new Error(errorText || 'Failed to get login options');
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

        console.log('Verify response status:', verifyResponse.status);
        console.log('Verify response ok:', verifyResponse.ok);
        
        if (!verifyResponse.ok) {
          const statusText = 'Server responded with status ' + verifyResponse.status;
          throw new Error(statusText);
        }
        
        const result = await verifyResponse.json();
        console.log('Login result:', result);
        console.log('Result success:', result.success);
        console.log('Result redirect:', result.redirect);
        
        if (result.success && result.redirect) {
          console.log('Login successful, redirecting to:', result.redirect);
          console.log('About to set window.location.href to:', result.redirect);
          window.location.href = result.redirect;
          console.log('window.location.href has been set');
          return;
        }
        
        if (result.success) {
          console.log('Login successful, redirecting to home page...');
          console.log('About to set window.location.href to: /');
          window.location.href = '/';
          console.log('window.location.href has been set to /');
          return;
        }
        
        console.log('Login verification failed, result was:', result);
        throw new Error('Login verification failed');
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

    // Start conditional UI when page loads
    document.addEventListener('DOMContentLoaded', () => {
      startConditionalUI();
    });

    // Also start conditional UI immediately if DOMContentLoaded already fired
    if (document.readyState === 'loading') {
      // Document still loading, wait for DOMContentLoaded
    } else {
      // Document already loaded
      startConditionalUI();
    }
  </script>
</body>
</html>
`;
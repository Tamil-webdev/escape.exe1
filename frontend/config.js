(function () {
  const localHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const configuredApiUrl = window.__CODE_NOIR_API_URL || window.API_URL || window.CODE_NOIR_API_URL || '';

  if (configuredApiUrl) {
    window.API_URL = configuredApiUrl;
    window.__CODE_NOIR_API_URL = configuredApiUrl;
    return;
  }

  window.API_URL = localHost ? 'http://localhost:3001' : 'https://your-backend-domain.example.com';
  window.__CODE_NOIR_API_URL = window.API_URL;
})();

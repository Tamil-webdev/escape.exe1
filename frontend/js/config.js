(function () {
  const localHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const configuredApiUrl = window.__CODE_NOIR_API_URL || window.API_URL || window.CODE_NOIR_API_URL || '';

  if (configuredApiUrl) {
    window.API_URL = configuredApiUrl.trim().replace(/\/$/, '');
    window.__CODE_NOIR_API_URL = window.API_URL;
    return;
  }

  const fallbackApiUrl = localHost
    ? 'http://localhost:3001'
    : 'https://your-render-backend-url.onrender.com';

  window.API_URL = fallbackApiUrl;
  window.__CODE_NOIR_API_URL = window.API_URL;
})();

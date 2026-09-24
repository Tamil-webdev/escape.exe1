(function () {
  const API_BASE_URL =
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:3001'
      : '';

  const configuredApiUrl = window.__CODE_NOIR_API_URL || window.API_URL || window.CODE_NOIR_API_URL || '';

  if (configuredApiUrl) {
    window.API_BASE_URL = configuredApiUrl.trim().replace(/\/$/, '');
    window.API_URL = window.API_BASE_URL;
    window.__CODE_NOIR_API_URL = window.API_URL;
    return;
  }

  window.API_BASE_URL = API_BASE_URL;
  window.API_URL = API_BASE_URL;
  window.__CODE_NOIR_API_URL = window.API_URL;
})();

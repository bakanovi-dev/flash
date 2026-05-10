(function configureApiBase() {
  if (typeof window.API_BASE === 'string') return;

  var location = window.location;
  var isLocalHost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  var isStaticDevServer = isLocalHost && location.port === '8080';

  window.API_BASE = isStaticDevServer ? 'http://localhost:8000' : '';
})();

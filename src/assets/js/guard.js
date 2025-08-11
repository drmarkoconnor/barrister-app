// src/assets/js/guard.js
(function () {
  try {
    if (sessionStorage.getItem('barristerLoggedIn') !== 'true') {
      // Allow the login page itself through (defensive)
      if (!/^\/app\//.test(location.pathname)) return;
      location.replace('/');
    }
  } catch (e) {
    // If sessionStorage is blocked, fall back to redirect
    if (/^\/app\//.test(location.pathname)) location.replace('/');
  }
})();

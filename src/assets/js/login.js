// src/assets/js/login.js
(function () {
  var btn = document.getElementById('loginBtn');
  var input = document.getElementById('passwordInput');
  var error = document.getElementById('errorMsg');

  function doLogin() {
    var val = (input.value || '').trim();
    if (val === '1234') {
      sessionStorage.setItem('barristerLoggedIn', 'true');
      window.location.href = '/app/dashboard/';
    } else {
      error && error.classList.remove('d-none');
    }
  }

  btn && btn.addEventListener('click', doLogin);
  input && input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') doLogin();
  });
})();

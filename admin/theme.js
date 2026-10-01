// Applies the saved admin theme before first paint. Light is the default;
// dark applies only after the visitor chooses it with the toggle.
(function applySavedTheme() {
  var theme = 'light';
  try {
    if (localStorage.getItem('mixmash.admin.theme') === 'dark') theme = 'dark';
  } catch (error) {
    // Storage can be blocked (private windows, previews); light still renders.
  }
  document.documentElement.setAttribute('data-theme', theme);
}());

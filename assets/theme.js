/* Resolve the saved choice before first paint. Keep the original dark presentation by default. */
(() => {
  let theme = 'dark';
  try { theme = localStorage.getItem('nxl-web-theme') === 'light' ? 'light' : 'dark'; } catch {}
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
})();

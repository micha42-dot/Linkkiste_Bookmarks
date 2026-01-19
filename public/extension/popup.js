// Cross-browser compatibility (Firefox uses 'browser', Chrome/others use 'chrome')
const api = window.browser || window.chrome;

document.addEventListener('DOMContentLoaded', () => {
  const setupView = document.getElementById('setup-view');
  const appFrame = document.getElementById('app-frame');
  const instanceInput = document.getElementById('instance-url');
  const saveSetupBtn = document.getElementById('save-setup');

  // 1. Check if we have the LinkKiste URL saved
  api.storage.local.get(['linkkisteUrl'], (result) => {
    if (result && result.linkkisteUrl) {
      loadIframe(result.linkkisteUrl);
    } else {
      showSetup();
    }
  });

  function showSetup() {
    setupView.classList.remove('hidden');
    appFrame.classList.add('hidden');
  }

  function loadIframe(baseUrl) {
    setupView.classList.add('hidden');
    appFrame.classList.remove('hidden');

    // 2. Get Current Tab Info
    api.tabs.query({active: true, currentWindow: true}, (tabs) => {
      const currentTab = tabs[0];
      if (!currentTab) return;

      const pageUrl = currentTab.url || '';
      const pageTitle = currentTab.title || '';

      // 3. Construct URL with mode=popup
      // We encode the params to make sure special characters don't break the URL
      const targetUrl = `${baseUrl}?mode=popup&url=${encodeURIComponent(pageUrl)}&title=${encodeURIComponent(pageTitle)}`;
      
      appFrame.src = targetUrl;
    });
  }

  saveSetupBtn.addEventListener('click', () => {
    let url = instanceInput.value.trim();
    if (!url) return;
    
    // Ensure protocol
    if (!url.startsWith('http')) {
        url = 'https://' + url;
    }
    
    // Remove trailing slash
    if (url.endsWith('/')) url = url.slice(0, -1);

    api.storage.local.set({ linkkisteUrl: url }, () => {
      loadIframe(url);
    });
  });
});
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
    // Pre-fill from storage if user wants to edit
    api.storage.local.get(['linkkisteUrl'], (res) => {
        if(res.linkkisteUrl) instanceInput.value = res.linkkisteUrl;
    });
  }

  function loadIframe(baseUrl) {
    setupView.classList.add('hidden');
    appFrame.classList.remove('hidden');

    api.tabs.query({active: true, currentWindow: true}, (tabs) => {
      const currentTab = tabs[0];
      if (!currentTab) return;

      const pageUrl = currentTab.url || '';
      const pageTitle = currentTab.title || '';

      // Construct URL to point to the dedicated popup.html
      // Remove trailing slash if present
      const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
      
      const timestamp = new Date().getTime();
      
      // CRITICAL: We pass mode=popup so App.tsx recognizes it even if popup.html fallback occurs
      const targetUrl = `${cleanBase}/popup.html?url=${encodeURIComponent(pageUrl)}&title=${encodeURIComponent(pageTitle)}&mode=popup&t=${timestamp}`;
      
      appFrame.src = targetUrl;
    });
  }

  saveSetupBtn.addEventListener('click', () => {
    let url = instanceInput.value.trim();
    if (!url) return;
    
    if (!url.startsWith('http')) {
        url = 'https://' + url;
    }
    
    if (url.endsWith('/')) url = url.slice(0, -1);

    api.storage.local.set({ linkkisteUrl: url }, () => {
      loadIframe(url);
    });
  });
  
  // Allow double-clicking the title to re-open setup (in case of typo)
  document.querySelector('h1')?.addEventListener('dblclick', () => {
      showSetup();
  });
});
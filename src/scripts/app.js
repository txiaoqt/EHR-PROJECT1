// frontend/src/scripts/app.js
(function(){
  const THEME_KEY = 'ehr_theme';

  function applyTheme(mode){
    // explicit modes: 'light' or 'dark'
    if(mode === 'dark'){
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem(THEME_KEY, 'dark');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
      localStorage.setItem(THEME_KEY, 'light');
    }
  }
  // expose globally
  window.applyTheme = applyTheme;

  // New Global Function: CSV Export
  window.exportCsv = function(filename='report.csv', csvData="name,data\ndemo,1"){
    const blob = new Blob([csvData], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };


  // initialize theme: saved -> prefers -> default light
  const saved = localStorage.getItem(THEME_KEY)
    || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  applyTheme(saved);

  // page loader (keeps previous behavior)
  async function tryFetchPage(page){
    const cands = [
      `../src/pages/${page}.html`,
      `../src/pages/${page.toLowerCase()}.html`,
      `../src/pages/${page.replace(/s$/,'')}.html`,
      `../src/pages/${page}s.html`
    ];
    for(const u of cands){
      try { const r = await fetch(u); if(r.ok) return { html: await r.text(), url: u }; } catch(e){}
    }
    return null;
  }

  async function loadPage(page='dashboard', params={}){
    const main = document.getElementById('main-content'); if(!main) return;
    main.innerHTML = `<div class="card">Loading…</div>`;
    const result = await tryFetchPage(page);
    if(!result){ main.innerHTML = `<div class="card">Page "<strong>${page}</strong>" not found.</div>`; return;}

    // insert HTML
    main.innerHTML = result.html;

    // Execute any scripts found in the injected HTML:
    // - inline scripts -> execute by creating new <script> with same text
    // - external scripts (src) -> create script tag and append (async load)
    try {
      const scripts = Array.from(main.querySelectorAll('script'));
      for (const oldScript of scripts) {
        try {
          const newScript = document.createElement('script');
          // copy attributes (type, src, async, defer, etc.)
          for (const attr of oldScript.attributes) {
            newScript.setAttribute(attr.name, attr.value);
          }
          if (oldScript.src) {
            // external script: append to head so it loads and executes
            document.head.appendChild(newScript);
          } else {
            // inline script: move/replace so it executes
            newScript.textContent = oldScript.textContent;
            oldScript.parentNode.replaceChild(newScript, oldScript);
          }
        } catch (e) {
          console.warn('Error executing injected script', e);
        }
      }
    } catch(e){
      console.warn('Script execution helper failed', e);
    }

    // If the loaded page wants to react to params, dispatch a custom event
    if(Object.keys(params).length){
      main.dispatchEvent(new CustomEvent('page:params',{detail:params}));
    }

    // hook for pages that require JS wiring
    if(typeof window.onPageLoaded === 'function') try { window.onPageLoaded(page, params); } catch(e){}
  }

  document.addEventListener('DOMContentLoaded', ()=> loadPage('dashboard'));
  window.addEventListener('app:navigate', (e)=> loadPage(e.detail?.page || 'dashboard', e.detail?.params || {}));
  window.goToSettings = function(){ window.dispatchEvent(new CustomEvent('app:navigate',{detail:{page:'settings'}})); };

  // keyboard shortcut to focus search
  window.addEventListener('keydown', (ev)=> {
    if((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'k'){
      ev.preventDefault();
      const input = document.querySelector('#main-content input[type="search"], #main-content input[type="text"]');
      if(input) input.focus();
    }
  });

})();
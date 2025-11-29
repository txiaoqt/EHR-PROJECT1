(async function(){
  const container = document.getElementById('sidebar-container');
  if(!container) return;

  try {
    const resp = await fetch('../src/components/sidebar/sidebar.html');
    const html = await resp.text();
    container.innerHTML = html;

    // update profile display from stored user
    const stored = JSON.parse(localStorage.getItem('ehr_user') || 'null');
    if(stored){
      const avatar = container.querySelector('.avatar');
      const footer = container.querySelector('.sidebar-footer');
      if(footer) footer.querySelector('div').innerHTML = `Logged in as <strong>${stored.name}</strong>`;
      if(avatar && stored.avatar) avatar.src = stored.avatar;
    }

    // nav items
    container.querySelectorAll('.menu-item').forEach(item=>{
      item.addEventListener('click', ()=> {
        container.querySelectorAll('.menu-item').forEach(i=>i.classList.remove('active'));
        item.classList.add('active');
        const page = item.dataset.page;
        window.dispatchEvent(new CustomEvent('app:navigate', { detail: { page } }));
      });
    });

    // profile dropdown toggle
    const profileBtn = container.querySelector('#profileBtn');
    const profileMenu = container.querySelector('#profileMenu');
    profileBtn?.addEventListener('click', (e)=>{
      const expanded = profileBtn.getAttribute('aria-expanded') === 'true';
      profileBtn.setAttribute('aria-expanded', expanded ? 'false' : 'true');
      if(profileMenu) profileMenu.classList.toggle('hidden');
    });

    // PROFILE: view **my profile** (signed-in user)
    container.querySelector('#profileView')?.addEventListener('click', ()=>{
      profileMenu?.classList.add('hidden');
      // navigate to a new "my-profile" page (not patient-profile)
      window.dispatchEvent(new CustomEvent('app:navigate', { detail: { page: 'my-profile' } }));
    });

    container.querySelector('#profileSettings')?.addEventListener('click', ()=>{
      profileMenu?.classList.add('hidden');
      window.goToSettings?.();
    });
    container.querySelector('#signOut')?.addEventListener('click', ()=>{
      localStorage.removeItem('ehr_user');
      window.dispatchEvent(new CustomEvent('app:navigate', { detail: { page: 'login' } }));
    });

    // prevent the main content from receiving focus/scroll when menu opens
if (profileMenu && !profileMenu.classList.contains('hidden')) {
  // menu opened
  document.getElementById('sidebar-container')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}


    // footer settings/signout
    container.querySelector('#sidebarSettings')?.addEventListener('click', ()=> window.goToSettings?.());
    container.querySelector('#sidebarSignout')?.addEventListener('click', ()=>{
      localStorage.removeItem('ehr_user');
      window.dispatchEvent(new CustomEvent('app:navigate', { detail: { page: 'login' } }));
    });

    // close profile menu when clicking outside
    document.addEventListener('click', (ev)=>{
      if(!container.contains(ev.target)){
        profileMenu?.classList.add('hidden');
        profileBtn?.setAttribute('aria-expanded','false');
      }
    });

  } catch(err){
    console.error('Failed to load sidebar', err);
    container.innerHTML = '<div style="padding:12px;color:var(--muted)">Sidebar failed to load</div>';
  }
})();

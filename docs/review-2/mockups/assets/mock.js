// Theme switch for the mockups: ?t=mono|cliffs|climb|spidey. The switcher hides when ?shot is set.
(function () {
  const q = new URLSearchParams(location.search), t = q.get('t') || 'mono';
  document.querySelectorAll('.scr').forEach(s => s.dataset.theme = t);
  document.documentElement.dataset.t = t;
  if (!q.has('shot')) {
    const sw = document.createElement('div'); sw.className = 'switch';
    sw.innerHTML = [['mono', 'Agent'], ['cliffs', 'Summit'], ['climb', 'Boulder'], ['spidey', 'Skyline']].map(([k, n]) => `<a href="?t=${k}">${n}</a>`).join('');
    document.body.appendChild(sw);
  }
  const ic = {
    today: '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/>',
    friends: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1-3.6 3.6-5.5 6.5-5.5s5.5 1.9 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5c2 .6 3.2 2.4 3.6 5"/>',
    progress: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
    me: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.2-4 4.3-6 8-6s6.8 2 8 6"/>'
  };
  document.querySelectorAll('nav.tabs').forEach(n => {
    const on = n.dataset.on, tab = (k, l) => `<div class="tab${on === k ? ' on' : ''}"><svg viewBox="0 0 24 24">${ic[k]}</svg>${l}</div>`;
    n.innerHTML = tab('today', 'Today') + tab('friends', 'Friends') + '<div class="plus" aria-label="Start a workout"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></div>' + tab('progress', 'Progress') + tab('me', 'Me');
  });
  // per-theme copy: [data-mono]="..." etc on any element
  document.querySelectorAll('[data-' + t + ']').forEach(e => { e.innerHTML = e.getAttribute('data-' + t); });
})();

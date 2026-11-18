/**
 * Main app — renders content into the skeleton and initializes effects.
 */
(async function init() {
  const { content, themes, presets } = await Templates.loadAll();
  const { theme, layout } = Templates.apply();

  // === GATE ===
  const gateImage = document.getElementById('gate-image');
  const gateBtn = document.getElementById('gate-btn');
  const gateScreen = document.getElementById('gate-screen');
  const invitation = document.getElementById('invitation');

  if (content.gate?.image) gateImage.src = content.gate.image;
  if (content.gate?.prompt) gateBtn.textContent = content.gate.prompt;

  gateBtn.addEventListener('click', () => {
    gateScreen.classList.add('opened');
    invitation.classList.remove('hidden');
    setTimeout(() => gateScreen.style.display = 'none', 800);
    startMusic();
  });

  // === MUSIC ===
  const audio = document.getElementById('bg-music');
  function startMusic() {
    if (content.music?.src) {
      audio.src = content.music.src;
      audio.volume = content.music.volume ?? 0.6;
      audio.play().catch(() => {});
    }
  }

  // === HERO ===
  setText('hero-tagline', content.hero?.tagline);
  setText('hero-name1', content.hero?.name1);
  setText('hero-name2', content.hero?.name2);
  setText('hero-invite', content.hero?.invite);
  setText('hero-scroll', content.hero?.scroll);
  setImg('hero-image', content.hero?.image);

  const datesEl = document.getElementById('hero-dates');
  if (content.hero?.dates) {
    datesEl.innerHTML = content.hero.dates.map(d => `<div>${d}</div>`).join('');
  }

  // Countdown
  if (content.hero?.countdownTo) {
    const target = new Date(content.hero.countdownTo).getTime();
    const cdEl = document.getElementById('hero-countdown');
    function tick() {
      const diff = target - Date.now();
      if (diff <= 0) { cdEl.textContent = 'The day has arrived ✨'; return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      cdEl.textContent = `${d} days · ${h} hrs · ${m} mins`;
    }
    tick(); setInterval(tick, 60000);
  }

  // === STORY ===
  setText('story-heading', content.story?.heading);
  setText('story-quote', content.story?.quote);
  setText('story-by', content.story?.by);

  // === GALLERY ===
  setText('gallery-label', content.gallery?.label);
  setText('gallery-heading', content.gallery?.heading);
  const galleryGrid = document.getElementById('gallery-grid');
  if (content.gallery?.images) {
    galleryGrid.innerHTML = content.gallery.images.map(img =>
      `<img src="${img.src}" alt="${img.alt || ''}" class="scroll-reveal" loading="lazy" />`
    ).join('');
  }

  // === FAMILIES ===
  setText('families-label', content.families?.label);
  setText('families-heading', content.families?.heading);
  const familiesGrid = document.getElementById('families-grid');
  if (content.families) {
    const renderFamily = (f) => `
      <div class="family-card scroll-reveal">
        <h3>${f.title}</h3>
        <p><strong>${f.name}</strong></p>
        <p>${f.relation}</p>
        <p>${f.parents.join(' & ')}</p>
      </div>`;
    familiesGrid.innerHTML = renderFamily(content.families.bride) + renderFamily(content.families.groom);
  }

  // === EVENTS ===
  setText('events-label', content.events?.label);
  setText('events-heading', content.events?.heading);
  const eventsContainer = document.getElementById('events-container');
  if (content.events?.days) {
    eventsContainer.innerHTML = content.events.days.map(day => `
      <div class="event-day">
        <h3>${day.date}</h3>
        ${day.items.map(item => `
          <div class="event-item scroll-reveal">
            <h4>${item.icon || ''} ${item.title}</h4>
            ${item.sub ? `<p class="sub">${item.sub}</p>` : ''}
            <p class="time">⏰ ${item.time}</p>
            ${item.theme ? `<p class="theme">👗 ${item.theme}</p>` : ''}
            <p class="text">${item.text}</p>
          </div>
        `).join('')}
      </div>
    `).join('');
  }

  // === BANNER ===
  setImg('banner-image', content.banner?.image);
  setText('banner-quote', content.banner?.quote);

  // === VENUE ===
  setText('venue-label', content.venue?.label);
  setText('venue-heading', content.venue?.heading);
  setImg('venue-image', content.venue?.image);
  setText('venue-name', content.venue?.name);
  const addrEl = document.getElementById('venue-address');
  if (content.venue?.address) addrEl.innerHTML = content.venue.address.join('<br>');
  const mapsBtn = document.getElementById('venue-maps');
  if (content.venue?.mapsUrl) {
    mapsBtn.href = content.venue.mapsUrl;
    mapsBtn.textContent = content.venue.mapsText || '📍 Open in Google Maps';
  }

  // === RSVP ===
  setText('rsvp-label', content.rsvp?.label);
  setText('rsvp-heading', content.rsvp?.heading);
  const introEl = document.getElementById('rsvp-intro');
  if (content.rsvp?.intro) {
    introEl.textContent = content.rsvp.intro.replace('{deadline}', content.rsvp.deadline || '');
  }
  fillSelect('rsvp-from', content.rsvp?.from);
  fillSelect('rsvp-events', content.rsvp?.events);
  fillSelect('rsvp-guests', content.rsvp?.guests);
  setText('rsvp-button', content.rsvp?.button);

  document.getElementById('rsvp-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('rsvp-name').value;
    const from = document.getElementById('rsvp-from').value;
    const events = document.getElementById('rsvp-events').value;
    const guests = document.getElementById('rsvp-guests').value;
    const msg = `*New RSVP*%0AName: ${name}%0AFrom: ${from}%0AEvents: ${events}%0AGuests: ${guests}`;
    if (content.rsvp?.whatsapp) {
      window.open(`https://wa.me/${content.rsvp.whatsapp}?text=${msg}`, '_blank');
    }
    document.getElementById('rsvp-form').classList.add('hidden');
    document.getElementById('rsvp-thanks').classList.remove('hidden');
    setText('rsvp-thanks-msg', content.rsvp?.thanks);
    setText('rsvp-thanks-by', content.rsvp?.thanksBy);
  });

  // === FOOTER ===
  setText('footer-names', content.footer?.names);
  setText('footer-blessing', content.footer?.blessing);
  const leftEl = document.getElementById('footer-left');
  const rightEl = document.getElementById('footer-right');
  if (content.footer?.left) leftEl.innerHTML = content.footer.left.join('<br>');
  if (content.footer?.right) rightEl.innerHTML = content.footer.right.join('<br>');
  setText('footer-regards', content.footer?.regards);

  // === SCROLL REVEAL ===
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  document.querySelectorAll('.scroll-reveal').forEach(el => observer.observe(el));

  // === PETALS (if enabled) ===
  if (theme.effects?.petals) {
    initPetals(theme.effects.petals, theme.colors);
  }

  // === CURSOR TRAIL (if enabled) ===
  if (theme.effects?.trail?.enabled) {
    initTrail(theme.effects.trail);
  }

  // === HELPERS ===
  function setText(id, val) { const el = document.getElementById(id); if (el && val) el.textContent = val; }
  function setImg(id, val) { const el = document.getElementById(id); if (el && val) el.src = val; }
  function fillSelect(id, arr) {
    const el = document.getElementById(id);
    if (!el || !arr) return;
    el.innerHTML = arr.map(v => `<option value="${v}">${v}</option>`).join('');
  }

  // === PETALS EFFECT ===
  function initPetals(counts, colors) {
    const canvas = document.getElementById('petals-canvas');
    const ctx = canvas.getContext('2d');
    let W, H;
    function resize() { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }
    resize(); window.addEventListener('resize', resize);

    const petals = [];
    const petalColors = [colors.primary, colors.secondary, colors.accent, '#ffffff'];
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    for (let i = 0; i < total; i++) {
      petals.push({
        x: Math.random() * W,
        y: Math.random() * H,
        size: 8 + Math.random() * 10,
        speedY: 0.5 + Math.random() * 1.2,
        speedX: -0.5 + Math.random() * 1,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: -0.02 + Math.random() * 0.04,
        color: petalColors[Math.floor(Math.random() * petalColors.length)]
      });
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      petals.forEach(p => {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size / 2, p.size, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        p.y += p.speedY;
        p.x += p.speedX;
        p.rot += p.rotSpeed;
        if (p.y > H + 20) { p.y = -20; p.x = Math.random() * W; }
        if (p.x > W + 20) p.x = -20;
        if (p.x < -20) p.x = W + 20;
      });
      requestAnimationFrame(draw);
    }
    draw();
  }

  // === CURSOR TRAIL ===
  function initTrail(cfg) {
    const trail = [];
    document.addEventListener('mousemove', (e) => {
      trail.push({ x: e.clientX, y: e.clientY, life: 1, color: cfg.colors[Math.floor(Math.random() * cfg.colors.length)] });
      if (trail.length > 30) trail.shift();
    });
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999;';
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    function resize() { canvas.width = innerWidth; canvas.height = innerHeight; }
    resize(); window.addEventListener('resize', resize);
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      trail.forEach((p, i) => {
        p.life -= 0.04;
        if (p.life <= 0) return;
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, cfg.size * p.life / 2, 0, Math.PI * 2);
        ctx.fill();
      });
      requestAnimationFrame(draw);
    }
    draw();
  }
})();
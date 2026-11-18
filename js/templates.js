/**
 * Loads all config from the server API (backed by Neon Postgres).
 * Falls back to static JSON files if the API is unreachable.
 */
const Templates = (() => {
  let contentConfig = null;
  let themesConfig = null;
  let presetsConfig = null;

  async function fetchJson(url) {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`${url} -> ${res.status}`);
    return res.json();
  }

  async function loadAll() {
    try {
      const data = await fetchJson('api/config');
      contentConfig = data.content;
      themesConfig = data.themes;
      presetsConfig = data.presets;
      if (!contentConfig || !themesConfig || !presetsConfig) throw new Error('Incomplete config payload');
    } catch (err) {
      console.warn('API config load failed, falling back to static files:', err.message);
      [contentConfig, themesConfig, presetsConfig] = await Promise.all([
        fetchJson('config/content.json'),
        fetchJson('config/themes.json'),
        fetchJson('config/presets.json'),
      ]);
    }
    return { content: contentConfig, themes: themesConfig, presets: presetsConfig };
  }

  function getActiveTheme() {
    const id = presetsConfig.active.theme;
    return themesConfig.themes.find(t => t.id === id) || themesConfig.themes[0];
  }

  function getActiveLayout() {
    const id = presetsConfig.active.layout;
    return presetsConfig.layouts.find(l => l.id === id) || presetsConfig.layouts[0];
  }

  function apply() {
    const theme = getActiveTheme();
    const layout = getActiveLayout();

    const cssLink = document.getElementById('template-css');
    if (cssLink) cssLink.href = layout.cssFile;

    document.body.className = '';
    document.body.classList.add(layout.bodyClass);
    document.body.classList.add(`anim-${layout.animation}`);

    const root = document.documentElement;
    root.style.setProperty('--color-primary', theme.colors.primary);
    root.style.setProperty('--color-secondary', theme.colors.secondary);
    root.style.setProperty('--color-accent', theme.colors.accent);
    root.style.setProperty('--color-bg', theme.colors.background);
    root.style.setProperty('--color-surface', theme.colors.surface);
    root.style.setProperty('--color-text', theme.colors.text);
    root.style.setProperty('--color-muted', theme.colors.muted);
    root.style.setProperty('--font-heading', theme.fonts.heading);
    root.style.setProperty('--font-body', theme.fonts.body);
    root.style.setProperty('--font-script', theme.fonts.script);

    if (contentConfig.meta?.title) document.title = contentConfig.meta.title;

    return { theme, layout };
  }

  function getConfigs() {
    return { content: contentConfig, themes: themesConfig, presets: presetsConfig };
  }

  return { loadAll, apply, getActiveTheme, getActiveLayout, getConfigs };
})();

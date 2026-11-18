const Templates = (() => {
  let contentConfig = null;
  let themesConfig = null;
  let presetsConfig = null;

  async function loadAll() {
    // Try to load from localStorage first (admin edits), else from files
    const storedContent = localStorage.getItem('config_content');
    const storedThemes = localStorage.getItem('config_themes');
    const storedPresets = localStorage.getItem('config_presets');

    [contentConfig, themesConfig, presetsConfig] = await Promise.all([
      storedContent ? Promise.resolve(JSON.parse(storedContent)) : fetch('config-content.json').then(r => r.json()),
      storedThemes ? Promise.resolve(JSON.parse(storedThemes)) : fetch('config-themes.json').then(r => r.json()),
      storedPresets ? Promise.resolve(JSON.parse(storedPresets)) : fetch('config-presets.json').then(r => r.json())
    ]);

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
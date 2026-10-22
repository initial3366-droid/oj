import { watchEffect } from 'vue';
import { SidebarColor, ThemeMode } from '../../../vendor/vue3-element-admin/src/enums/settings';
import { defaults } from '../../../vendor/vue3-element-admin/src/settings';
import { useSettingsStore } from '../../../vendor/vue3-element-admin/src/stores/settings';

/** QOJ uses one fixed light palette, regardless of OS preferences or old caches. */
export function useFixedLightTheme() {
  const settings = useSettingsStore();
  watchEffect(() => {
    if (settings.theme !== ThemeMode.LIGHT) settings.theme = ThemeMode.LIGHT;
    if (settings.sidebarColorScheme !== SidebarColor.MINIMAL_WHITE) settings.sidebarColorScheme = SidebarColor.MINIMAL_WHITE;
    if (settings.themePalette !== defaults.themePalette) settings.themePalette = defaults.themePalette;
    if (JSON.stringify(settings.themeColors) !== JSON.stringify(defaults.themeColors)) settings.themeColors = { ...defaults.themeColors };
    if (settings.grayMode) settings.grayMode = false;
    if (settings.colorWeak) settings.colorWeak = false;
    if (settings.settingsVisible) settings.settingsVisible = false;
    document.documentElement.dataset.theme = 'light';
  }, { flush: 'sync' });
}

/**
 * Per-brand design tokens. The base design system (light "warm paper") lives in
 * styles.css; entering a workspace overrides the brand-accent CSS variables on a
 * wrapper element so the ENTIRE workspace re-themes — accent, gradients, focus
 * rings, charts — while keeping the shared neutral canvas so it still reads as
 * one platform.
 *
 * Each theme maps directly onto the --brand* variables styles.css already uses,
 * so no component needs brand-specific code: swap the variables, the UI follows.
 */
export const BRAND_THEMES = {
  // H&S — deep navy + gold. Premium, institutional.
  hs: {
    accent: "#C99A2E",
    vars: {
      "--brand": "#1E3A5F",
      "--brand-2": "#16314F",
      "--brand-3": "#0F2740",
      "--brand-soft": "#DCE6F0",
      "--brand-tint": "#EEF3F8",
      "--brand-accent": "#C99A2E",
      "--shadow-brand": "0 6px 18px -4px rgba(30,58,95,.40)",
    },
  },

  // Deca — teal / mint on the light base. Modern, data-confident.
  deca: {
    accent: "#04D9B2",
    vars: {
      "--brand": "#0C8E7C",
      "--brand-2": "#0A7567",
      "--brand-3": "#085B50",
      "--brand-soft": "#D2F1EB",
      "--brand-tint": "#ECF8F5",
      "--brand-accent": "#04D9B2",
      "--shadow-brand": "0 6px 18px -4px rgba(12,142,124,.40)",
    },
  },

  // DPS — warm coral / amber. Welcoming, platform-neutral.
  dps: {
    accent: "#F0683C",
    vars: {
      "--brand": "#E8632F",
      "--brand-2": "#D2521F",
      "--brand-3": "#B5431A",
      "--brand-soft": "#FBE0D4",
      "--brand-tint": "#FDF1EA",
      "--brand-accent": "#F0683C",
      "--shadow-brand": "0 6px 18px -4px rgba(232,99,47,.40)",
    },
  },
};

// Platform default (CommandView) — the original emerald, the neutral "home".
export const PLATFORM_THEME = {
  accent: "#0E7A57",
  vars: {
    "--brand": "#0E7A57",
    "--brand-2": "#0B6248",
    "--brand-3": "#0A5640",
    "--brand-soft": "#E3F1EB",
    "--brand-tint": "#F0F7F3",
    "--brand-accent": "#0E7A57",
    "--shadow-brand": "0 6px 18px -4px rgba(14,122,87,.40)",
  },
};

export const themeVars = (brandId) =>
  (BRAND_THEMES[brandId] || PLATFORM_THEME).vars;

export const brandAccent = (brandId) =>
  (BRAND_THEMES[brandId] || PLATFORM_THEME).accent;

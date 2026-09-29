// نظام الثيمات المركزي - Morix Platform
import { watchEffect } from 'vue'

export const THEMES = {
  // ════════════════════════════════════════════
  // 🌙 Dark — Neon Glow
  // ════════════════════════════════════════════
  dark: {
    '--bg1':   '#080c14',
    '--bg2':   '#0d1420',
    '--bg3':   '#131c2e',
    '--text':  '#e2eaf8',
    '--t2':    '#7a8fad',
    '--text2': '#7a8fad',
    '--accent':'#4f9eff',
    '--border':'rgba(79,158,255,0.12)',
    '--card':  'rgba(13,20,32,0.85)',

    '--sidebar-bg':   'rgba(8,12,20,0.95)',
    '--topbar-bg':    'rgba(8,12,20,0.88)',
    '--modal-bg':     'rgba(13,20,32,0.95)',
    '--input-bg':     'rgba(19,28,46,0.9)',
    '--input-border': 'rgba(79,158,255,0.18)',
    '--input-focus':  'rgba(79,158,255,0.08)',

    '--card-blur':    'blur(16px)',
    '--sidebar-blur': 'blur(20px)',

    '--shadow':       '0 4px 24px rgba(0,0,0,0.5)',
    '--shadow-hover': '0 8px 32px rgba(79,158,255,0.22)',
    '--glow':         '0 0 0 1px rgba(79,158,255,0.3), 0 0 20px rgba(79,158,255,0.08)',
    '--glow2':        '0 4px 24px rgba(79,158,255,0.18)',
    '--glow-accent':  '0 0 30px rgba(79,158,255,0.35)',

    '--nav-active-bg':     'rgba(79,158,255,0.12)',
    '--nav-active-shadow': '0 0 12px rgba(79,158,255,0.2)',
    '--nav-hover-bg':      'rgba(79,158,255,0.06)',

    '--btn-gradient': 'linear-gradient(135deg, #1a5fcc, #4f9eff)',
    '--btn-text':     '#ffffff',
    '--btn-glow':     '0 0 20px rgba(79,158,255,0.4)',

    '--brand-gradient': 'linear-gradient(135deg, #4f9eff, #a78bfa)',
    '--brand-text':     '#ffffff',

    '--card-border':  '1px solid rgba(79,158,255,0.12)',
    '--glass':        'rgba(13,20,32,0.7)',
    '--glass-border': 'rgba(79,158,255,0.15)',

    '--radius':    '14px',
    '--radius-sm': '10px',
    '--radius-xs': '7px',

    '--sidebar-border': '1px solid rgba(79,158,255,0.1)',
    '--topbar-border':  '1px solid rgba(79,158,255,0.1)',
  },

  // ════════════════════════════════════════════
  // ☀️ Light — Crystal Glass
  // ════════════════════════════════════════════
  light: {
    '--bg1':   '#eef2ff',
    '--bg2':   '#f8faff',
    '--bg3':   '#e8eeff',
    '--text':  '#1a2040',
    '--t2':    '#5a6a8a',
    '--text2': '#5a6a8a',
    '--accent':'#4361ee',
    '--border':'rgba(67,97,238,0.12)',
    '--card':  'rgba(255,255,255,0.8)',

    '--sidebar-bg':   'rgba(255,255,255,0.92)',
    '--topbar-bg':    'rgba(248,250,255,0.88)',
    '--modal-bg':     'rgba(255,255,255,0.96)',
    '--input-bg':     'rgba(238,242,255,0.8)',
    '--input-border': 'rgba(67,97,238,0.2)',
    '--input-focus':  'rgba(67,97,238,0.06)',

    '--card-blur':    'blur(16px)',
    '--sidebar-blur': 'blur(20px)',

    '--shadow':       '0 4px 24px rgba(67,97,238,0.1)',
    '--shadow-hover': '0 8px 32px rgba(67,97,238,0.2)',
    '--glow':         '0 0 0 1px rgba(67,97,238,0.2), 0 0 16px rgba(67,97,238,0.08)',
    '--glow2':        '0 4px 20px rgba(67,97,238,0.15)',
    '--glow-accent':  '0 0 24px rgba(67,97,238,0.3)',

    '--nav-active-bg':     'rgba(67,97,238,0.1)',
    '--nav-active-shadow': '0 0 10px rgba(67,97,238,0.15)',
    '--nav-hover-bg':      'rgba(67,97,238,0.05)',

    '--btn-gradient': 'linear-gradient(135deg, #4361ee, #7c3aed)',
    '--btn-text':     '#ffffff',
    '--btn-glow':     '0 0 18px rgba(67,97,238,0.35)',

    '--brand-gradient': 'linear-gradient(135deg, #4361ee, #7c3aed)',
    '--brand-text':     '#ffffff',

    '--card-border':  '1px solid rgba(67,97,238,0.12)',
    '--glass':        'rgba(255,255,255,0.65)',
    '--glass-border': 'rgba(67,97,238,0.18)',

    '--radius':    '14px',
    '--radius-sm': '10px',
    '--radius-xs': '7px',

    '--sidebar-border': '1px solid rgba(67,97,238,0.12)',
    '--topbar-border':  '1px solid rgba(67,97,238,0.1)',
  },

  // ════════════════════════════════════════════
  // 📚 Library — Ember Glow
  // ════════════════════════════════════════════
  library: {
    '--bg1':   '#0f0a02',
    '--bg2':   '#18100a',
    '--bg3':   '#231508',
    '--text':  '#f2e0c0',
    '--t2':    '#a08050',
    '--text2': '#a08050',
    '--accent':'#e09040',
    '--border':'rgba(224,144,64,0.15)',
    '--card':  'rgba(24,16,10,0.85)',

    '--sidebar-bg':   'rgba(15,10,2,0.95)',
    '--topbar-bg':    'rgba(15,10,2,0.88)',
    '--modal-bg':     'rgba(24,16,10,0.95)',
    '--input-bg':     'rgba(35,21,8,0.9)',
    '--input-border': 'rgba(224,144,64,0.2)',
    '--input-focus':  'rgba(224,144,64,0.06)',

    '--card-blur':    'blur(16px)',
    '--sidebar-blur': 'blur(20px)',

    '--shadow':       '0 4px 24px rgba(0,0,0,0.6)',
    '--shadow-hover': '0 8px 32px rgba(224,144,64,0.2)',
    '--glow':         '0 0 0 1px rgba(224,144,64,0.2), 0 0 20px rgba(224,144,64,0.08)',
    '--glow2':        '0 4px 20px rgba(224,144,64,0.15)',
    '--glow-accent':  '0 0 28px rgba(224,144,64,0.4)',

    '--nav-active-bg':     'rgba(224,144,64,0.12)',
    '--nav-active-shadow': '0 0 12px rgba(224,144,64,0.2)',
    '--nav-hover-bg':      'rgba(224,144,64,0.06)',

    '--btn-gradient': 'linear-gradient(135deg, #b06020, #e09040)',
    '--btn-text':     '#0f0a02',
    '--btn-glow':     '0 0 20px rgba(224,144,64,0.4)',

    '--brand-gradient': 'linear-gradient(135deg, #e09040, #f5c060)',
    '--brand-text':     '#0f0a02',

    '--card-border':  '1px solid rgba(224,144,64,0.12)',
    '--glass':        'rgba(24,16,10,0.7)',
    '--glass-border': 'rgba(224,144,64,0.18)',

    '--radius':    '14px',
    '--radius-sm': '10px',
    '--radius-xs': '7px',

    '--sidebar-border': '1px solid rgba(224,144,64,0.12)',
    '--topbar-border':  '1px solid rgba(224,144,64,0.1)',
  },

  // ════════════════════════════════════════════
  // 💜 Neon — Cyberpunk Purple
  // ════════════════════════════════════════════
  neon: {
    '--bg1':   '#07040f',
    '--bg2':   '#0e0820',
    '--bg3':   '#140d2e',
    '--text':  '#f0e8ff',
    '--t2':    '#9070c0',
    '--text2': '#9070c0',
    '--accent':'#c084fc',
    '--border':'rgba(192,132,252,0.15)',
    '--card':  'rgba(14,8,32,0.85)',

    '--sidebar-bg':   'rgba(7,4,15,0.95)',
    '--topbar-bg':    'rgba(7,4,15,0.88)',
    '--modal-bg':     'rgba(14,8,32,0.95)',
    '--input-bg':     'rgba(20,13,46,0.9)',
    '--input-border': 'rgba(192,132,252,0.2)',
    '--input-focus':  'rgba(192,132,252,0.07)',

    '--card-blur':    'blur(20px)',
    '--sidebar-blur': 'blur(24px)',

    '--shadow':       '0 4px 24px rgba(0,0,0,0.6)',
    '--shadow-hover': '0 8px 40px rgba(192,132,252,0.25)',
    '--glow':         '0 0 0 1px rgba(192,132,252,0.25), 0 0 20px rgba(192,132,252,0.1)',
    '--glow2':        '0 4px 28px rgba(192,132,252,0.2)',
    '--glow-accent':  '0 0 40px rgba(192,132,252,0.5)',

    '--nav-active-bg':     'rgba(192,132,252,0.14)',
    '--nav-active-shadow': '0 0 16px rgba(192,132,252,0.25)',
    '--nav-hover-bg':      'rgba(192,132,252,0.07)',

    '--btn-gradient': 'linear-gradient(135deg, #7c3aed, #c084fc)',
    '--btn-text':     '#ffffff',
    '--btn-glow':     '0 0 24px rgba(192,132,252,0.5)',

    '--brand-gradient': 'linear-gradient(135deg, #c084fc, #f0abfc)',
    '--brand-text':     '#07040f',

    '--card-border':  '1px solid rgba(192,132,252,0.14)',
    '--glass':        'rgba(14,8,32,0.7)',
    '--glass-border': 'rgba(192,132,252,0.2)',

    '--radius':    '14px',
    '--radius-sm': '10px',
    '--radius-xs': '7px',

    '--sidebar-border': '1px solid rgba(192,132,252,0.12)',
    '--topbar-border':  '1px solid rgba(192,132,252,0.12)',
  },
}

/**
 * تطبيق الثيم تلقائياً على document.documentElement
 * @param {Ref} settings - ref يحتوي على { theme }
 */
export function useTheme(settings) {
  watchEffect(() => {
    const theme = settings.value?.theme || 'dark'
    const vars = THEMES[theme] || THEMES.dark
    const root = document.documentElement

    for (const [key, val] of Object.entries(vars)) {
      root.style.setProperty(key, val)
    }

    // data-theme للـ CSS selectors
    root.setAttribute('data-theme', theme)
  })
}

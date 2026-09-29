<template>
  <header class="morix-nav">
    <!-- Brand + Title -->
    <div class="mn-left">
      <div class="mn-brand">
        <div class="mn-logo">M</div>
      </div>
      <h2 class="mn-title">{{ title }}</h2>
    </div>

    <!-- Center: Quick action slots -->
    <div class="mn-center">
      <slot name="actions" />
    </div>

    <!-- Right: Controls -->
    <div class="mn-right">
      <!-- Theme pills (desktop) -->
      <div class="mn-pills mn-themes" title="الثيم">
        <button v-for="th in themeList" :key="th.k"
          :class="['mn-pill', { active: currentTheme === th.k }]"
          @click="$emit('theme', th.k)" :title="th.label"
          v-html="th.svg">
        </button>
      </div>

      <div class="mn-sep mn-desk" />

      <!-- Language flags (desktop) -->
      <div class="mn-pills mn-langs">
        <button v-for="(L, code) in LANGUAGES" :key="code"
          :class="['mn-pill', 'lang-pill', { active: currentLang === code }]"
          @click="$emit('lang', code)" :title="L.name">
          <img :src="L.flagImg" :alt="L.name" class="mn-flag-img" />
        </button>
      </div>

      <!-- Mobile menu button (theme+lang in vertical dropdown) -->
      <button class="mn-pill mn-mobile-btn" @click.stop="menuOpen=!menuOpen" title="القائمة">
        <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path d="M2 5h16M2 10h16M2 15h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      </button>

      <div class="mn-sep mn-desk" />

      <!-- User chip -->
      <div class="mn-user">
        <img v-if="avatarUrl && (avatarUrl.startsWith('data:') || avatarUrl.startsWith('http'))" :src="avatarUrl" class="mn-av-img" />
        <div v-else class="mn-av">{{ name?.[0] || '?' }}</div>
        <span class="mn-name">{{ name }}</span>
      </div>
    </div>

  </header>

  <!-- Mobile dropdown — fixed position + inline styles لضمان العمل على كل الأجهزة (iOS/Android/HarmonyOS) -->
  <teleport to="body">
    <div v-if="menuOpen" @click="menuOpen=false"
         :style="{position:'fixed',inset:'0',background:'rgba(0,0,0,0.55)',zIndex:'9998',backdropFilter:'blur(4px)',WebkitBackdropFilter:'blur(4px)'}"></div>
    <div v-if="menuOpen"
         :style="{position:'fixed',top:'64px',right:'12px',width:'250px',maxHeight:'75vh',overflowY:'auto',background:isLight?'#ffffff':'#1a1f3a',border:isLight?'1px solid #e5e7eb':'1px solid #334155',borderRadius:'14px',padding:'12px',boxShadow:'0 12px 40px rgba(0,0,0,0.55)',zIndex:'9999',color:isLight?'#0f172a':'#f1f5f9',fontFamily:'inherit'}">
      <div :style="{fontSize:'12px',fontWeight:'700',color:isLight?'#059669':'#10b981',padding:'4px 8px 8px',letterSpacing:'0.5px'}">🎨 الثيم</div>
      <button v-for="th in themeList" :key="'th'+th.k"
        @click="$emit('theme', th.k); menuOpen=false"
        :style="{display:'flex',alignItems:'center',width:'100%',background:currentTheme===th.k?(isLight?'#ecfdf5':'#064e3b'):'transparent',border:currentTheme===th.k?(isLight?'1px solid #10b981':'1px solid #34d399'):'1px solid transparent',color:isLight?'#0f172a':'#f1f5f9',padding:'12px 12px',borderRadius:'10px',cursor:'pointer',fontSize:'14px',textAlign:'right',fontFamily:'inherit',marginBottom:'4px',minHeight:'44px',gap:'8px'}">
        <span v-html="th.svg" style="display:inline-flex"></span>{{ th.labelAr }}
      </button>
      <div :style="{fontSize:'12px',fontWeight:'700',color:isLight?'#059669':'#10b981',padding:'14px 8px 8px',letterSpacing:'0.5px'}">🌐 اللغة</div>
      <button v-for="(L, code) in LANGUAGES" :key="'lg'+code"
        @click="$emit('lang', code); menuOpen=false"
        :style="{display:'flex',alignItems:'center',width:'100%',background:currentLang===code?(isLight?'#ecfdf5':'#064e3b'):'transparent',border:currentLang===code?(isLight?'1px solid #10b981':'1px solid #34d399'):'1px solid transparent',color:isLight?'#0f172a':'#f1f5f9',padding:'12px 12px',borderRadius:'10px',cursor:'pointer',fontSize:'14px',textAlign:'right',fontFamily:'inherit',marginBottom:'4px',minHeight:'44px',gap:'10px'}">
        <img :src="L.flagImg" :alt="L.name" :style="{width:'24px',height:'16px',borderRadius:'3px',objectFit:'cover',flexShrink:'0'}" />
        <span>{{ L.name }}</span>
      </button>
    </div>
  </teleport>
</template>

<script setup>
import { computed, ref } from 'vue'
import { LANGUAGES } from '../composables/useI18n.js'

const menuOpen = ref(false)

const props = defineProps({
  title:        { type: String, default: '' },
  name:         { type: String, default: '' },
  avatarUrl:    { type: String, default: '' },
  currentTheme: { type: String, default: 'dark' },
  currentLang:  { type: String, default: 'ar' },
})

defineEmits(['theme', 'lang'])

const isLight = computed(() => props.currentTheme === 'light')

const themeList = [
  { k: 'dark',    labelAr: 'داكن',    svg: `<svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/></svg>` },
  { k: 'light',   labelAr: 'فاتح',    svg: `<svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><circle cx="10" cy="10" r="4"/><path d="M10 1v2m0 14v2m-7-9H1m18 0h-2m-2.05-5.95l-1.41 1.41m-7.08 7.08l-1.41 1.41m0-9.9l1.41 1.41m7.08 7.08l1.41 1.41"/></svg>` },
  { k: 'library', labelAr: 'مكتبة',   svg: `<svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path d="M2 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1H3a1 1 0 01-1-1V4zm5-1a1 1 0 00-1 1v12a1 1 0 001 1h2a1 1 0 001-1V4a1 1 0 00-1-1H7zm5 0a1 1 0 00-.8.4l4 12a1 1 0 001.2.6l1.9-.6a1 1 0 00.6-1.2l-4-12a1 1 0 00-1.2-.6L12.2 3z"/></svg>` },
  { k: 'neon',    labelAr: 'نيون',    svg: `<svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path d="M11.3 1.05a1 1 0 00-1.1.45L5.7 9H2a1 1 0 00-.8 1.6l7.5 10a1 1 0 001.8-.6L9.7 13H18a1 1 0 00.8-1.6l-7.5-10.35z"/></svg>` },
]
</script>

<style scoped>
.morix-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 20px;
  background: var(--topbar-bg);
  backdrop-filter: var(--sidebar-blur);
  -webkit-backdrop-filter: var(--sidebar-blur);
  border-bottom: var(--topbar-border);
  position: sticky;
  top: 0;
  z-index: 50;
  flex-wrap: nowrap;
}

/* Left */
.mn-left { display: flex; align-items: center; gap: 10px; min-width: 0; flex-shrink: 0; }
.mn-logo {
  width: 32px; height: 32px; border-radius: 9px; flex-shrink: 0;
  background: var(--brand-gradient);
  display: flex; align-items: center; justify-content: center;
  font-weight: 900; font-size: 16px; color: var(--brand-text);
  box-shadow: var(--btn-glow);
}
.mn-title {
  font-size: 16px; font-weight: 700; color: var(--text);
  margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

/* Center */
.mn-center { display: flex; align-items: center; gap: 8px; flex: 1; justify-content: center; flex-wrap: wrap; }

/* Right */
.mn-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.mn-sep { width: 1px; height: 22px; background: var(--border); }

/* Pills */
.mn-pills { display: flex; gap: 3px; }
.mn-langs { gap: 2px; }
.mn-pill {
  width: 30px; height: 30px; border-radius: 8px;
  border: 1px solid transparent;
  background: transparent;
  cursor: pointer; font-size: 14px;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.18s;
  color: var(--text2);
}
.mn-pill:hover {
  background: var(--nav-hover-bg);
  border-color: var(--border);
}
.mn-pill.active {
  background: var(--nav-active-bg);
  border-color: var(--accent);
  box-shadow: var(--nav-active-shadow), 0 0 8px rgba(var(--accent-rgb, 79,158,255), 0.2);
  color: var(--accent);
}
.lang-pill { font-size: 16px; width: 28px; height: 28px; padding: 2px; }
.mn-flag-img { width: 20px; height: 14px; border-radius: 2px; object-fit: cover; display: block; }

/* User chip */
.mn-user { display: flex; align-items: center; gap: 8px; cursor: default; }
.mn-av-img, .mn-av {
  width: 32px; height: 32px; border-radius: 50%;
  object-fit: cover; font-size: 14px; font-weight: 700;
  background: var(--btn-gradient); color: var(--btn-text);
  display: flex; align-items: center; justify-content: center;
  box-shadow: var(--btn-glow);
}
.mn-name { font-size: 13px; color: var(--text2); font-weight: 500; white-space: nowrap; }

/* Mobile menu button — hidden on desktop, shown on mobile */
.mn-mobile-btn { display: none; color: #10b981; min-width: 36px; min-height: 36px; }

/* Mobile breakpoint */
@media (max-width: 768px) {
  .mn-name, .mn-themes, .mn-langs, .mn-desk { display: none !important; }
  .mn-mobile-btn { display: flex !important; }
  .mn-title { font-size: 14px; }
  .morix-nav { padding: 8px 14px; }
}
</style>

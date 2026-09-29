<template>
  <div class="live-overlay">
    <div class="live-bar">
      <span class="live-title">📡 {{ title || 'بث مباشر' }}</span>
      <button class="live-close" @click="$emit('close')">✕ إنهاء / خروج</button>
    </div>
    <div ref="jitsiEl" class="live-frame"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  room: { type: String, required: true },
  name: { type: String, default: 'مستخدم' },
  title: { type: String, default: '' },
})
const emit = defineEmits(['close'])

const jitsiEl = ref(null)
let api = null

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (window.JitsiMeetExternalAPI) return resolve()
    const s = document.createElement('script')
    s.src = src
    s.async = true
    s.onload = resolve
    s.onerror = () => reject(new Error('failed to load Jitsi'))
    document.head.appendChild(s)
  })
}

onMounted(async () => {
  try {
    await loadScript('https://meet.jit.si/external_api.js')
    api = new window.JitsiMeetExternalAPI('meet.jit.si', {
      roomName: props.room,
      parentNode: jitsiEl.value,
      userInfo: { displayName: props.name || 'مستخدم' },
      configOverwrite: {
        prejoinPageEnabled: false,
        disableDeepLinking: true,
        startWithAudioMuted: false,
      },
      interfaceConfigOverwrite: {
        MOBILE_APP_PROMO: false,
        SHOW_JITSI_WATERMARK: false,
      },
    })
    api.addEventListener('readyToClose', () => emit('close'))
  } catch (e) {
    console.error('Jitsi load failed:', e)
  }
})

onUnmounted(() => {
  try { if (api) api.dispose() } catch (e) {}
})
</script>

<style scoped>
.live-overlay {
  position: fixed; inset: 0; z-index: 9999;
  background: #000; display: flex; flex-direction: column;
}
.live-bar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 14px; background: #0b0e1f; color: #fff; flex-shrink: 0;
}
.live-title { font-weight: 700; font-size: 15px; }
.live-close {
  background: rgba(239,68,68,0.92); color: #fff; border: none;
  border-radius: 8px; padding: 8px 14px; cursor: pointer; font-weight: 700; font-size: 13px;
}
.live-frame { flex: 1; width: 100%; min-height: 0; }
.live-frame :deep(iframe) { width: 100% !important; height: 100% !important; border: 0; display: block; }
</style>

// نقطة الدخول - Memorix Frontend
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router/index.js'
// خط Tajawal مُضمَّن محلياً (بدون Google Fonts) — يعمل على شبكات المدارس بدون VPN
import '@fontsource/tajawal/300.css'
import '@fontsource/tajawal/400.css'
import '@fontsource/tajawal/500.css'
import '@fontsource/tajawal/700.css'
import '@fontsource/tajawal/800.css'
import '@fontsource/tajawal/900.css'
import './style.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')

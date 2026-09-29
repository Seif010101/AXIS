<template>
  <div class="hub hub-admin">
    <MatrixBackground />

    <!-- 📡 البث المباشر -->
    <LiveClass v-if="liveOverlay" :room="liveRoom" :name="firstName" :title="liveTitle" @close="liveOverlay=false" />
    <div v-if="activeLive && !liveOverlay" @click="joinLive"
         style="position:fixed;bottom:18px;left:50%;transform:translateX(-50%);z-index:9000;background:linear-gradient(135deg,#ef4444,#f59e0b);color:#fff;padding:12px 22px;border-radius:30px;font-weight:800;cursor:pointer;box-shadow:0 6px 24px rgba(239,68,68,.5);font-size:14px;white-space:nowrap">
      📡 بث مباشر الآن من {{ activeLive.host_name }} — انضم للإشراف
    </div>
    <!-- Mobile menu -->
    <button class="mobile-toggle" @click="mobileOpen = !mobileOpen" aria-label="Menu">{{ mobileOpen ? '✕' : '☰' }}</button>
    <div :class="['mobile-overlay', { open: mobileOpen }]" @click="mobileOpen = false"></div>

    <aside :class="['sidebar',{collapsed:sb, open: mobileOpen}]">
      <div class="sb-header" @click="sb=!sb">
        <div class="brand"><div class="b-icon">M</div><span v-if="!sb" class="b-name">Morix</span></div>
      </div>
      <nav class="sb-nav">
        <button v-for="s in sections" :key="s.id" :class="['nav-item',{active:cur===s.id}]" @click="cur=s.id; mobileOpen=false" :title="s.label">
          <span v-html="s.svg"></span><span v-if="!sb" class="nav-label">{{ s.label }}</span>
        </button>
      </nav>
      <div class="sb-footer">
        <button class="logout-btn" @click="doLogout"><span>🚪</span><span v-if="!sb">{{ t('logout_btn') }}</span></button>
      </div>
    </aside>

    <main class="main">
      <NavBar
        :title="sections.find(s=>s.id===cur)?.label || ''"
        :name="firstName"
        :avatar-url="settings.avatar_url"
        :current-theme="settings.theme"
        :current-lang="lang"
        @theme="v => { settings.theme = v; saveSettings() }"
        @lang="changeAdminLang"
      />

      <!-- ===== OVERVIEW ===== -->
      <section v-show="cur==='overview'" class="body pad">
        <div class="stats-grid">
          <div class="sc"><div class="sn">{{ stats.total_students }}</div><div class="sl">طالب</div></div>
          <div class="sc"><div class="sn">{{ stats.total_teachers }}</div><div class="sl">معلم</div></div>
          <div class="sc"><div class="sn">{{ stats.total_homework }}</div><div class="sl">واجب</div></div>
          <div class="sc"><div class="sn">{{ stats.total_tests }}</div><div class="sl">اختبار</div></div>
        </div>
        <div class="card mt">
          <h3>👋 مرحباً {{ firstName }}!</h3>
          <p style="color:var(--t2)">لوحة المشرف الإداري — يمكنك إدارة الطلاب وتحميل الحسابات من هنا.</p>
        </div>
      </section>

      <!-- ===== STUDENTS ===== -->
      <section v-show="cur==='students'" class="body pad">
        <div class="card">
          <div class="row-sb">
            <h3>👨‍🎓 الطلاب</h3>
            <input v-model="search" class="inp search" :placeholder="'🔍 ' + t('search_ph')" />
          </div>
          <div v-if="loading" class="empty">⏳ تحميل...</div>
          <div v-else-if="!filteredStudents.length" class="empty">{{ t('no_students') }}</div>
          <div v-else class="list-col">
            <div v-for="s in filteredStudents" :key="s.id" class="list-item">
              <div style="flex:1">
                <h4>{{ s.full_name }}</h4>
                <div class="meta">
                  <span>{{ s.email }}</span>
                  <span v-if="s.grade">🎓 {{ s.grade }}</span>
                  <span :style="{color:s.is_active?'#4ade80':'#f87171'}">{{ s.is_active ? '✅ فعّال' : '❌ معطل' }}</span>
                </div>
              </div>
              <div class="row-gap">
                <button class="btn-s" @click="openReset(s)">🔑 كلمة المرور</button>
                <button class="btn-s" :class="{danger:s.is_active}" @click="toggleStudent(s)">
                  {{ s.is_active ? t('disable_btn') : t('enable_btn') }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Reset Password Modal -->
        <div v-if="resetModal" class="modal-bg" @click.self="resetModal=null">
          <div class="modal-box">
            <h3>🔑 {{ t('reset_password') }}</h3>
            <p style="color:var(--t2);font-size:14px;margin:0 0 16px">{{ resetModal.full_name }}</p>
            <input v-model="newPass" type="text" class="inp" placeholder="كلمة المرور الجديدة (6+ أحرف)" />
            <div class="row-gap" style="margin-top:14px">
              <button class="btn-p" @click="doReset" :disabled="newPass.length<6">{{ t('save') }}</button>
              <button class="btn-o" @click="resetModal=null">{{ t('cancel') }}</button>
            </div>
            <p v-if="resetMsg" :style="{color:resetMsg.includes('✅')?'#4ade80':'#f87171',fontSize:'13px',marginTop:'10px'}">{{ resetMsg }}</p>
          </div>
        </div>
      </section>

      <!-- ===== UPLOAD EXCEL ===== -->
      <section v-show="cur==='upload'" class="body pad">
        <div class="card">
          <h3>📊 رفع ملف Excel لإنشاء الحسابات</h3>
          <div class="info-box">
            <p>📋 <strong>تنسيق الملف المطلوب:</strong></p>
            <p>• <strong>Sheet "طلاب" أو "Students":</strong> الاسم | الرقم الوزاري | الصف</p>
            <p>• <strong>Sheet "معلمون" أو "Teachers":</strong> الاسم | المادة (اختياري)</p>
          </div>
          <div class="col-gap" style="margin-top:20px">
            <input type="file" ref="fileInput" accept=".xlsx,.xls" @change="onFileSelect" class="file-input" />
            <div v-if="selectedFile" class="file-chip">
              📄 {{ selectedFile.name }}
              <button @click="selectedFile=null;fileInput.value=''" style="background:none;border:none;cursor:pointer;color:var(--t2)">✕</button>
            </div>
            <button class="btn-p" @click="uploadFile" :disabled="!selectedFile||uploading">
              {{ uploading ? '⏳ ' + t('uploading') : '⬆️ ' + t('upload_btn') }}
            </button>
          </div>
          <div v-if="uploadError" style="color:#f87171;font-size:13px;margin-top:12px">{{ uploadError }}</div>
        </div>

        <!-- نتائج الرفع -->
        <div v-if="uploadResult" class="card mt">
          <h3>✅ تم إنشاء {{ uploadResult.total }} حساب</h3>
          <p style="color:var(--t2);font-size:13px;margin:0 0 16px">طلاب: {{ uploadResult.students }} | معلمون: {{ uploadResult.teachers }}</p>
          <div class="list-col">
            <div v-for="acc in uploadResult.accounts" :key="acc.email" class="list-item">
              <div style="flex:1">
                <h4>{{ acc.full_name }}</h4>
                <div class="meta"><span>{{ acc.email }}</span><span>{{ {student:'طالب',teacher:'معلم',admin:'إداري'}[acc.role]||acc.role }}</span></div>
              </div>
              <div class="pass-badge">{{ acc.password }}</div>
            </div>
          </div>
          <button class="btn-s" style="margin-top:14px" @click="copyAccounts">📋 {{ t('copy_btn') }}</button>
        </div>
      </section>

      <!-- ===== 💓 SCHOOL PULSE ===== -->
      <section v-show="cur==='pulse'" class="body pad">
        <div class="card">
          <h3>💓 {{ t('school_pulse') }}</h3>
          <button class="btn-p" @click="loadPulse" :disabled="pulseLoading">{{ pulseLoading?'⏳':'🔄 ' + t('refresh_btn') }}</button>
          <div v-if="pulse" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-top:16px">
            <div class="card"><b>👨‍🎓 الطلاب</b><div style="font-size:32px;color:var(--accent)">{{ pulse.students }}</div></div>
            <div class="card"><b>👨‍🏫 المعلمون</b><div style="font-size:32px;color:#a855f7">{{ pulse.teachers }}</div></div>
            <div class="card"><b>🟢 {{ t('active_today') }}</b><div style="font-size:32px;color:#10b981">{{ pulse.active_today }}</div></div>
            <div class="card"><b>📅 {{ t('active_weekly') }}</b><div style="font-size:32px;color:#10b981">{{ pulse.active_week }}</div></div>
            <div class="card"><b>🤖 استدعاءات AI</b><div style="font-size:32px;color:#fbbf24">{{ pulse.ai_calls_week }}</div></div>
            <div class="card"><b>💪 التفاعل</b><div style="font-size:32px;color:#fbbf24">{{ pulse.engagement_pct }}%</div></div>
          </div>
        </div>
      </section>

      <!-- ===== 📢 ANNOUNCEMENTS ===== -->
      <section v-show="cur==='announce'" class="body pad">
        <div class="card">
          <h3>📢 {{ t('announcements') }}</h3>
          <input v-model="annTitle" class="inp" placeholder="عنوان الإعلان" style="width:100%;margin-bottom:8px" />
          <textarea v-model="annContent" class="inp" rows="4" placeholder="محتوى الإعلان..." style="width:100%;margin-bottom:8px"></textarea>
          <button class="btn-p" @click="postAnnouncement" :disabled="annLoading">{{ annLoading?'⏳':'📡 ' + t('post_btn') }}</button>
          <div v-if="annMsg" style="margin-top:12px;color:#10b981">{{ annMsg }}</div>
          <h4 style="margin-top:24px">📜 السابقة</h4>
          <button class="btn-s" @click="loadAnnouncements">🔄 تحميل</button>
          <div v-for="(a,i) in announcements" :key="i" class="card" style="margin:8px 0">
            <b>{{ a.event_data?.title }}</b>
            <p style="color:var(--t2);font-size:12px">{{ new Date(a.created_at).toLocaleString('ar') }}</p>
            <p>{{ a.event_data?.content }}</p>
          </div>
        </div>
      </section>

      <!-- ===== 📋 INCIDENT REPORT ===== -->
      <section v-show="cur==='incident'" class="body pad">
        <div class="card">
          <h3>📋 مساعد كتابة تقارير الحوادث (AI)</h3>
          <select v-model="incType" class="inp" style="width:100%;margin-bottom:8px">
            <option value="سلوكي">تقرير سلوكي</option>
            <option value="أكاديمي">تقرير أكاديمي</option>
            <option value="حادثة">حادثة</option>
            <option value="إصابة">إصابة</option>
          </select>
          <textarea v-model="incSummary" class="inp" rows="5" placeholder="ملخص الموقف بكلمات بسيطة..." style="width:100%;margin-bottom:8px"></textarea>
          <button class="btn-p" @click="genIncident" :disabled="incLoading">{{ incLoading?'⏳':'✍️ ' + t('generate_report') }}</button>
          <div v-if="incReport" class="card" style="margin-top:16px;white-space:pre-wrap;line-height:1.8">{{ incReport }}</div>
        </div>
      </section>

      <!-- ===== SETTINGS ===== -->
      <section v-show="cur==='settings'" class="body pad">
        <div class="settings-grid">
          <!-- معلومات الحساب -->
          <div class="card">
            <h3>👤 معلومات الحساب</h3>
            <div class="avatar-section">
              <div>
                <svg v-if="settings.avatar_url && avatarMap[settings.avatar_url]" viewBox="0 0 80 80" width="64" height="64">
                  <circle cx="40" cy="40" r="38" :fill="avatarMap[settings.avatar_url].bg"/>
                  <circle cx="40" cy="32" r="16" :fill="avatarMap[settings.avatar_url].skin"/>
                  <ellipse cx="40" cy="62" rx="22" ry="16" :fill="avatarMap[settings.avatar_url].outfit"/>
                  <path :d="avatarMap[settings.avatar_url].hair" :fill="avatarMap[settings.avatar_url].hairColor"/>
                </svg>
                <div v-else class="av-big">{{ firstName[0] }}</div>
              </div>
            </div>
            <div class="avatar-grid">
              <div v-for="av in avatarOptions" :key="av.id"
                   class="avatar-option" :class="{ selected: settings.avatar_url === av.id }"
                   @click="selectAvatar(av.id)">
                <svg viewBox="0 0 80 80" width="56" height="56">
                  <circle cx="40" cy="40" r="38" :fill="av.bg"/>
                  <circle cx="40" cy="32" r="16" :fill="av.skin"/>
                  <ellipse cx="40" cy="62" rx="22" ry="16" :fill="av.outfit"/>
                  <path :d="av.hair" :fill="av.hairColor"/>
                </svg>
              </div>
            </div>
            <div class="info-row"><span>الاسم</span><b>{{ settings.full_name }}</b></div>
            <div class="info-row"><span>الإيميل</span><b>{{ settings.email }}</b></div>
            <div class="info-row"><span>الدور</span><b>مشرف إداري</b></div>
          </div>

          <!-- المظهر -->
          <div class="card">
            <h3>🎨 المظهر</h3>
            <p style="color:var(--t2);font-size:13px;margin:0 0 10px">الثيم</p>
            <div class="theme-row">
              <button :class="['t-btn',{active:settings.theme==='dark'}]" @click="setTheme('dark')">🌑 داكن</button>
              <button :class="['t-btn',{active:settings.theme==='light'}]" @click="setTheme('light')">☀️ فاتح</button>
              <button :class="['t-btn',{active:settings.theme==='library'}]" @click="setTheme('library')">📚 مكتبة</button>
            </div>
          </div>

          <!-- اللغة -->
          <div class="card">
            <h3>🌐 اللغة / Language</h3>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px">
              <button v-for="(L, code) in languages" :key="code"
                      @click="changeAdminLang(code)"
                      :style="{padding:'10px',borderRadius:'10px',border:`2px solid ${settings.language===code?'var(--accent)':'var(--border)'}`,background:settings.language===code?'rgba(99,102,241,.15)':'var(--card)',color:'var(--text)',cursor:'pointer',fontWeight:600}">
                {{ L.flag }} {{ L.name }}
              </button>
            </div>
          </div>

          <!-- الإشعارات -->
          <div class="card">
            <h3>🔔 الإشعارات</h3>
            <label class="toggle-lbl">
              <input type="checkbox" v-model="settings.notifications_enabled" @change="saveSettings" />
              <span>تفعيل الإشعارات</span>
            </label>
          </div>
        </div>
        <p v-if="settingsMsg" style="color:#4ade80;font-size:13px;margin-top:10px;text-align:center">{{ settingsMsg }}</p>
      </section>

    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth.js'
import { useRouter } from 'vue-router'
import { adminAPI } from '../api.js'
import { useTheme } from '../composables/useTheme.js'
import { useI18n, LANGUAGES } from '../composables/useI18n.js'
import MatrixBackground from '../components/MatrixBackground.vue'
import NavBar from '../components/NavBar.vue'
import LiveClass from '../components/LiveClass.vue'

const auth = useAuthStore()
const router = useRouter()
const firstName = computed(() => (auth.user?.full_name || 'مشرف').split(' ')[0])

// 📡 البث المباشر
const liveOverlay = ref(false)
const liveRoom = ref('')
const liveTitle = ref('')
const activeLive = ref(null)
let liveTimer = null
async function loadLive() {
  try { const r = await adminAPI.getLive(); activeLive.value = (r.data && r.data[0]) || null } catch {}
}
function joinLive() {
  if (!activeLive.value) return
  liveRoom.value = activeLive.value.room
  liveTitle.value = (activeLive.value.subject || 'بث') + ' — ' + (activeLive.value.host_name || '')
  liveOverlay.value = true
}

// Settings
const settings = ref({ theme:'dark', language:'ar', notifications_enabled:true, avatar_url:'', email:'', full_name:'' })

const avatarOptions = [
  { id: 'av1', bg: '#E3F2FD', skin: '#FDBCB4', hairColor: '#3E2723', outfit: '#1976D2', hair: 'M24,24 Q40,8 56,24 Q56,16 40,12 Q24,16 24,24Z' },
  { id: 'av2', bg: '#FFF3E0', skin: '#8D5524', hairColor: '#1B1B1B', outfit: '#E65100', hair: 'M24,26 Q40,10 56,26 L56,20 Q40,6 24,20Z' },
  { id: 'av3', bg: '#E8F5E9', skin: '#F1C27D', hairColor: '#6D4C41', outfit: '#2E7D32', hair: 'M22,28 Q40,6 58,28 Q58,18 40,10 Q22,18 22,28Z' },
  { id: 'av4', bg: '#FCE4EC', skin: '#FDBCB4', hairColor: '#D32F2F', outfit: '#AD1457', hair: 'M20,30 Q30,10 40,16 Q50,10 60,30 Q60,20 40,8 Q20,20 20,30Z' },
  { id: 'av5', bg: '#F3E5F5', skin: '#C68642', hairColor: '#4E342E', outfit: '#6A1B9A', hair: 'M24,24 Q40,12 56,24 Q54,16 40,10 Q26,16 24,24Z' },
  { id: 'av6', bg: '#E0F7FA', skin: '#FFE0BD', hairColor: '#BF360C', outfit: '#00838F', hair: 'M24,28 Q32,12 40,16 Q48,12 56,28 L54,20 Q40,8 26,20Z' },
  { id: 'av7', bg: '#FFF8E1', skin: '#8D5524', hairColor: '#212121', outfit: '#F57F17', hair: 'M26,22 Q40,14 54,22 Q52,18 40,14 Q28,18 26,22Z' },
  { id: 'av8', bg: '#E8EAF6', skin: '#FDBCB4', hairColor: '#1A237E', outfit: '#283593', hair: 'M22,26 Q40,4 58,26 Q56,14 40,6 Q24,14 22,26Z' },
  { id: 'av9', bg: '#EFEBE9', skin: '#F1C27D', hairColor: '#3E2723', outfit: '#4E342E', hair: 'M24,24 Q40,10 56,24 L54,18 Q40,8 26,18Z' },
  { id: 'av10', bg: '#E0F2F1', skin: '#D1A36C', hairColor: '#1B5E20', outfit: '#00695C', hair: 'M20,28 Q40,8 60,28 Q58,16 40,6 Q22,16 20,28Z' },
  { id: 'av11', bg: '#FBE9E7', skin: '#FFE0BD', hairColor: '#4A148C', outfit: '#BF360C', hair: 'M24,26 Q34,14 40,18 Q46,14 56,26 L54,18 Q40,8 26,18Z' },
  { id: 'av12', bg: '#F1F8E9', skin: '#C68642', hairColor: '#33691E', outfit: '#558B2F', hair: 'M26,24 Q40,12 54,24 Q52,16 40,10 Q28,16 26,24Z' },
]
const avatarMap = Object.fromEntries(avatarOptions.map(a => [a.id, a]))
useTheme(settings)
const { t, lang, setLang: setALang } = useI18n()
const languages = LANGUAGES
function changeAdminLang(code) {
  settings.value.language = code
  setALang(code)
  saveSettings()
}

const sections = computed(() => [
  { id:'overview', svg:'<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7A1 1 0 003 11h1v6a1 1 0 001 1h4v-5h2v5h4a1 1 0 001-1v-6h1a1 1 0 00.707-1.707l-7-7z"/></svg>', label: t('overview') },
  { id:'students', svg:'<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M7 8a4 4 0 108 0 4 4 0 00-8 0zm0 2a6 6 0 00-6 6v1h20v-1a6 6 0 00-6-6H7z"/></svg>', label: t('students') },
  { id:'upload',   svg:'<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M2 11h3v6H2zm5-4h3v10H7zm5-5h3v15h-3z"/></svg>', label: t('upload_excel') },
  { id:'pulse',    svg:'<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"/></svg>', label: t('school_pulse') },
  { id:'announce', svg:'<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M18 10c0 3.87-3.58 7-8 7a8.8 8.8 0 01-3.8-.85L2 18l1.3-3.5A6.6 6.6 0 012 10c0-3.87 3.58-7 8-7s8 3.13 8 7zM7 9H5v2h2V9zm4 0H9v2h2V9zm4 0h-2v2h2V9z"/></svg>', label: t('announcements') },
  { id:'incident', svg:'<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884zM18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/></svg>', label: t('incident_report') },
  { id:'settings', svg:'<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M11.5 2.6l.8 1.5a1 1 0 001 .5l1.6-.2a8 8 0 011.5 1.5l-.2 1.6a1 1 0 00.5 1l1.5.8v2.1l-1.5.8a1 1 0 00-.5 1l.2 1.6a8 8 0 01-1.5 1.5l-1.6-.2a1 1 0 00-1 .5l-.8 1.5H8.5l-.8-1.5a1 1 0 00-1-.5l-1.6.2a8 8 0 01-1.5-1.5l.2-1.6a1 1 0 00-.5-1L1.8 11V8.9l1.5-.8a1 1 0 00.5-1l-.2-1.6a8 8 0 011.5-1.5l1.6.2a1 1 0 001-.5l.8-1.5h3zM10 7a3 3 0 100 6 3 3 0 000-6z"/></svg>', label: t('settings') },
])

const cur = ref('overview')
const sb = ref(false)
const mobileOpen = ref(false)

// Overview
const stats = ref({ total_students:0, total_teachers:0, total_homework:0, total_tests:0 })

// Students
const students = ref([])
const loading = ref(false)
const search = ref('')
const filteredStudents = computed(() =>
  search.value ? students.value.filter(s =>
    s.full_name?.includes(search.value) || s.email?.includes(search.value)
  ) : students.value
)

// Reset Password
const resetModal = ref(null)
const newPass = ref('')
const resetMsg = ref('')

// Upload
const fileInput = ref(null)
const selectedFile = ref(null)
const uploading = ref(false)
const uploadResult = ref(null)
const uploadError = ref('')

const settingsMsg = ref('')

onMounted(async () => {
  await Promise.all([loadStats(), loadStudents(), loadSettings()])
  loadLive()
  liveTimer = setInterval(loadLive, 25000)
})

async function loadStats() {
  try { stats.value = (await adminAPI.getOverview()).data } catch {}
}
async function loadStudents() {
  loading.value = true
  try { students.value = (await adminAPI.getStudents()).data } catch {}
  finally { loading.value = false }
}
async function loadSettings() {
  try { settings.value = { ...settings.value, ...(await adminAPI.getSettings()).data } } catch {}
}

function openReset(student) { resetModal.value = student; newPass.value = ''; resetMsg.value = '' }
async function doReset() {
  try {
    await adminAPI.resetPassword(resetModal.value.id, newPass.value)
    resetMsg.value = `✅ تم تغيير كلمة المرور إلى: ${newPass.value}`
    const s = students.value.find(s => s.id === resetModal.value.id)
    if (s) s.must_change_password = false
  } catch (e) { resetMsg.value = e.response?.data?.detail || 'خطأ' }
}
async function toggleStudent(s) {
  try { const r = await adminAPI.toggleStudent(s.id); s.is_active = r.data.is_active } catch {}
}

function onFileSelect(e) { selectedFile.value = e.target.files[0] || null; uploadResult.value = null; uploadError.value = '' }
async function uploadFile() {
  if (!selectedFile.value) return
  uploading.value = true; uploadError.value = ''
  const fd = new FormData()
  fd.append('file', selectedFile.value)
  try {
    const r = await adminAPI.uploadExcel(fd)
    uploadResult.value = r.data
    await loadStudents()
  } catch (e) { uploadError.value = e.response?.data?.detail || 'فشل رفع الملف' }
  finally { uploading.value = false }
}
function copyAccounts() {
  if (!uploadResult.value) return
  const text = uploadResult.value.accounts.map(a => `${a.full_name} | ${a.email} | ${a.password}`).join('\n')
  navigator.clipboard?.writeText(text).catch(() => {})
}

function setTheme(t) { settings.value.theme = t; saveSettings() }
async function saveSettings() {
  try { await adminAPI.updateSettings(settings.value); settingsMsg.value = '✅ تم الحفظ'; setTimeout(()=>{settingsMsg.value=''}, 2000) } catch {}
}
function _compressImage(file, maxW, maxH, quality) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = ev => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let w = img.width, h = img.height
        if (w > maxW || h > maxH) { const ratio = Math.min(maxW/w, maxH/h); w = Math.round(w*ratio); h = Math.round(h*ratio) }
        canvas.width = w; canvas.height = h
        canvas.getContext('2d').drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.src = ev.target.result
    }
    reader.readAsDataURL(file)
  })
}
function selectAvatar(id) {
  settings.value.avatar_url = id
  saveSettings()
}

async function doLogout() { await auth.logout(); router.push('/login') }

// 🏫 ميزات الإداري المتقدمة
const pulse = ref(null), pulseLoading = ref(false)
async function loadPulse() { pulseLoading.value=true; try { pulse.value=(await adminAPI.schoolPulse()).data } catch(e){alert('فشل')} pulseLoading.value=false }

const annTitle = ref(''), annContent = ref(''), annLoading = ref(false), annMsg = ref('')
const announcements = ref([])
async function postAnnouncement() {
  if (!annTitle.value.trim() || !annContent.value.trim()) return alert('أدخل العنوان والمحتوى')
  annLoading.value=true
  try {
    const r = await adminAPI.makeAnnouncement({title:annTitle.value, content:annContent.value})
    annMsg.value=r.data.message; annTitle.value=''; annContent.value=''
    await loadAnnouncements()
  } catch(e) { alert('فشل') }
  annLoading.value=false
}
async function loadAnnouncements() { try { announcements.value=(await adminAPI.listAnnouncements()).data } catch {} }

const incType = ref('سلوكي'), incSummary = ref(''), incLoading = ref(false), incReport = ref('')
async function genIncident() {
  if (!incSummary.value.trim()) return alert('اكتب الملخص')
  incLoading.value=true; incReport.value=''
  try { incReport.value=(await adminAPI.incidentReport({type:incType.value, summary:incSummary.value})).data.report }
  catch(e) { alert('فشل') }
  incLoading.value=false
}
</script>

<style scoped>
.hub{display:flex;height:100vh;overflow:hidden;font-family:'Segoe UI','Cairo',sans-serif;direction:rtl;background:var(--bg1);}
.sidebar{width:220px;min-width:220px;background:var(--sidebar-bg);border-left:var(--sidebar-border);display:flex;flex-direction:column;transition:width .25s,min-width .25s;overflow:hidden;backdrop-filter:var(--sidebar-blur);position:relative;z-index:10;}
.sidebar.collapsed{width:60px;min-width:60px;}
.sb-header{padding:14px;cursor:pointer;border-bottom:1px solid var(--border);}
.brand{display:flex;align-items:center;gap:10px;}
.b-icon{width:34px;height:34px;min-width:34px;background:linear-gradient(135deg,#00ff9f,#00c8ff);border-radius:9px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:17px;color:#000;}
.b-name{font-size:17px;font-weight:800;color:var(--text);}
.sb-nav{flex:1;padding:8px;overflow-y:auto;}
.nav-item{display:flex;align-items:center;gap:10px;width:100%;padding:10px 12px;border-radius:10px;background:none;border:none;color:var(--t2);cursor:pointer;font-size:14px;transition:all .15s;text-align:right;white-space:nowrap;}
.nav-item:hover{background:rgba(0,255,159,.08);color:var(--text);}
.nav-item.active{background:rgba(0,255,159,.12);color:var(--accent);box-shadow:inset 0 0 12px rgba(0,255,159,.1);}
.nav-label{font-size:13px;}
.sb-footer{padding:12px;border-top:1px solid var(--border);}
.logout-btn{display:flex;align-items:center;justify-content:center;gap:8px;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.2);color:#f87171;border-radius:8px;padding:8px;cursor:pointer;font-size:13px;width:100%;}
.main{flex:1;display:flex;flex-direction:column;background:transparent;overflow:hidden;position:relative;z-index:10;}
.top-bar{display:flex;align-items:center;justify-content:space-between;padding:14px 24px;border-bottom:var(--topbar-border);background:var(--topbar-bg);backdrop-filter:var(--sidebar-blur);}
.top-bar h2{color:var(--text);margin:0;font-size:17px;}
.chip{display:flex;align-items:center;gap:10px;color:var(--t2);font-size:14px;}
.av{width:32px;height:32px;background:linear-gradient(135deg,#00ff9f,#00c8ff);border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;color:#000;font-size:14px;}
.av-img{width:32px;height:32px;border-radius:50%;object-fit:cover;}
.body{flex:1;overflow-y:auto;}.body.pad{padding:24px;}
.card{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:24px;backdrop-filter:blur(10px);transition:box-shadow .2s;}.card:hover{box-shadow:var(--glow);}.card h3{color:var(--text);margin:0 0 20px;font-size:16px;}
.mt{margin-top:16px;}
.stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:16px;}
.sc{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:20px;text-align:center;}
.sn{font-size:28px;font-weight:800;color:var(--text);margin-bottom:4px;}
.sl{color:var(--t2);font-size:12px;}
.row-sb{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;}
.row-gap{display:flex;gap:10px;flex-wrap:wrap;}
.col-gap{display:flex;flex-direction:column;gap:12px;}
.list-col{display:flex;flex-direction:column;gap:10px;}
.list-item{display:flex;align-items:center;justify-content:space-between;padding:14px;background:var(--bg2);border:1px solid var(--border);border-radius:12px;}
.list-item h4{color:var(--text);margin:0 0 4px;font-size:14px;}
.meta{display:flex;gap:10px;flex-wrap:wrap;}
.meta span{color:var(--t2);font-size:12px;}
.empty{text-align:center;padding:40px;color:var(--t2);font-size:14px;}
.inp{width:100%;box-sizing:border-box;background:var(--bg2);border:1px solid var(--border);color:var(--text);border-radius:10px;padding:12px 14px;font-size:14px;font-family:inherit;text-align:right;}
.inp:focus{outline:none;border-color:var(--accent);}
.search{width:240px;padding:9px 14px;}
.btn-p{background:linear-gradient(135deg,var(--accent),#00c8ff);color:#000;border:none;border-radius:10px;padding:11px 18px;cursor:pointer;font-size:14px;font-weight:700;box-shadow:0 0 14px rgba(0,255,159,.2);transition:box-shadow .15s,opacity .15s;}
.btn-p:disabled{opacity:.5;cursor:not-allowed;}
.btn-p:hover:not(:disabled){box-shadow:0 0 24px rgba(0,255,159,.35);}
.btn-o{background:transparent;border:1px solid var(--border);color:var(--t2);border-radius:10px;padding:11px 18px;cursor:pointer;font-size:14px;}
.btn-s{background:var(--bg3);border:1px solid var(--border);color:var(--t2);border-radius:8px;padding:7px 12px;cursor:pointer;font-size:12px;}
.btn-s.danger{background:rgba(239,68,68,.1);border-color:rgba(239,68,68,.3);color:#f87171;}
.modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:100;}
.modal-box{background:var(--bg2);border:1px solid var(--border);border-radius:20px;padding:32px;width:90%;max-width:420px;}
.modal-box h3{color:var(--text);margin:0 0 12px;}
.info-box{background:rgba(99,102,241,.1);border:1px solid rgba(99,102,241,.2);border-radius:12px;padding:16px;}
.info-box p{color:var(--t2);font-size:13px;margin:4px 0;line-height:1.7;}
.file-input{background:var(--bg2);border:2px dashed var(--border);color:var(--text);border-radius:10px;padding:20px;cursor:pointer;font-size:13px;text-align:center;}
.file-chip{display:flex;align-items:center;justify-content:space-between;background:rgba(99,102,241,.1);border:1px solid rgba(99,102,241,.3);border-radius:10px;padding:10px 14px;color:var(--text);font-size:13px;}
.pass-badge{background:rgba(99,102,241,.15);border:1px solid rgba(99,102,241,.3);color:var(--accent);border-radius:8px;padding:4px 10px;font-size:13px;font-family:monospace;}
.settings-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px;}
.avatar-section{display:flex;align-items:center;gap:14px;margin-bottom:16px;}
.av-preview{width:60px;height:60px;border-radius:50%;object-fit:cover;border:2px solid var(--border);}
.av-overlay{position:absolute;inset:0;border-radius:50%;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;font-size:18px;opacity:0;transition:opacity .15s;}
.avatar-section>div:first-child:hover .av-overlay{opacity:1;}
.av-big{width:60px;height:60px;min-width:60px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:26px;color:#fff;}
.avatar-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:12px 0;}
.avatar-option{cursor:pointer;border-radius:50%;padding:4px;border:3px solid transparent;transition:all 0.2s;display:flex;align-items:center;justify-content:center;}
.avatar-option:hover{border-color:var(--accent);transform:scale(1.1);}
.avatar-option.selected{border-color:var(--accent);box-shadow:0 0 12px var(--accent);}
.info-row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border);color:var(--t2);font-size:13px;}
.info-row b{color:var(--text);}
.theme-row{display:flex;gap:10px;flex-wrap:wrap;}
.t-btn{background:var(--bg3);border:1px solid var(--border);color:var(--t2);border-radius:10px;padding:9px 16px;cursor:pointer;font-size:13px;transition:all .15s;}
.t-btn.active{background:rgba(99,102,241,.2);border-color:var(--accent);color:var(--accent);}
.toggle-lbl{display:flex;align-items:center;gap:10px;cursor:pointer;color:var(--t2);font-size:14px;}
.toggle-lbl input{accent-color:var(--accent);width:18px;height:18px;}
@media(max-width:768px){.sidebar{position:fixed;top:0;right:0;height:100vh;width:80vw;max-width:300px;transform:translateX(100%);transition:transform .25s ease;z-index:1001;box-shadow:-4px 0 24px rgba(0,0,0,.5);overflow-y:auto;background:#0b1226 !important;backdrop-filter:none !important;-webkit-backdrop-filter:none !important}.sidebar.open{transform:translateX(0)}.sidebar .nav-item,.sidebar .nav-icon{color:#cbd5e1 !important}.sidebar .nav-item.active{color:#5b9dff !important;background:rgba(91,157,255,.15) !important}.sidebar .nav-label,.sidebar .brand-name{color:#e6edf3 !important}.stats-grid{grid-template-columns:1fr 1fr}.settings-grid{grid-template-columns:1fr}}
</style>

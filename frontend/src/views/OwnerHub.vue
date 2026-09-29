<template>
  <div class="intel-hub">
    <!-- ═══ خلفيات ═══ -->
    <div class="scanlines" />
    <MatrixBackground />
    <div class="grid-overlay" />

    <!-- ═══ Mobile toggle ═══ -->
    <button class="mobile-toggle" @click="mobileOpen = !mobileOpen">{{ mobileOpen ? '✕' : '☰' }}</button>
    <div :class="['mobile-overlay', { open: mobileOpen }]" @click="mobileOpen = false" />

    <!-- ════════════════════════════════════════
         SIDEBAR — ملف التصنيف السري
    ════════════════════════════════════════ -->
    <aside :class="['intel-sidebar', { collapsed: sb, open: mobileOpen }]">
      <!-- شعار المالك -->
      <div class="sb-brand" @click="sb = !sb">
        <div class="brand-orb">
          <span class="brand-glyph">M</span>
          <div class="brand-ring" />
        </div>
        <div v-if="!sb" class="brand-text">
          <div class="brand-name">MORIX</div>
          <div class="brand-level">OWNER CLEARANCE</div>
        </div>
      </div>

      <!-- حالة الاتصال -->
      <div v-if="!sb" class="sb-status">
        <span class="status-dot" />
        <span class="status-text">SYSTEM ONLINE</span>
        <span class="status-time">{{ currentTime }}</span>
      </div>

      <!-- الأقسام -->
      <nav class="sb-nav">
        <div v-if="!sb" class="sb-section-label">/// OPERATIONS</div>
        <button v-for="s in sections" :key="s.id"
          :class="['intel-nav-btn', { active: cur === s.id }]"
          @click="cur = s.id; mobileOpen = false">
          <span class="nav-icon" v-html="s.svg"></span>
          <span v-if="!sb" class="nav-label">{{ s.label }}</span>
          <span v-if="!sb && s.id === 'complaints' && pendingComplaints > 0"
            class="nav-badge">{{ pendingComplaints }}</span>
        </button>

        <div v-if="!sb" class="sb-divider">/// LINKED HUBS</div>
        <button v-for="s in otherSections" :key="s.path"
          class="intel-nav-btn linked"
          @click="router.push(s.path); mobileOpen = false">
          <span class="nav-icon" v-html="s.svg"></span>
          <span v-if="!sb" class="nav-label">{{ s.label }}</span>
          <span v-if="!sb" class="nav-arrow">↗</span>
        </button>
      </nav>

      <div class="sb-footer">
        <button class="logout-intel" @click="doLogout">
          <span>⏻</span>
          <span v-if="!sb">DISCONNECT</span>
        </button>
      </div>
    </aside>

    <!-- ════════════════════════════════════════
         MAIN — مركز العمليات
    ════════════════════════════════════════ -->
    <main class="intel-main">

      <!-- Header strip -->
      <header class="intel-header">
        <div class="hdr-left">
          <div class="hdr-breadcrumb">
            <span class="hdr-crumb-root">MORIX CONTROL</span>
            <span class="hdr-sep">›</span>
            <span class="hdr-crumb-cur">{{ sections.find(s => s.id === cur)?.label || 'OVERVIEW' }}</span>
          </div>
          <div class="hdr-classify">
            <span class="classify-badge">👑 TOP ACCESS</span>
            <span class="classify-badge warn" v-if="pendingComplaints > 0">⚠️ {{ pendingComplaints }} PENDING</span>
          </div>
        </div>
        <div class="hdr-right">
          <div class="hdr-metric" title="المستخدمون النشطون">
            <div class="metric-dot green" />
            <span>{{ stats?.total_users ?? '—' }} USERS</span>
          </div>
          <div class="hdr-metric" title="المدارس">
            <div class="metric-dot blue" />
            <span>{{ stats?.total_schools ?? '—' }} SCHOOLS</span>
          </div>
          <div class="intel-avatar" :title="ownerSettings.full_name">
            <svg v-if="ownerSettings.avatar_url && avatarMap[ownerSettings.avatar_url]" viewBox="0 0 80 80" width="32" height="32">
              <circle cx="40" cy="40" r="38" :fill="avatarMap[ownerSettings.avatar_url].bg"/>
              <circle cx="40" cy="32" r="16" :fill="avatarMap[ownerSettings.avatar_url].skin"/>
              <ellipse cx="40" cy="62" rx="22" ry="16" :fill="avatarMap[ownerSettings.avatar_url].outfit"/>
              <path :d="avatarMap[ownerSettings.avatar_url].hair" :fill="avatarMap[ownerSettings.avatar_url].hairColor"/>
            </svg>
            <span v-else>👑</span>
          </div>
        </div>
      </header>

      <!-- ════ OVERVIEW ════ -->
      <section v-show="cur === 'overview'" class="intel-body">
        <!-- شريط الحالة العلوي -->
        <div class="threat-bar">
          <div class="threat-label">PLATFORM STATUS</div>
          <div class="threat-levels">
            <div :class="['tlevel', threatLevel === 'secure' ? 'active' : '']">🟢 SECURE</div>
            <div :class="['tlevel', threatLevel === 'advisory' ? 'active' : '']">🟡 ADVISORY</div>
            <div :class="['tlevel', threatLevel === 'elevated' ? 'active' : '']">🔴 ELEVATED</div>
          </div>
          <button class="intel-btn sm" @click="refreshAll">
            <span v-if="loadingAll" class="spin-icon">⟳</span>
            <span v-else>⟳ REFRESH</span>
          </button>
        </div>

        <!-- بطاقات الإحصائيات الرئيسية -->
        <div class="kpi-grid">
          <div v-for="kpi in kpiCards" :key="kpi.label" class="kpi-card" :style="`--kc: ${kpi.color}`">
            <div class="kpi-label">{{ kpi.label }}</div>
            <div class="kpi-value" :style="`color: ${kpi.color}`">
              <span class="kpi-num">{{ kpi.value ?? '—' }}</span>
            </div>
            <div class="kpi-bar">
              <div class="kpi-fill" :style="`width: ${kpi.pct}%; background: ${kpi.color}`" />
            </div>
            <div class="kpi-icon">{{ kpi.icon }}</div>
          </div>
        </div>

        <!-- جدول المدارس -->
        <div class="intel-panel mt-4" v-if="stats?.schools?.length">
          <div class="panel-header">
            <span class="panel-title">🏫 REGISTERED SCHOOLS — FIELD STATUS</span>
            <span class="panel-count">{{ stats.schools.length }} TOTAL</span>
          </div>
          <div class="school-table">
            <div v-for="(sch, i) in stats.schools" :key="sch.id" class="school-row">
              <div class="school-index">[{{ String(i + 1).padStart(2, '0') }}]</div>
              <div class="school-name">{{ sch.name }}</div>
              <div class="school-branch" v-if="sch.branch">{{ sch.branch }}</div>
              <div class="school-users">
                <span class="mini-badge blue">{{ sch.user_count ?? 0 }} مستخدم</span>
              </div>
              <div class="school-status">
                <span v-if="sch.setup_completed" class="mini-badge green">✅ OPERATIONAL</span>
                <span v-else class="mini-badge amber">⚠️ PENDING SETUP</span>
              </div>
            </div>
          </div>
        </div>

        <!-- آخر النشاط -->
        <div class="intel-panel mt-4">
          <div class="panel-header">
            <span class="panel-title">📡 RECENT ACTIVITY LOG</span>
          </div>
          <div class="activity-feed">
            <div v-for="log in activityLog" :key="log.id" class="activity-row">
              <span class="activity-time">{{ log.time }}</span>
              <span :class="['activity-type', log.type]">{{ log.tag }}</span>
              <span class="activity-msg">{{ log.msg }}</span>
            </div>
            <div v-if="!activityLog.length" class="empty-feed">/// NO RECENT ACTIVITY DETECTED</div>
          </div>
        </div>
      </section>

      <!-- ════ PULSE ════ -->
      <section v-show="cur === 'pulse'" class="intel-body">
        <div class="intel-panel">
          <div class="panel-header">
            <span class="panel-title">📡 PLATFORM PULSE — LIVE INTELLIGENCE</span>
            <button class="intel-btn sm" @click="loadPulse" :disabled="pulseLoading">
              <span v-if="pulseLoading" class="spin-icon">⟳</span>
              <span v-else>⟳ SCAN NOW</span>
            </button>
          </div>

          <div v-if="!pulse && !pulseLoading" class="scan-prompt">
            <div class="scan-icon">📡</div>
            <p>اضغط SCAN NOW لجلب بيانات المنصة اللحظية</p>
          </div>

          <div v-if="pulseLoading" class="scanning-anim">
            <div class="scan-line" />
            <p class="scan-text">/// SCANNING PLATFORM NODES...</p>
          </div>

          <div v-if="pulse" class="pulse-grid">
            <div v-for="m in pulseMetrics" :key="m.label" class="pulse-metric" :style="`--pm: ${m.color}`">
              <div class="pm-icon">{{ m.icon }}</div>
              <div class="pm-value" :style="`color: ${m.color}`">{{ m.value }}</div>
              <div class="pm-label">{{ m.label }}</div>
              <div class="pm-glow" />
            </div>
          </div>

          <div v-if="pulse" class="health-bar-section">
            <div class="hbs-label">PLATFORM HEALTH SCORE</div>
            <div class="hbs-track">
              <div class="hbs-fill"
                :style="`width: ${pulse.health_score}%; background: ${pulse.health_score >= 70 ? '#00ff41' : pulse.health_score >= 40 ? '#fbbf24' : '#ef4444'}`" />
            </div>
            <div class="hbs-value">{{ pulse.health_score }}<span style="font-size:14px">/100</span></div>
          </div>
        </div>
      </section>

      <!-- ════ AI COST ════ -->
      <section v-show="cur === 'aicost'" class="intel-body">
        <div class="intel-panel">
          <div class="panel-header">
            <span class="panel-title">💰 OPERATIONS BUDGET — AI EXPENDITURE</span>
            <button class="intel-btn sm" @click="loadAiCost" :disabled="aiCostLoading">
              <span v-if="aiCostLoading" class="spin-icon">⟳</span>
              <span v-else>📊 CALCULATE</span>
            </button>
          </div>

          <div v-if="!aiCost && !aiCostLoading" class="scan-prompt">
            <div class="scan-icon">💰</div>
            <p>احسب تكلفة الذكاء الاصطناعي للمنصة</p>
          </div>

          <div v-if="aiCostLoading" class="scanning-anim">
            <div class="scan-line" />
            <p class="scan-text">/// CALCULATING OPERATIONAL COSTS...</p>
          </div>

          <div v-if="aiCost" class="cost-grid">
            <div class="cost-card">
              <div class="cost-label">WEEKLY CALLS</div>
              <div class="cost-value blue">{{ aiCost.calls_this_week }}</div>
            </div>
            <div class="cost-card">
              <div class="cost-label">WEEKLY COST</div>
              <div class="cost-value green">${{ aiCost.estimated_cost_usd }}</div>
            </div>
            <div class="cost-card">
              <div class="cost-label">PROJECTED MONTHLY</div>
              <div class="cost-value amber">${{ aiCost.estimated_monthly_cost }}</div>
            </div>
            <div class="cost-card">
              <div class="cost-label">CACHE SAVINGS</div>
              <div class="cost-value green">{{ aiCost.savings_from_cache }}</div>
            </div>
          </div>

          <div v-if="aiCost" class="cost-insight">
            <div class="ci-icon">🤖</div>
            <div class="ci-text">
              كل مكالمة AI تكلف ~${{ (aiCost.estimated_cost_usd / (aiCost.calls_this_week || 1)).toFixed(4) }} — الكاش يوفر وقتاً وتكلفة.
            </div>
          </div>
        </div>
      </section>

      <!-- ════ CHURN RISK ════ -->
      <section v-show="cur === 'churn'" class="intel-body">
        <div class="intel-panel">
          <div class="panel-header">
            <span class="panel-title">⚠️ CHURN RISK ASSESSMENT — THREAT MATRIX</span>
            <button class="intel-btn sm" @click="loadChurn" :disabled="churnLoading">
              <span v-if="churnLoading" class="spin-icon">⟳</span>
              <span v-else>🔍 ANALYZE</span>
            </button>
          </div>

          <div v-if="!churn && !churnLoading" class="scan-prompt">
            <div class="scan-icon">⚠️</div>
            <p>حلّل مخاطر إلغاء اشتراك المدارس</p>
          </div>

          <div v-if="churnLoading" class="scanning-anim">
            <div class="scan-line" />
            <p class="scan-text">/// ANALYZING THREAT VECTORS...</p>
          </div>

          <div v-if="churn && !churn.at_risk_schools?.length" class="all-clear">
            <span>✅</span>
            <span>ALL SCHOOLS OPERATIONAL — NO CHURN RISK DETECTED</span>
          </div>

          <div v-if="churn" class="threat-matrix">
            <div v-for="s in churn.at_risk_schools" :key="s.school_id"
              :class="['threat-row', s.risk_level]">
              <div class="threat-level-indicator" :class="s.risk_level">
                {{ s.risk_level === 'high' ? '🔴 HIGH' : '🟡 MED' }}
              </div>
              <div class="threat-name">{{ s.school_name }}</div>
              <div class="threat-stats">
                <span>INACTIVE: <b>{{ s.inactive_pct }}%</b></span>
                <span>USERS: <b>{{ s.users ?? '—' }}</b></span>
              </div>
              <div class="threat-bar-wrap">
                <div class="threat-fill"
                  :style="`width: ${s.inactive_pct}%; background: ${s.risk_level === 'high' ? '#ef4444' : '#fbbf24'}`" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ════ BROADCAST ════ -->
      <section v-show="cur === 'broadcast'" class="intel-body">
        <div class="intel-panel">
          <div class="panel-header">
            <span class="panel-title">📡 BROADCAST TRANSMISSION — PLATFORM-WIDE</span>
          </div>

          <div class="broadcast-form">
            <div class="bf-field">
              <label class="bf-label">/// TRANSMISSION TITLE</label>
              <input v-model="bcTitle" class="intel-input" placeholder="عنوان الرسالة..." />
            </div>
            <div class="bf-field">
              <label class="bf-label">/// MESSAGE PAYLOAD</label>
              <textarea v-model="bcContent" class="intel-input ta" rows="6"
                placeholder="محتوى الرسالة للبث على المنصة..."></textarea>
            </div>
            <div class="bf-actions">
              <button class="intel-btn primary" @click="sendBroadcast" :disabled="bcLoading">
                <span v-if="bcLoading" class="spin-icon">⟳</span>
                <span v-else>📡 TRANSMIT NOW</span>
              </button>
              <div class="bf-hint">
                ستصل الرسالة لجميع مستخدمي المنصة فوراً
              </div>
            </div>
            <div v-if="bcMsg" class="bc-confirm">
              <span>✅</span> {{ bcMsg }}
            </div>
          </div>
        </div>
      </section>

      <!-- ════ COMPLAINTS — Field Reports ════ -->
      <section v-show="cur === 'complaints'" class="intel-body">
        <div class="intel-panel">
          <div class="panel-header">
            <span class="panel-title">📋 FIELD REPORTS — COMPLAINTS & SUGGESTIONS</span>
            <span class="panel-count" v-if="pendingComplaints > 0">
              🔴 {{ pendingComplaints }} UNRESOLVED
            </span>
          </div>

          <div v-if="complaintsLoading" class="scanning-anim">
            <div class="scan-line" />
            <p class="scan-text">/// RETRIEVING FIELD REPORTS...</p>
          </div>

          <div v-else-if="!complaints.length" class="all-clear">
            <span>✅</span>
            <span>NO PENDING FIELD REPORTS</span>
          </div>

          <div v-else class="reports-list">
            <div v-for="c in complaints" :key="c.id"
              :class="['report-card', c.status]">
              <div class="report-header">
                <span :class="['report-type', c.type]">
                  {{ { complaint: '🔴 COMPLAINT', suggestion: '🟢 SUGGESTION', bug: '🟡 BUG REPORT' }[c.type] }}
                </span>
                <span class="report-meta">{{ c.users?.full_name }}</span>
                <span class="report-meta">{{ fmtDate(c.created_at) }}</span>
                <span :class="['report-status', c.status]">
                  {{ { pending: '⏳ PENDING', reviewed: '🔵 IN REVIEW', resolved: '✅ RESOLVED' }[c.status] }}
                </span>
              </div>
              <div class="report-title">{{ c.title }}</div>
              <div class="report-content">{{ c.content }}</div>

              <div v-if="c.response && respondingTo !== c.id" class="report-response">
                <span class="rr-label">/// OWNER RESPONSE:</span>
                <span>{{ c.response }}</span>
              </div>

              <div v-if="respondingTo === c.id" class="respond-form">
                <select v-model="respondStatus" class="intel-input sm">
                  <option value="reviewed">IN REVIEW</option>
                  <option value="resolved">RESOLVED</option>
                </select>
                <textarea v-model="respondText" class="intel-input ta" rows="3"
                  placeholder="ردك على البلاغ..." />
                <div style="display:flex;gap:10px;margin-top:8px">
                  <button class="intel-btn primary sm" @click="sendResponse(c.id)">📤 TRANSMIT RESPONSE</button>
                  <button class="intel-btn ghost sm" @click="respondingTo = null">✕ CANCEL</button>
                </div>
              </div>
              <button v-else class="intel-btn ghost sm" style="margin-top:12px"
                @click="respondingTo = c.id; respondText = c.response || ''; respondStatus = c.status">
                💬 RESPOND
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- ════ USERS — Agent Database ════ -->
      <section v-show="cur === 'users'" class="intel-body">
        <div class="intel-panel">
          <div class="panel-header">
            <span class="panel-title">👥 AGENT DATABASE — USER REGISTRY</span>
            <div style="display:flex;gap:8px;align-items:center">
              <span class="panel-count">{{ filteredUsers.length }}/{{ users.length }}</span>
              <input v-model="userSearch" class="intel-input sm" style="width:160px" placeholder="🔍 SEARCH..." />
            </div>
          </div>

          <div v-if="usersLoading" class="scanning-anim">
            <div class="scan-line" />
            <p class="scan-text">/// QUERYING USER DATABASE...</p>
          </div>

          <div v-else class="agents-table">
            <div class="agents-thead">
              <span>AGENT ID</span>
              <span>NAME</span>
              <span>ROLE</span>
              <span>UNIT</span>
              <span>STATUS</span>
              <span>ACTION</span>
            </div>
            <div v-for="(u, i) in filteredUsers" :key="u.id" class="agent-row">
              <span class="agent-index">[{{ String(i + 1).padStart(3, '0') }}]</span>
              <span class="agent-name">{{ u.full_name }}</span>
              <span :class="['agent-role', u.role]">
                {{ { manager: '🏛️ MGR', admin: '🛡️ ADM', teacher: '📖 TCH', student: '🎓 STU', owner: '👑 OWN' }[u.role] || u.role }}
              </span>
              <span class="agent-school">{{ u.schools?.name || '—' }}</span>
              <span :class="['agent-status', u.is_active ? 'online' : 'offline']">
                <span class="status-dot" />
                {{ u.is_active ? 'ACTIVE' : 'SUSPENDED' }}
              </span>
              <button :class="['intel-btn', 'sm', u.is_active ? 'danger' : 'success']"
                @click="toggleUser(u.id)">
                {{ u.is_active ? 'SUSPEND' : 'ACTIVATE' }}
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- ════ SETTINGS ════ -->
      <section v-show="cur === 'settings'" class="intel-body">
        <div class="settings-grid">
          <!-- ملف الضابط -->
          <div class="intel-panel">
            <div class="panel-header">
              <span class="panel-title">👤 OPERATOR PROFILE</span>
            </div>
            <div class="profile-card">
              <div class="profile-avatar-wrap">
                <svg v-if="ownerSettings.avatar_url && avatarMap[ownerSettings.avatar_url]" viewBox="0 0 80 80" width="64" height="64">
                  <circle cx="40" cy="40" r="38" :fill="avatarMap[ownerSettings.avatar_url].bg"/>
                  <circle cx="40" cy="32" r="16" :fill="avatarMap[ownerSettings.avatar_url].skin"/>
                  <ellipse cx="40" cy="62" rx="22" ry="16" :fill="avatarMap[ownerSettings.avatar_url].outfit"/>
                  <path :d="avatarMap[ownerSettings.avatar_url].hair" :fill="avatarMap[ownerSettings.avatar_url].hairColor"/>
                </svg>
                <div v-else class="profile-av-placeholder">👑</div>
              </div>
              <div class="profile-info">
                <div class="pi-name">{{ ownerSettings.full_name }}</div>
                <div class="pi-email">{{ ownerSettings.email }}</div>
                <div class="pi-role">👑 OWNER — FULL CLEARANCE</div>
              </div>
            </div>
            <div class="avatar-grid">
              <div v-for="av in avatarOptions" :key="av.id"
                   class="avatar-option" :class="{ selected: ownerSettings.avatar_url === av.id }"
                   @click="selectAvatar(av.id)">
                <svg viewBox="0 0 80 80" width="56" height="56">
                  <circle cx="40" cy="40" r="38" :fill="av.bg"/>
                  <circle cx="40" cy="32" r="16" :fill="av.skin"/>
                  <ellipse cx="40" cy="62" rx="22" ry="16" :fill="av.outfit"/>
                  <path :d="av.hair" :fill="av.hairColor"/>
                </svg>
              </div>
            </div>
          </div>

          <!-- المظهر -->
          <div class="intel-panel">
            <div class="panel-header"><span class="panel-title">🎨 INTERFACE THEME</span></div>
            <div class="theme-selector">
              <button v-for="th in themes" :key="th.k"
                :class="['theme-opt', { active: ownerSettings.theme === th.k }]"
                @click="ownerSettings.theme = th.k; saveOwnerSettings()">
                <span class="theme-icon">{{ th.i }}</span>
                <span class="theme-label">{{ th.l }}</span>
              </button>
            </div>
          </div>

          <!-- اللغة -->
          <div class="intel-panel">
            <div class="panel-header"><span class="panel-title">🌐 LANGUAGE PROTOCOL</span></div>
            <div class="lang-grid">
              <button v-for="(L, code) in languages" :key="code"
                :class="['lang-opt', { active: ownerSettings.language === code }]"
                @click="changeLang(code)">
                {{ L.flag }} {{ L.name }}
              </button>
            </div>
          </div>

          <!-- الإشعارات -->
          <div class="intel-panel">
            <div class="panel-header"><span class="panel-title">🔔 ALERT PROTOCOL</span></div>
            <label class="toggle-row">
              <div class="intel-toggle">
                <input type="checkbox" v-model="ownerSettings.notifications_enabled"
                  @change="saveOwnerSettings" class="toggle-cb" />
                <span class="toggle-track"><span class="toggle-thumb" /></span>
              </div>
              <span class="toggle-label">{{ ownerSettings.notifications_enabled ? '🟢 ALERTS ACTIVE' : '🔴 ALERTS MUTED' }}</span>
            </label>
          </div>
        </div>
        <div v-if="settingsMsg" class="settings-saved">{{ settingsMsg }}</div>
      </section>

    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '../stores/auth.js'
import { useRouter } from 'vue-router'
import { ownerAPI } from '../api.js'
import { useTheme } from '../composables/useTheme.js'
import { useI18n, LANGUAGES } from '../composables/useI18n.js'
import MatrixBackground from '../components/MatrixBackground.vue'

const auth = useAuthStore()
const router = useRouter()
const { t, setLang } = useI18n()
const languages = LANGUAGES

const ownerSettings = ref({
  theme: 'dark', language: 'ar',
  notifications_enabled: true, avatar_url: '',
  email: auth.user?.email || '', full_name: auth.user?.full_name || ''
})

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
useTheme(ownerSettings)
const settingsMsg = ref('')

const themes = [
  { k: 'dark',    i: '🌙', l: 'DARK INTEL' },
  { k: 'light',   i: '☀️', l: 'LIGHT OPS' },
  { k: 'library', i: '📚', l: 'LIBRARY' },
  { k: 'neon',    i: '💜', l: 'CYBER' },
]

// ─── Clock ───────────────────────────────────────────────────────────────────
const currentTime = ref('')
let clockTimer = null
function tickClock() {
  const now = new Date()
  currentTime.value = now.toTimeString().slice(0, 8)
}
tickClock()

// ─── Sections ────────────────────────────────────────────────────────────────
const sections = computed(() => [
  { id: 'overview',   svg: '<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M2 11h3v6H2zm5-4h3v10H7zm5-5h3v15h-3z"/></svg>', label: 'OVERVIEW' },
  { id: 'pulse',      svg: '<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M3.17 5.17a4.5 4.5 0 016.36 0L10 5.64l.47-.47a4.5 4.5 0 016.36 6.36L10 18.36l-6.83-6.83a4.5 4.5 0 010-6.36z"/></svg>', label: 'LIVE PULSE' },
  { id: 'aicost',     svg: '<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M2 5a2 2 0 012-2h12a2 2 0 012 2v6a2 2 0 01-2 2h-2l-4 4-4-4H4a2 2 0 01-2-2V5zm4 3a1 1 0 100 2h.01a1 1 0 100-2H6zm4 0a1 1 0 100 2h.01a1 1 0 100-2H10zm4 0a1 1 0 100 2h.01a1 1 0 100-2H14z"/></svg>', label: 'AI BUDGET' },
  { id: 'churn',      svg: '<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M3.17 5.17a4.5 4.5 0 016.36 0L10 5.64l.47-.47a4.5 4.5 0 016.36 6.36L10 18.36l-6.83-6.83a4.5 4.5 0 010-6.36z"/></svg>', label: 'CHURN RISK' },
  { id: 'broadcast',  svg: '<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M18 3v14a1 1 0 01-1.6.8L12 14H5a2 2 0 01-2-2V8a2 2 0 012-2h7l4.4-3.8A1 1 0 0118 3zM5 15h4v2a1 1 0 01-1 1H6a1 1 0 01-1-1v-2z"/></svg>', label: 'BROADCAST' },
  { id: 'complaints', svg: '<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884zM18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/></svg>', label: 'FIELD REPORTS' },
  { id: 'users',      svg: '<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M7 8a4 4 0 108 0 4 4 0 00-8 0zm0 2a6 6 0 00-6 6v1h20v-1a6 6 0 00-6-6H7z"/></svg>', label: 'USER REGISTRY' },
  { id: 'settings',   svg: '<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M11.5 2.6l.8 1.5a1 1 0 001 .5l1.6-.2a8 8 0 011.5 1.5l-.2 1.6a1 1 0 00.5 1l1.5.8v2.1l-1.5.8a1 1 0 00-.5 1l.2 1.6a8 8 0 01-1.5 1.5l-1.6-.2a1 1 0 00-1 .5l-.8 1.5H8.5l-.8-1.5a1 1 0 00-1-.5l-1.6.2a8 8 0 01-1.5-1.5l.2-1.6a1 1 0 00-.5-1L1.8 11V8.9l1.5-.8a1 1 0 00.5-1l-.2-1.6a8 8 0 011.5-1.5l1.6.2a1 1 0 001-.5l.8-1.5h3zM10 7a3 3 0 100 6 3 3 0 000-6z"/></svg>', label: 'SETTINGS' },
])
const otherSections = computed(() => [
  { path: '/manager', svg: '<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M10 2L2 7v2h16V7L10 2zM3 10v6h4v-4h6v4h4v-6H3z"/></svg>',  label: 'MANAGER HUB' },
  { path: '/admin',   svg: '<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M10 2L2 7v2h16V7L10 2zM3 10v6h4v-4h6v4h4v-6H3z"/></svg>', label: 'ADMIN HUB' },
  { path: '/teacher', svg: '<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M10.5 2a6 6 0 00-6 6c0 2.2 1.2 4.2 3 5.2V15a1 1 0 001 1h4a1 1 0 001-1v-1.8c1.8-1 3-3 3-5.2a6 6 0 00-6-6zm-1 15h2v1a1 1 0 01-2 0v-1z"/></svg>', label: 'TEACHER HUB' },
  { path: '/student', svg: '<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M10.39 2.2a1 1 0 00-.78 0l-8 3.5a1 1 0 000 1.82L4 8.5V13a1 1 0 00.55.89C5.95 14.6 7.8 15.5 10 15.5s4.05-.9 5.45-1.61A1 1 0 0016 13V8.5l2-1v5a1 1 0 102 0V7.2l-9.61-5z"/></svg>', label: 'STUDENT HUB' },
])

const cur = ref('overview')
const sb  = ref(false)
const mobileOpen = ref(false)
const loadingAll = ref(false)

// ─── Stats ────────────────────────────────────────────────────────────────────
const stats = ref(null)

const kpiCards = computed(() => {
  if (!stats.value) return []
  const s = stats.value
  const total = s.total_users || 1
  return [
    { label: 'TOTAL USERS',      value: s.total_users,           pct: 100,                              color: '#4a7eff', icon: '👤' },
    { label: 'STUDENTS',         value: s.role_counts?.student || 0, pct: ((s.role_counts?.student || 0) / total * 100).toFixed(0), color: '#00d4ff', icon: '🎓' },
    { label: 'TEACHERS',         value: s.role_counts?.teacher || 0, pct: ((s.role_counts?.teacher || 0) / total * 100).toFixed(0), color: '#8b5cf6', icon: '📖' },
    { label: 'SCHOOLS',          value: s.total_schools,          pct: Math.min(s.total_schools * 10, 100), color: '#10b981', icon: '🏫' },
    { label: 'AI CONVERSATIONS', value: s.total_conversations,    pct: Math.min((s.total_conversations || 0) / 10, 100), color: '#f59e0b', icon: '🤖' },
    { label: 'OPEN COMPLAINTS',  value: s.complaint_stats?.pending || 0, pct: Math.min((s.complaint_stats?.pending || 0) * 20, 100), color: '#ef4444', icon: '🚨' },
  ]
})

const threatLevel = computed(() => {
  if (!stats.value) return 'secure'
  const pending = stats.value.complaint_stats?.pending || 0
  if (pending >= 5) return 'elevated'
  if (pending >= 2) return 'advisory'
  return 'secure'
})

// ─── Activity Log ─────────────────────────────────────────────────────────────
const activityLog = ref([])

// ─── Complaints ───────────────────────────────────────────────────────────────
const complaints = ref([])
const complaintsLoading = ref(false)
const respondingTo = ref(null)
const respondText = ref('')
const respondStatus = ref('reviewed')
const pendingComplaints = computed(() => complaints.value.filter(c => c.status === 'pending').length)

// ─── Users ────────────────────────────────────────────────────────────────────
const users = ref([])
const usersLoading = ref(false)
const userSearch = ref('')
const filteredUsers = computed(() => {
  if (!userSearch.value) return users.value
  const q = userSearch.value.toLowerCase()
  return users.value.filter(u =>
    u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
  )
})

// ─── Pulse ────────────────────────────────────────────────────────────────────
const pulse = ref(null)
const pulseLoading = ref(false)
const pulseMetrics = computed(() => pulse.value ? [
  { icon: '👥', label: 'TOTAL USERS',      value: pulse.value.total_users,      color: '#4a7eff' },
  { icon: '🟢', label: 'ACTIVE TODAY',     value: pulse.value.active_today,     color: '#10b981' },
  { icon: '📅', label: 'ACTIVE WEEK',      value: pulse.value.active_this_week, color: '#10b981' },
  { icon: '🤖', label: 'AI CALLS / WEEK',  value: pulse.value.ai_calls_week,    color: '#8b5cf6' },
  { icon: '📣', label: 'OPEN COMPLAINTS',  value: pulse.value.open_complaints,  color: '#ef4444' },
  { icon: '💪', label: 'HEALTH SCORE',     value: `${pulse.value.health_score}/100`, color: '#fbbf24' },
] : [])

async function loadPulse() {
  pulseLoading.value = true
  try { pulse.value = (await ownerAPI.platformPulse()).data } catch (e) { alert('فشل تحميل البيانات') }
  pulseLoading.value = false
}

// ─── AI Cost ─────────────────────────────────────────────────────────────────
const aiCost = ref(null)
const aiCostLoading = ref(false)
async function loadAiCost() {
  aiCostLoading.value = true
  try { aiCost.value = (await ownerAPI.aiCost()).data } catch (e) { alert('فشل') }
  aiCostLoading.value = false
}

// ─── Churn ────────────────────────────────────────────────────────────────────
const churn = ref(null)
const churnLoading = ref(false)
async function loadChurn() {
  churnLoading.value = true
  try { churn.value = (await ownerAPI.churnRisk()).data } catch (e) { alert('فشل') }
  churnLoading.value = false
}

// ─── Broadcast ───────────────────────────────────────────────────────────────
const bcTitle = ref(''), bcContent = ref(''), bcLoading = ref(false), bcMsg = ref('')
async function sendBroadcast() {
  if (!bcContent.value.trim()) return alert('اكتب محتوى الرسالة')
  bcLoading.value = true; bcMsg.value = ''
  try {
    const r = await ownerAPI.broadcast({ title: bcTitle.value, content: bcContent.value })
    bcMsg.value = r.data.message || 'TRANSMISSION SUCCESSFUL'
    bcTitle.value = ''; bcContent.value = ''
  } catch { alert('فشل') }
  bcLoading.value = false
}

// ─── Settings ─────────────────────────────────────────────────────────────────
async function loadOwnerSettings() {
  try {
    const r = await ownerAPI.getSettings()
    ownerSettings.value = { ...ownerSettings.value, ...r.data }
    if (ownerSettings.value.language) setLang(ownerSettings.value.language)
  } catch {}
}
async function saveOwnerSettings() {
  try {
    const r = await ownerAPI.updateSettings(ownerSettings.value)
    settingsMsg.value = '✅ SETTINGS SAVED'
    setTimeout(() => settingsMsg.value = '', 2500)
  } catch { settingsMsg.value = '❌ SAVE FAILED' }
}
function changeLang(code) {
  ownerSettings.value.language = code
  setLang(code)
  saveOwnerSettings()
}
function selectAvatar(id) {
  ownerSettings.value.avatar_url = id
  saveOwnerSettings()
}

// ─── Actions ─────────────────────────────────────────────────────────────────
async function sendResponse(id) {
  try {
    await ownerAPI.respondComplaint(id, { status: respondStatus.value, response: respondText.value })
    const c = complaints.value.find(c => c.id === id)
    if (c) { c.status = respondStatus.value; c.response = respondText.value }
    respondingTo.value = null
  } catch {}
}
async function toggleUser(id) {
  try {
    const r = await ownerAPI.toggleUser(id)
    const u = users.value.find(u => u.id === id)
    if (u) u.is_active = r.data.is_active
  } catch {}
}
async function doLogout() { await auth.logout(); router.push('/login') }
function fmtDate(d) { return d ? new Date(d).toLocaleDateString('ar-SA') : '' }

async function refreshAll() {
  loadingAll.value = true
  try { stats.value = (await ownerAPI.getStats()).data } catch {}
  loadingAll.value = false
  // بناء سجل النشاط الوهمي من البيانات
  buildActivityLog()
}

function buildActivityLog() {
  if (!stats.value) return
  const logs = []
  const now = new Date()
  if (stats.value.total_conversations)
    logs.push({ id: 1, time: fmtTime(now, -2), tag: 'AI', type: 'ai', msg: `${stats.value.total_conversations} محادثة AI مسجّلة` })
  if (stats.value.total_users)
    logs.push({ id: 2, time: fmtTime(now, -5), tag: 'SYS', type: 'sys', msg: `${stats.value.total_users} مستخدم نشط في النظام` })
  if (stats.value.complaint_stats?.pending)
    logs.push({ id: 3, time: fmtTime(now, -10), tag: 'ALERT', type: 'alert', msg: `${stats.value.complaint_stats.pending} شكوى تنتظر ردك` })
  if (stats.value.total_schools)
    logs.push({ id: 4, time: fmtTime(now, -15), tag: 'SYS', type: 'sys', msg: `${stats.value.total_schools} مدرسة متصلة` })
  activityLog.value = logs
}

function fmtTime(date, offsetMins) {
  const d = new Date(date.getTime() + offsetMins * 60000)
  return d.toTimeString().slice(0, 5)
}

// ─── Mount ────────────────────────────────────────────────────────────────────
onMounted(async () => {
  clockTimer = setInterval(tickClock, 1000)
  await loadOwnerSettings()
  await refreshAll()

  complaintsLoading.value = true
  try { complaints.value = (await ownerAPI.getComplaints()).data } catch {}
  finally { complaintsLoading.value = false }

  usersLoading.value = true
  try { users.value = (await ownerAPI.getUsers()).data } catch {}
  finally { usersLoading.value = false }
})
onUnmounted(() => clearInterval(clockTimer))
</script>

<style scoped>
/* ════════════════════════════════════════
   INTELLIGENCE HUB — CONTROL ROOM DESIGN
════════════════════════════════════════ */

/* ── Layout ── */
.intel-hub {
  display: flex;
  height: 100vh;
  overflow: hidden;
  font-family: 'Courier New', 'Tajawal', monospace;
  direction: rtl;
  background: #000a0f;
  position: relative;
}

/* Scanlines Effect */
.scanlines {
  position: fixed;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(0, 255, 65, 0.015) 2px,
    rgba(0, 255, 65, 0.015) 4px
  );
  animation: scanlines-move 8s linear infinite;
}
@keyframes scanlines-move {
  0% { background-position: 0 0; }
  100% { background-position: 0 100px; }
}

/* Grid Overlay */
.grid-overlay {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background-image:
    linear-gradient(rgba(0,255,65,0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0,255,65,0.03) 1px, transparent 1px);
  background-size: 40px 40px;
}

/* Mobile toggle */
.mobile-toggle {
  display: none;
  position: fixed; top: 12px; right: 12px; z-index: 100;
  background: rgba(0,255,65,0.1); border: 1px solid rgba(0,255,65,0.3);
  color: #00ff41; border-radius: 6px; padding: 8px 12px; cursor: pointer;
  font-size: 16px;
}
.mobile-overlay {
  display: none;
  position: fixed; inset: 0; z-index: 30;
  background: rgba(0,0,0,0.7);
  opacity: 0; pointer-events: none; transition: opacity 0.3s;
}
.mobile-overlay.open { opacity: 1; pointer-events: all; }

/* ── Sidebar ── */
.intel-sidebar {
  width: 230px;
  min-width: 230px;
  background: rgba(0, 10, 15, 0.95);
  border-left: 1px solid rgba(0,255,65,0.2);
  display: flex;
  flex-direction: column;
  transition: width 0.25s, min-width 0.25s;
  overflow: hidden;
  position: relative;
  z-index: 10;
  box-shadow: 4px 0 24px rgba(0,255,65,0.08);
}
.intel-sidebar.collapsed { width: 60px; min-width: 60px; }

/* Brand */
.sb-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 12px;
  border-bottom: 1px solid rgba(0,255,65,0.15);
  cursor: pointer;
  transition: background 0.2s;
}
.sb-brand:hover { background: rgba(0,255,65,0.05); }
.brand-orb {
  position: relative;
  width: 36px; height: 36px;
  flex-shrink: 0;
}
.brand-glyph {
  position: absolute;
  inset: 0;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #00ff41, #00c8ff);
  border-radius: 9px;
  font-weight: 900; font-size: 18px; color: #000;
  box-shadow: 0 0 16px rgba(0,255,65,0.5);
}
.brand-ring {
  position: absolute;
  inset: -3px;
  border: 1px solid rgba(0,255,65,0.4);
  border-radius: 12px;
  animation: ring-pulse 2s ease-in-out infinite;
}
@keyframes ring-pulse {
  0%, 100% { opacity: 0.4; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.04); }
}
.brand-name {
  font-size: 14px; font-weight: 900; color: #00ff41;
  letter-spacing: 3px;
}
.brand-level {
  font-size: 9px; color: rgba(0,255,65,0.5);
  letter-spacing: 1px; margin-top: 2px;
}

/* Status strip */
.sb-status {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  font-size: 10px;
  color: rgba(0,255,65,0.6);
  letter-spacing: 1px;
  border-bottom: 1px solid rgba(0,255,65,0.08);
}
.status-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: #00ff41;
  box-shadow: 0 0 6px #00ff41;
  animation: blink-dot 1.5s ease-in-out infinite;
}
@keyframes blink-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
.status-text { flex: 1; }
.status-time { font-variant-numeric: tabular-nums; }

/* Nav */
.sb-nav { flex: 1; padding: 8px; overflow-y: auto; }
.sb-section-label {
  font-size: 9px; color: rgba(0,255,65,0.35);
  padding: 8px 8px 4px;
  letter-spacing: 2px;
}
.sb-divider {
  font-size: 9px; color: rgba(0,200,255,0.35);
  padding: 10px 8px 4px;
  letter-spacing: 2px;
  border-top: 1px solid rgba(0,255,65,0.08);
  margin-top: 4px;
}
.intel-nav-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 9px 10px;
  border-radius: 7px;
  background: none;
  border: 1px solid transparent;
  color: rgba(0,255,65,0.5);
  cursor: pointer;
  font-size: 12px;
  transition: all 0.18s;
  text-align: right;
  white-space: nowrap;
  letter-spacing: 0.5px;
  position: relative;
  font-family: inherit;
}
.intel-nav-btn:hover {
  background: rgba(0,255,65,0.06);
  border-color: rgba(0,255,65,0.15);
  color: #00ff41;
}
.intel-nav-btn.active {
  background: rgba(0,255,65,0.1);
  border-color: rgba(0,255,65,0.3);
  color: #00ff41;
  box-shadow: inset 0 0 12px rgba(0,255,65,0.08), 0 0 8px rgba(0,255,65,0.1);
}
.intel-nav-btn.active::before {
  content: '';
  position: absolute;
  right: 0; top: 20%; bottom: 20%;
  width: 3px;
  background: #00ff41;
  border-radius: 2px;
  box-shadow: 0 0 8px #00ff41;
}
.intel-nav-btn.linked { color: rgba(0,200,255,0.5); }
.intel-nav-btn.linked:hover { color: #00c8ff; border-color: rgba(0,200,255,0.2); }
.nav-icon { font-size: 14px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; }
.nav-icon :deep(svg) { width: 16px; height: 16px; flex-shrink: 0; }
.nav-label { flex: 1; }
.nav-badge {
  background: #ef4444;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 10px;
  box-shadow: 0 0 8px rgba(239,68,68,0.5);
}
.nav-arrow { font-size: 11px; opacity: 0.4; }

/* Footer */
.sb-footer { padding: 10px; border-top: 1px solid rgba(0,255,65,0.12); }
.logout-intel {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 9px;
  border-radius: 7px;
  background: rgba(239,68,68,0.08);
  border: 1px solid rgba(239,68,68,0.2);
  color: #f87171;
  cursor: pointer;
  font-size: 12px;
  letter-spacing: 1px;
  transition: all 0.2s;
  font-family: inherit;
}
.logout-intel:hover {
  background: rgba(239,68,68,0.15);
  border-color: rgba(239,68,68,0.4);
  box-shadow: 0 0 12px rgba(239,68,68,0.2);
}

/* ── Main ── */
.intel-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
  z-index: 10;
}

/* Header */
.intel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 20px;
  background: rgba(0, 10, 15, 0.9);
  border-bottom: 1px solid rgba(0,255,65,0.15);
  backdrop-filter: blur(12px);
  flex-wrap: wrap;
  gap: 8px;
}
.hdr-left { display: flex; flex-direction: column; gap: 4px; }
.hdr-breadcrumb { display: flex; align-items: center; gap: 6px; }
.hdr-crumb-root { color: rgba(0,255,65,0.4); font-size: 11px; letter-spacing: 2px; }
.hdr-sep { color: rgba(0,255,65,0.3); }
.hdr-crumb-cur { color: #00ff41; font-size: 11px; letter-spacing: 2px; font-weight: 700; }
.hdr-classify { display: flex; gap: 8px; flex-wrap: wrap; }
.classify-badge {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid rgba(0,255,65,0.3);
  color: #00ff41;
  background: rgba(0,255,65,0.07);
  letter-spacing: 1px;
}
.classify-badge.warn {
  border-color: rgba(239,68,68,0.4);
  color: #f87171;
  background: rgba(239,68,68,0.08);
  animation: blink-warn 1.5s ease-in-out infinite;
}
@keyframes blink-warn {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
.hdr-right { display: flex; align-items: center; gap: 14px; }
.hdr-metric {
  display: flex; align-items: center; gap: 5px;
  font-size: 11px; color: rgba(255,255,255,0.5);
  letter-spacing: 1px;
}
.metric-dot {
  width: 7px; height: 7px; border-radius: 50%;
  animation: blink-dot 2s ease-in-out infinite;
}
.metric-dot.green { background: #00ff41; box-shadow: 0 0 6px #00ff41; }
.metric-dot.blue  { background: #00c8ff; box-shadow: 0 0 6px #00c8ff; }
.intel-avatar {
  width: 34px; height: 34px; border-radius: 50%;
  background: linear-gradient(135deg, #a855f7, #00c8ff);
  border: 2px solid rgba(0,255,65,0.3);
  display: flex; align-items: center; justify-content: center;
  font-size: 16px;
  box-shadow: 0 0 12px rgba(0,255,65,0.2);
  overflow: hidden;
}
.av-img { width: 100%; height: 100%; object-fit: cover; }

/* Body */
.intel-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.mt-4 { margin-top: 8px; }

/* ── Panels ── */
.intel-panel {
  background: rgba(0, 12, 20, 0.8);
  border: 1px solid rgba(0,255,65,0.15);
  border-radius: 12px;
  overflow: hidden;
  backdrop-filter: blur(8px);
  box-shadow: 0 0 20px rgba(0,0,0,0.4), inset 0 1px 0 rgba(0,255,65,0.08);
  transition: border-color 0.25s, box-shadow 0.25s;
}
.intel-panel:hover {
  border-color: rgba(0,255,65,0.25);
  box-shadow: 0 0 30px rgba(0,0,0,0.5), 0 0 15px rgba(0,255,65,0.06);
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(0,255,65,0.1);
  background: rgba(0,255,65,0.03);
}
.panel-title {
  font-size: 11px;
  color: rgba(0,255,65,0.7);
  letter-spacing: 2px;
  font-weight: 700;
}
.panel-count {
  font-size: 11px;
  color: rgba(255,255,255,0.4);
  letter-spacing: 1px;
}

/* ── Threat Bar ── */
.threat-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  background: rgba(0,12,20,0.8);
  border: 1px solid rgba(0,255,65,0.1);
  border-radius: 10px;
  flex-wrap: wrap;
}
.threat-label { font-size: 10px; color: rgba(0,255,65,0.5); letter-spacing: 2px; }
.threat-levels { display: flex; gap: 8px; flex: 1; }
.tlevel {
  font-size: 11px; padding: 4px 10px; border-radius: 4px;
  background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.3);
  border: 1px solid transparent;
  letter-spacing: 0.5px;
  transition: all 0.3s;
}
.tlevel.active {
  color: #fff;
  border-color: currentColor;
  box-shadow: 0 0 10px rgba(255,255,255,0.1);
}
.tlevel:first-child.active { background: rgba(0,255,65,0.1); border-color: #00ff41; color: #00ff41; }
.tlevel:nth-child(2).active { background: rgba(251,191,36,0.1); border-color: #fbbf24; color: #fbbf24; }
.tlevel:nth-child(3).active { background: rgba(239,68,68,0.1); border-color: #ef4444; color: #ef4444; }

/* ── KPI Cards ── */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
}
.kpi-card {
  position: relative;
  background: rgba(0,12,20,0.85);
  border: 1px solid rgba(var(--kc), 0.15);
  border-radius: 10px;
  padding: 16px;
  overflow: hidden;
  transition: all 0.25s;
  box-shadow: 0 0 20px rgba(0,0,0,0.3);
}
.kpi-card:hover {
  border-color: var(--kc);
  box-shadow: 0 0 20px rgba(0,0,0,0.4), 0 0 12px rgba(var(--kc), 0.15);
  transform: translateY(-2px);
}
.kpi-label {
  font-size: 9px; color: rgba(255,255,255,0.4);
  letter-spacing: 2px; margin-bottom: 8px;
}
.kpi-value { margin-bottom: 10px; }
.kpi-num { font-size: 32px; font-weight: 900; }
.kpi-bar {
  height: 2px;
  background: rgba(255,255,255,0.07);
  border-radius: 1px;
  overflow: hidden;
  margin-bottom: 6px;
}
.kpi-fill {
  height: 100%;
  border-radius: 1px;
  transition: width 0.8s ease;
  box-shadow: 0 0 6px currentColor;
}
.kpi-icon {
  position: absolute;
  top: 12px; left: 12px;
  font-size: 22px;
  opacity: 0.12;
}

/* ── School Table ── */
.school-table { padding: 8px 0; }
.school-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  border-bottom: 1px solid rgba(0,255,65,0.06);
  transition: background 0.15s;
  font-size: 13px;
  flex-wrap: wrap;
}
.school-row:last-child { border-bottom: none; }
.school-row:hover { background: rgba(0,255,65,0.03); }
.school-index { color: rgba(0,255,65,0.3); font-size: 10px; font-family: monospace; flex-shrink: 0; }
.school-name { flex: 1; color: #e2e8f0; font-weight: 600; min-width: 100px; }
.school-branch { color: rgba(255,255,255,0.4); font-size: 12px; }
.school-users, .school-status { flex-shrink: 0; }

/* ── Activity Feed ── */
.activity-feed { padding: 8px 0; font-size: 12px; }
.activity-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px;
  border-bottom: 1px solid rgba(0,255,65,0.05);
  font-family: 'Courier New', monospace;
}
.activity-time { color: rgba(0,255,65,0.4); width: 45px; flex-shrink: 0; font-size: 11px; }
.activity-type { font-size: 10px; padding: 1px 6px; border-radius: 3px; flex-shrink: 0; letter-spacing: 1px; }
.activity-type.ai   { background: rgba(139,92,246,0.15); color: #8b5cf6; border: 1px solid rgba(139,92,246,0.3); }
.activity-type.sys  { background: rgba(0,200,255,0.1); color: #00c8ff; border: 1px solid rgba(0,200,255,0.25); }
.activity-type.alert{ background: rgba(239,68,68,0.1); color: #f87171; border: 1px solid rgba(239,68,68,0.3); animation: blink-warn 1.5s infinite; }
.activity-msg { color: rgba(255,255,255,0.5); flex: 1; }
.empty-feed { padding: 20px 16px; color: rgba(0,255,65,0.3); font-size: 12px; letter-spacing: 1px; }

/* ── Scanning Animation ── */
.scanning-anim {
  position: relative;
  padding: 40px 20px;
  overflow: hidden;
  text-align: center;
}
.scan-line {
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, #00ff41, transparent);
  animation: scan-sweep 2s linear infinite;
  box-shadow: 0 0 12px #00ff41;
}
@keyframes scan-sweep {
  0% { top: 0; }
  100% { top: 100%; }
}
.scan-text {
  color: rgba(0,255,65,0.5);
  font-size: 12px;
  letter-spacing: 2px;
  animation: text-blink 0.8s ease-in-out infinite;
}
@keyframes text-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.scan-prompt {
  text-align: center;
  padding: 40px 20px;
  color: rgba(0,255,65,0.3);
}
.scan-icon { font-size: 48px; margin-bottom: 12px; opacity: 0.4; }

/* ── Pulse Grid ── */
.pulse-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
  padding: 16px;
}
.pulse-metric {
  position: relative;
  text-align: center;
  padding: 20px 12px;
  background: rgba(0,15,25,0.8);
  border: 1px solid rgba(var(--pm), 0.15);
  border-radius: 10px;
  overflow: hidden;
  transition: all 0.25s;
}
.pulse-metric:hover {
  transform: translateY(-3px);
  border-color: var(--pm);
  box-shadow: 0 0 16px rgba(var(--pm), 0.15);
}
.pm-icon { font-size: 24px; margin-bottom: 8px; }
.pm-value { font-size: 28px; font-weight: 900; margin-bottom: 4px; }
.pm-label { font-size: 10px; color: rgba(255,255,255,0.4); letter-spacing: 1px; }
.pm-glow {
  position: absolute;
  bottom: 0; left: 0; right: 0; height: 1px;
  background: var(--pm);
  box-shadow: 0 0 8px var(--pm);
}

.health-bar-section {
  padding: 16px 20px;
  border-top: 1px solid rgba(0,255,65,0.1);
  display: flex;
  align-items: center;
  gap: 16px;
}
.hbs-label { font-size: 10px; color: rgba(255,255,255,0.4); letter-spacing: 1px; flex-shrink: 0; }
.hbs-track { flex: 1; height: 6px; background: rgba(255,255,255,0.07); border-radius: 3px; overflow: hidden; }
.hbs-fill { height: 100%; border-radius: 3px; transition: width 1s ease; box-shadow: 0 0 8px currentColor; }
.hbs-value { font-size: 20px; font-weight: 900; color: #fbbf24; flex-shrink: 0; }

/* ── Cost Grid ── */
.cost-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  padding: 16px;
}
.cost-card {
  background: rgba(0,15,25,0.8);
  border: 1px solid rgba(0,255,65,0.1);
  border-radius: 10px;
  padding: 16px;
  transition: all 0.2s;
}
.cost-card:hover { border-color: rgba(0,255,65,0.25); transform: translateY(-2px); }
.cost-label { font-size: 10px; color: rgba(255,255,255,0.35); letter-spacing: 1.5px; margin-bottom: 8px; }
.cost-value { font-size: 28px; font-weight: 900; }
.cost-value.blue { color: #00c8ff; }
.cost-value.green { color: #00ff41; }
.cost-value.amber { color: #fbbf24; }

.cost-insight {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0 16px 16px;
  padding: 12px 16px;
  background: rgba(0,255,65,0.04);
  border: 1px solid rgba(0,255,65,0.1);
  border-radius: 8px;
  font-size: 12px;
  color: rgba(255,255,255,0.5);
}
.ci-icon { font-size: 20px; flex-shrink: 0; }

/* ── Threat Matrix ── */
.all-clear {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 24px 20px;
  color: #00ff41;
  font-size: 13px;
  letter-spacing: 1px;
}
.threat-matrix { padding: 8px; display: flex; flex-direction: column; gap: 8px; }
.threat-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 8px;
  border: 1px solid transparent;
  flex-wrap: wrap;
  transition: all 0.2s;
}
.threat-row.high { background: rgba(239,68,68,0.06); border-color: rgba(239,68,68,0.2); }
.threat-row.medium { background: rgba(251,191,36,0.06); border-color: rgba(251,191,36,0.2); }
.threat-level-indicator {
  font-size: 11px; padding: 3px 8px; border-radius: 4px;
  font-weight: 700; letter-spacing: 1px; flex-shrink: 0;
}
.threat-level-indicator.high { background: rgba(239,68,68,0.15); color: #f87171; }
.threat-level-indicator.medium { background: rgba(251,191,36,0.15); color: #fbbf24; }
.threat-name { flex: 1; color: #e2e8f0; font-weight: 600; min-width: 100px; }
.threat-stats { display: flex; gap: 12px; font-size: 12px; color: rgba(255,255,255,0.5); flex-shrink: 0; }
.threat-bar-wrap { width: 80px; height: 4px; background: rgba(255,255,255,0.07); border-radius: 2px; overflow: hidden; flex-shrink: 0; }
.threat-fill { height: 100%; border-radius: 2px; transition: width 0.8s ease; }

/* ── Broadcast Form ── */
.broadcast-form { padding: 20px; display: flex; flex-direction: column; gap: 14px; }
.bf-field { display: flex; flex-direction: column; gap: 6px; }
.bf-label { font-size: 10px; color: rgba(0,255,65,0.5); letter-spacing: 2px; }
.bf-actions { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
.bf-hint { font-size: 11px; color: rgba(255,255,255,0.3); }
.bc-confirm {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 14px;
  background: rgba(0,255,65,0.08);
  border: 1px solid rgba(0,255,65,0.2);
  border-radius: 8px;
  color: #00ff41;
  font-size: 13px;
}

/* ── Reports ── */
.reports-list { padding: 12px; display: flex; flex-direction: column; gap: 10px; }
.report-card {
  background: rgba(0,15,25,0.8);
  border: 1px solid rgba(0,255,65,0.1);
  border-radius: 10px;
  padding: 14px;
  transition: all 0.2s;
}
.report-card:hover { border-color: rgba(0,255,65,0.2); }
.report-card.resolved { opacity: 0.7; }
.report-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}
.report-type { font-size: 10px; letter-spacing: 1px; font-weight: 700; }
.report-meta { font-size: 11px; color: rgba(255,255,255,0.35); }
.report-status { font-size: 10px; letter-spacing: 0.5px; padding: 2px 7px; border-radius: 4px; }
.report-status.pending { background: rgba(251,191,36,0.1); color: #fbbf24; }
.report-status.reviewed { background: rgba(99,102,241,0.1); color: #818cf8; }
.report-status.resolved { background: rgba(0,255,65,0.1); color: #00ff41; }
.report-title { color: #e2e8f0; font-weight: 700; font-size: 14px; margin-bottom: 6px; }
.report-content { color: rgba(255,255,255,0.5); font-size: 13px; line-height: 1.5; margin-bottom: 8px; }
.report-response {
  display: flex; gap: 8px;
  padding: 8px 12px;
  background: rgba(99,102,241,0.06);
  border: 1px solid rgba(99,102,241,0.15);
  border-radius: 6px;
  font-size: 12px;
  color: rgba(255,255,255,0.5);
  margin-bottom: 8px;
}
.rr-label { color: rgba(0,255,65,0.5); flex-shrink: 0; letter-spacing: 1px; font-size: 10px; }
.respond-form { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; }

/* ── Agents Table ── */
.agents-table { overflow-x: auto; }
.agents-thead {
  display: grid;
  grid-template-columns: 60px 1fr 80px 1fr 100px 80px;
  gap: 8px;
  padding: 8px 16px;
  font-size: 9px;
  color: rgba(0,255,65,0.4);
  letter-spacing: 2px;
  border-bottom: 1px solid rgba(0,255,65,0.1);
}
.agent-row {
  display: grid;
  grid-template-columns: 60px 1fr 80px 1fr 100px 80px;
  gap: 8px;
  align-items: center;
  padding: 10px 16px;
  border-bottom: 1px solid rgba(0,255,65,0.05);
  font-size: 12px;
  transition: background 0.15s;
}
.agent-row:hover { background: rgba(0,255,65,0.03); }
.agent-index { color: rgba(0,255,65,0.3); font-family: monospace; font-size: 10px; }
.agent-name { color: #e2e8f0; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.agent-role { font-size: 10px; letter-spacing: 0.5px; font-weight: 700; padding: 2px 6px; border-radius: 4px; }
.agent-role.manager { color: #f87171; background: rgba(239,68,68,0.1); }
.agent-role.teacher { color: #818cf8; background: rgba(99,102,241,0.1); }
.agent-role.student { color: #00ff41; background: rgba(0,255,65,0.08); }
.agent-role.admin   { color: #fbbf24; background: rgba(251,191,36,0.1); }
.agent-role.owner   { color: #a855f7; background: rgba(168,85,247,0.1); }
.agent-school { color: rgba(255,255,255,0.4); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; }
.agent-status {
  display: flex; align-items: center; gap: 5px;
  font-size: 10px; letter-spacing: 1px;
}
.agent-status .status-dot { width: 5px; height: 5px; }
.agent-status.online { color: #00ff41; }
.agent-status.offline { color: #f87171; }
.agent-status.online .status-dot { background: #00ff41; box-shadow: 0 0 5px #00ff41; animation: blink-dot 2s infinite; }
.agent-status.offline .status-dot { background: #f87171; animation: none; }

/* ── Settings ── */
.settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
}
.profile-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
}
.profile-avatar-wrap {
  position: relative;
  width: 64px; height: 64px;
  cursor: pointer;
  flex-shrink: 0;
}
.profile-av-img, .profile-av-placeholder {
  width: 64px; height: 64px;
  border-radius: 50%;
  border: 2px solid rgba(0,255,65,0.3);
  object-fit: cover;
  display: flex; align-items: center; justify-content: center;
  font-size: 28px;
  background: linear-gradient(135deg, #a855f7, #00c8ff);
  box-shadow: 0 0 16px rgba(0,255,65,0.2);
}
.av-overlay {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: rgba(0,0,0,0.5);
  display: flex; align-items: center; justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
  font-size: 20px;
}
.profile-avatar-wrap:hover .av-overlay { opacity: 1; }
.profile-info { flex: 1; }
.pi-name { color: #e2e8f0; font-weight: 700; font-size: 15px; margin-bottom: 4px; }
.pi-email { color: rgba(255,255,255,0.4); font-size: 12px; margin-bottom: 4px; direction: ltr; }
.pi-role { color: #00ff41; font-size: 11px; letter-spacing: 1px; }

.theme-selector {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  padding: 12px 16px;
}
.theme-opt {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid rgba(0,255,65,0.1);
  background: rgba(0,15,25,0.8);
  color: rgba(255,255,255,0.5);
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
  font-family: inherit;
}
.theme-opt:hover { border-color: rgba(0,255,65,0.25); color: #fff; }
.theme-opt.active {
  border-color: #00ff41;
  background: rgba(0,255,65,0.08);
  color: #00ff41;
  box-shadow: 0 0 10px rgba(0,255,65,0.1);
}
.theme-icon { font-size: 16px; }
.theme-label { font-size: 11px; letter-spacing: 1px; }

.lang-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  padding: 12px 16px;
}
.lang-opt {
  padding: 9px 12px;
  border-radius: 8px;
  border: 1px solid rgba(0,255,65,0.1);
  background: rgba(0,15,25,0.8);
  color: rgba(255,255,255,0.5);
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
  font-family: inherit;
}
.lang-opt:hover { border-color: rgba(0,255,65,0.25); color: #fff; }
.lang-opt.active {
  border-color: #00ff41;
  background: rgba(0,255,65,0.08);
  color: #00ff41;
  box-shadow: 0 0 8px rgba(0,255,65,0.1);
}

.toggle-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  cursor: pointer;
}
.intel-toggle { position: relative; }
.toggle-cb { position: absolute; opacity: 0; width: 0; height: 0; }
.toggle-track {
  display: block;
  width: 44px; height: 24px;
  background: rgba(255,255,255,0.1);
  border: 1px solid rgba(0,255,65,0.2);
  border-radius: 12px;
  position: relative;
  transition: all 0.3s;
  cursor: pointer;
}
.toggle-cb:checked ~ .toggle-track {
  background: rgba(0,255,65,0.2);
  border-color: #00ff41;
  box-shadow: 0 0 8px rgba(0,255,65,0.3);
}
.toggle-thumb {
  position: absolute;
  top: 3px; right: 3px;
  width: 16px; height: 16px;
  background: rgba(255,255,255,0.3);
  border-radius: 50%;
  transition: all 0.3s;
}
.toggle-cb:checked ~ .toggle-track .toggle-thumb {
  right: auto; left: 3px;
  background: #00ff41;
  box-shadow: 0 0 6px #00ff41;
}
.toggle-label { font-size: 12px; letter-spacing: 1px; color: rgba(255,255,255,0.6); }

.avatar-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 12px 16px; }
.avatar-option { cursor: pointer; border-radius: 50%; padding: 4px; border: 3px solid transparent; transition: all 0.2s; display: flex; align-items: center; justify-content: center; }
.avatar-option:hover { border-color: #00ff41; transform: scale(1.1); }
.avatar-option.selected { border-color: #00ff41; box-shadow: 0 0 12px #00ff41; }

.settings-saved {
  text-align: center;
  padding: 10px;
  color: #00ff41;
  font-size: 12px;
  letter-spacing: 2px;
  animation: fade-in 0.3s ease;
}

/* ── Buttons ── */
.intel-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 18px;
  border-radius: 8px;
  border: 1px solid rgba(0,255,65,0.3);
  background: rgba(0,255,65,0.08);
  color: #00ff41;
  cursor: pointer;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 1px;
  transition: all 0.2s;
  font-family: inherit;
  white-space: nowrap;
}
.intel-btn:hover:not(:disabled) {
  background: rgba(0,255,65,0.15);
  border-color: #00ff41;
  box-shadow: 0 0 16px rgba(0,255,65,0.2);
  transform: translateY(-1px);
}
.intel-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.intel-btn.sm { padding: 6px 12px; font-size: 11px; }
.intel-btn.primary {
  background: linear-gradient(135deg, rgba(0,255,65,0.15), rgba(0,200,255,0.1));
  border-color: rgba(0,255,65,0.4);
  box-shadow: 0 0 12px rgba(0,255,65,0.1);
}
.intel-btn.primary:hover:not(:disabled) {
  background: linear-gradient(135deg, rgba(0,255,65,0.25), rgba(0,200,255,0.18));
  box-shadow: 0 0 24px rgba(0,255,65,0.25);
}
.intel-btn.ghost {
  border-color: rgba(255,255,255,0.15);
  background: transparent;
  color: rgba(255,255,255,0.5);
}
.intel-btn.ghost:hover:not(:disabled) {
  border-color: rgba(0,255,65,0.3);
  color: #00ff41;
  box-shadow: none;
}
.intel-btn.danger {
  border-color: rgba(239,68,68,0.3);
  background: rgba(239,68,68,0.06);
  color: #f87171;
}
.intel-btn.danger:hover:not(:disabled) {
  background: rgba(239,68,68,0.12);
  border-color: #f87171;
  box-shadow: 0 0 12px rgba(239,68,68,0.2);
}
.intel-btn.success {
  border-color: rgba(0,255,65,0.3);
  background: rgba(0,255,65,0.06);
  color: #00ff41;
}

/* Inputs */
.intel-input {
  background: rgba(0,15,25,0.8);
  border: 1px solid rgba(0,255,65,0.2);
  color: #e2e8f0;
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 13px;
  font-family: 'Courier New', 'Tajawal', monospace;
  text-align: right;
  transition: all 0.2s;
  width: 100%;
  box-sizing: border-box;
}
.intel-input:focus {
  outline: none;
  border-color: rgba(0,255,65,0.5);
  box-shadow: 0 0 12px rgba(0,255,65,0.1);
}
.intel-input.sm { padding: 6px 10px; font-size: 12px; }
.intel-input.ta { resize: vertical; }
select.intel-input { cursor: pointer; }

/* Mini badges */
.mini-badge {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 600;
  letter-spacing: 0.5px;
}
.mini-badge.green { background: rgba(0,255,65,0.1); color: #00ff41; border: 1px solid rgba(0,255,65,0.2); }
.mini-badge.amber { background: rgba(251,191,36,0.1); color: #fbbf24; border: 1px solid rgba(251,191,36,0.2); }
.mini-badge.blue  { background: rgba(0,200,255,0.1); color: #00c8ff; border: 1px solid rgba(0,200,255,0.2); }

/* Spin */
.spin-icon { display: inline-block; animation: spin 0.8s linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

/* Fade in */
@keyframes fade-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }

/* ── Mobile ── */
@media (max-width: 768px) {
  .mobile-toggle { display: flex; }
  .mobile-overlay { display: block; }
  .intel-sidebar {
    position: fixed; top: 0; right: 0; bottom: 0;
    z-index: 50;
    transform: translateX(100%);
    transition: transform 0.3s;
  }
  .intel-sidebar.open { transform: translateX(0); }
  .kpi-grid { grid-template-columns: repeat(2, 1fr); }
  .agents-thead, .agent-row { grid-template-columns: 50px 1fr 70px; }
  .agents-thead span:nth-child(n+4),
  .agent-row > *:nth-child(n+4) { display: none; }
}
</style>

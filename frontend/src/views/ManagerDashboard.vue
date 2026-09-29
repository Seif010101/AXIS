<template>
  <div class="hub-manager min-h-screen relative" :style="{ background: 'var(--bg1)' }">
    <Stars />
    <MatrixBackground />

    <div class="relative z-10">
      <!-- الهيدر -->
      <NavBar
        title="لوحة الإدارة"
        :name="auth.user?.full_name?.split(' ')?.[0] || 'مدير'"
        :avatar-url="mgrSettings.avatar_url || ''"
        :current-theme="mgrSettings.theme"
        :current-lang="lang"
        @theme="v => { mgrSettings.theme = v; saveMgrSettings() }"
        @lang="changeMgrLang"
      />

      <div class="max-w-7xl mx-auto p-3 md:p-6">
        <!-- التبويبات (تمرير أفقي على الموبايل) -->
        <div class="mgr-tabs flex gap-2 mb-4 md:mb-6 p-1 rounded-xl overflow-x-auto" style="-webkit-overflow-scrolling: touch">
          <button v-for="tab in tabs" :key="tab.id" @click="activeTab = tab.id"
                  class="flex-shrink-0 py-2 md:py-2.5 px-3 md:px-4 rounded-lg text-xs md:text-sm font-medium transition-all whitespace-nowrap flex items-center gap-1.5"
                  :style="activeTab === tab.id
                    ? { background: 'var(--btn-gradient)', color: 'var(--btn-text)' }
                    : { color: 'var(--t2)' }">
            <span v-html="tab.svg" style="display:inline-flex;align-items:center"></span> {{ tab.label }}
          </button>
        </div>

        <!-- ============ تبويب الإحصائيات ============ -->
        <div v-if="activeTab === 'stats'" class="animate-fade-in">
          <div class="flex items-center justify-between mb-6 flex-wrap gap-2">
            <h2 class="text-2xl font-bold gradient-text">{{ t('overview') || 'نظرة عامة شاملة' }}</h2>
            <button @click="loadStats" :disabled="statsLoading"
                    class="text-xs px-3 py-1.5 rounded-lg flex items-center gap-1"
                    style="background: rgba(74,126,255,0.15); color: #4a7eff; border: 1px solid rgba(74,126,255,0.3)">
              <span v-if="statsLoading" class="inline-block w-3 h-3 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin"/>
              🔄 تحديث
            </button>
          </div>

          <!-- skeleton -->
          <div v-if="statsLoading" class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div v-for="i in 8" :key="i" class="skeleton h-28 rounded-xl" />
          </div>

          <template v-else-if="stats">

            <!-- ====== بطاقات المستخدمين ====== -->
            <h3 class="text-sm font-semibold mb-3 mgr-muted uppercase tracking-wider">👥 المستخدمون</h3>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div v-for="stat in statCards" :key="stat.label" class="memorix-card p-5 text-center stat-glow-card">
                <div class="text-3xl mb-1">{{ stat.icon }}</div>
                <div class="text-3xl font-black" :style="`color: ${stat.color}`">{{ stat.value ?? '—' }}</div>
                <div class="text-xs mt-1 mgr-muted">{{ stat.label }}</div>
              </div>
            </div>

            <!-- ====== نشاط المنصة ====== -->
            <h3 class="text-sm font-semibold mb-3 mgr-muted uppercase tracking-wider">🔥 النشاط</h3>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div class="memorix-card p-5 text-center stat-glow-card" style="--glow-c: rgba(16,185,129,.3)">
                <div class="text-3xl mb-1">🟢</div>
                <div class="text-3xl font-black" style="color:#10b981">{{ stats.active_users_week ?? 0 }}</div>
                <div class="text-xs mt-1 mgr-muted">نشطون هذا الأسبوع</div>
              </div>
              <div class="memorix-card p-5 text-center stat-glow-card" style="--glow-c: rgba(16,185,129,.3)">
                <div class="text-3xl mb-1">🆕</div>
                <div class="text-3xl font-black" style="color:#10b981">{{ stats.new_users_month ?? 0 }}</div>
                <div class="text-xs mt-1 mgr-muted">مستخدمون جدد (30 يوم)</div>
              </div>
              <div class="memorix-card p-5 text-center stat-glow-card" style="--glow-c: rgba(251,191,36,.3)">
                <div class="text-3xl mb-1">🔐</div>
                <div class="text-3xl font-black" style="color:#fbbf24">{{ stats.logins_week ?? 0 }}</div>
                <div class="text-xs mt-1 mgr-muted">دخول هذا الأسبوع</div>
              </div>
              <div class="memorix-card p-5 text-center stat-glow-card" style="--glow-c: rgba(251,191,36,.3)">
                <div class="text-3xl mb-1">📅</div>
                <div class="text-3xl font-black" style="color:#fbbf24">{{ stats.logins_month ?? 0 }}</div>
                <div class="text-xs mt-1 mgr-muted">دخول هذا الشهر</div>
              </div>
            </div>

            <!-- ====== الذكاء الاصطناعي ====== -->
            <h3 class="text-sm font-semibold mb-3 mgr-muted uppercase tracking-wider">🤖 الذكاء الاصطناعي</h3>
            <div class="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
              <div class="memorix-card p-5 text-center stat-glow-card" style="--glow-c: rgba(139,92,246,.3)">
                <div class="text-3xl mb-1">💬</div>
                <div class="text-3xl font-black" style="color:#8b5cf6">{{ stats.total_conversations ?? 0 }}</div>
                <div class="text-xs mt-1 mgr-muted">محادثات</div>
              </div>
              <div class="memorix-card p-5 text-center stat-glow-card" style="--glow-c: rgba(139,92,246,.3)">
                <div class="text-3xl mb-1">📝</div>
                <div class="text-3xl font-black" style="color:#8b5cf6">{{ stats.total_ai_messages ?? 0 }}</div>
                <div class="text-xs mt-1 mgr-muted">رسائل AI</div>
              </div>
              <div class="memorix-card p-5 text-center stat-glow-card" style="--glow-c: rgba(139,92,246,.3)">
                <div class="text-3xl mb-1">📚</div>
                <div class="text-3xl font-black" style="color:#8b5cf6">{{ stats.total_books ?? 0 }}</div>
                <div class="text-xs mt-1 mgr-muted">كتب/مصادر</div>
              </div>
            </div>

            <!-- ====== الأكاديمي ====== -->
            <h3 class="text-sm font-semibold mb-3 mgr-muted uppercase tracking-wider">🎓 الأكاديمي</h3>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div class="memorix-card p-5 text-center stat-glow-card" style="--glow-c: rgba(0,212,255,.3)">
                <div class="text-3xl mb-1">📋</div>
                <div class="text-3xl font-black" style="color:#00d4ff">{{ stats.total_homework ?? 0 }}</div>
                <div class="text-xs mt-1 mgr-muted">واجبات</div>
              </div>
              <div class="memorix-card p-5 text-center stat-glow-card" style="--glow-c: rgba(0,212,255,.3)">
                <div class="text-3xl mb-1">✅</div>
                <div class="text-3xl font-black" style="color:#00d4ff">{{ stats.homework_submissions ?? 0 }}</div>
                <div class="text-xs mt-1 mgr-muted">تسليمات واجبات</div>
              </div>
              <div class="memorix-card p-5 text-center stat-glow-card" style="--glow-c: rgba(74,126,255,.3)">
                <div class="text-3xl mb-1">📝</div>
                <div class="text-3xl font-black" style="color:#4a7eff">{{ stats.total_tests ?? 0 }}</div>
                <div class="text-xs mt-1 mgr-muted">اختبارات</div>
              </div>
              <div class="memorix-card p-5 text-center stat-glow-card" style="--glow-c: rgba(74,126,255,.3)">
                <div class="text-3xl mb-1">🏆</div>
                <div class="text-3xl font-black" style="color:#4a7eff">
                  {{ stats.avg_test_score != null ? stats.avg_test_score + '%' : '—' }}
                </div>
                <div class="text-xs mt-1 mgr-muted">متوسط نتائج الاختبارات</div>
              </div>
              <div class="memorix-card p-5 text-center stat-glow-card" style="--glow-c: rgba(245,158,11,.3)">
                <div class="text-3xl mb-1">📄</div>
                <div class="text-3xl font-black" style="color:#f59e0b">{{ stats.total_worksheets ?? 0 }}</div>
                <div class="text-xs mt-1 mgr-muted">أوراق عمل</div>
              </div>
              <div class="memorix-card p-5 text-center stat-glow-card" style="--glow-c: rgba(245,158,11,.3)">
                <div class="text-3xl mb-1">🎮</div>
                <div class="text-3xl font-black" style="color:#f59e0b">{{ stats.games_played ?? 0 }}</div>
                <div class="text-xs mt-1 mgr-muted">ألعاب تعليمية</div>
              </div>
              <div class="memorix-card p-5 text-center stat-glow-card" style="--glow-c: rgba(245,158,11,.3)">
                <div class="text-3xl mb-1">⏱️</div>
                <div class="text-3xl font-black" style="color:#f59e0b">{{ stats.focus_sessions ?? 0 }}</div>
                <div class="text-xs mt-1 mgr-muted">جلسات تركيز</div>
              </div>
              <div class="memorix-card p-5 text-center stat-glow-card" style="--glow-c: rgba(16,185,129,.3)">
                <div class="text-3xl mb-1">🏅</div>
                <div class="text-3xl font-black" style="color:#10b981">{{ stats.badges_earned ?? 0 }}</div>
                <div class="text-xs mt-1 mgr-muted">شارات مكتسبة</div>
              </div>
            </div>

            <!-- ====== ثلاثة بطاقات ثانوية ====== -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">

              <!-- أساليب التعلم -->
              <div class="memorix-card p-6">
                <h3 class="font-bold mb-4" style="color: #00d4ff">🧠 أساليب التعلم</h3>
                <div class="space-y-3">
                  <div v-for="style in learningStyleCards" :key="style.key" class="flex items-center gap-3">
                    <span class="text-xl">{{ style.icon }}</span>
                    <div class="flex-1">
                      <div class="flex justify-between text-xs mb-1">
                        <span>{{ style.label }}</span>
                        <span :style="`color:${style.color}`">{{ stats.learning_styles[style.key] || 0 }}</span>
                      </div>
                      <div class="h-2 rounded-full overflow-hidden" style="background: rgba(255,255,255,0.07)">
                        <div class="h-full rounded-full transition-all duration-700"
                             :style="`width:${learningStylePct(style.key)}%; background: ${style.color}`" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- توزيع الصفوف -->
              <div class="memorix-card p-6">
                <h3 class="font-bold mb-4" style="color: #f59e0b">🏫 توزيع الصفوف</h3>
                <div v-if="gradesList.length" class="space-y-2 max-h-52 overflow-y-auto">
                  <div v-for="[grade, count] in gradesList" :key="grade" class="flex items-center justify-between text-sm">
                    <span class="mgr-muted truncate max-w-[120px]">{{ grade }}</span>
                    <span class="font-bold" style="color:#f59e0b">{{ count }}</span>
                  </div>
                </div>
                <p v-else class="mgr-muted text-xs">لا توجد بيانات صفوف</p>
              </div>

              <!-- الشكاوى والتنبيهات -->
              <div class="memorix-card p-6">
                <h3 class="font-bold mb-4" style="color: #ef4444">🚨 التنبيهات</h3>
                <div class="space-y-3">
                  <div class="flex items-center justify-between p-3 rounded-xl" style="background: rgba(239,68,68,0.1)">
                    <span class="text-sm">📮 شكاوى مسجّلة</span>
                    <span class="font-black text-lg" style="color:#ef4444">{{ stats.complaints_count ?? 0 }}</span>
                  </div>
                  <div class="flex items-center justify-between p-3 rounded-xl" style="background: rgba(251,191,36,0.1)">
                    <span class="text-sm">📄 نتائج اختبارات</span>
                    <span class="font-black text-lg" style="color:#fbbf24">{{ stats.test_results ?? 0 }}</span>
                  </div>
                  <div v-if="stats.avg_test_score != null"
                       class="flex items-center justify-between p-3 rounded-xl"
                       :style="`background: ${stats.avg_test_score >= 70 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'}`">
                    <span class="text-sm">📊 مستوى المنصة</span>
                    <span class="font-black text-lg"
                          :style="`color:${stats.avg_test_score >= 70 ? '#10b981' : '#ef4444'}`">
                      {{ stats.avg_test_score >= 70 ? '✅ جيد' : '⚠️ يحتاج متابعة' }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

          </template>

          <div v-else class="memorix-card p-12 text-center mgr-muted">
            <div class="text-5xl mb-3">📊</div>
            <p>لا توجد إحصائيات بعد. اضغط تحديث للتحميل.</p>
          </div>
        </div>

        <!-- ============ تبويب إعداد المدرسة ============ -->
        <!-- ============ 🏫 المدارس (إضافة + قائمة) ============ -->
        <div v-if="activeTab === 'schools'" class="animate-fade-in">
          <h2 class="text-2xl font-bold mb-6 gradient-text">{{ t('schools') }}</h2>

          <!-- إضافة مدرسة جديدة -->
          <div class="memorix-card p-6 mb-6">
            <h3 class="font-bold mb-4" style="color: #4a7eff">➕ إضافة مدرسة جديدة</h3>
            <div class="grid md:grid-cols-3 gap-4 mb-4">
              <input v-model="newSchool.name" class="memorix-input" placeholder="اسم المدرسة" dir="rtl" />
              <input v-model="newSchool.branch" class="memorix-input" placeholder="الفرع (اختياري)" dir="rtl" />
              <input v-model="newSchool.ministry_code" class="memorix-input" placeholder="كود الوزارة (اختياري)" dir="rtl" />
            </div>
            <button @click="createNewSchool" :disabled="newSchoolLoading || !newSchool.name.trim()"
                    class="btn-primary text-sm flex items-center gap-2">
              <span v-if="newSchoolLoading" class="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              💾 {{ t('save') }}
            </button>
            <p v-if="newSchoolMsg" class="mt-3 text-sm" :style="{color: newSchoolMsg.startsWith('✅')?'#10b981':'#ef4444'}">{{ newSchoolMsg }}</p>

            <!-- أو رفع ملف Excel: مدرسة + صفوف + شُعب -->
            <div class="mt-5 pt-5 mgr-section-divider" style="border-top-width:1px;border-top-style:solid">
              <h4 class="font-bold text-sm mb-2" style="color:#a78bfa">📤 أو ارفع ملف Excel (مدرسة + صفوفها وشُعبها)</h4>
              <p class="text-xs mb-3 mgr-muted">
                الأعمدة: <b>اسم المدرسة | الفرع (اختياري) | الرقم الوزاري (اختياري) | الصف | الشعبة</b>.
                كل سطر = شعبة واحدة. كرّر اسم المدرسة في سطر لكل شعبة. تقدر تضيف أكثر من مدرسة في نفس الملف.
              </p>
              <input ref="schoolExcelInput" type="file" accept=".xlsx,.xls" @change="onSchoolExcelChange" class="memorix-input" />
              <button @click="uploadSchoolsExcelFile" :disabled="!schoolExcelFile || schoolExcelLoading"
                      class="btn-primary text-sm mt-3 flex items-center gap-2">
                <span v-if="schoolExcelLoading" class="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ⚡ ارفع وأنشئ المدارس
              </button>
              <p v-if="schoolExcelMsg" class="mt-2 text-sm" :style="{color: schoolExcelMsg.startsWith('✅')?'#10b981':'#ef4444'}">{{ schoolExcelMsg }}</p>
            </div>
          </div>

          <!-- قائمة المدارس -->
          <div class="memorix-card overflow-hidden">
            <div class="p-4 mgr-section-divider" style="border-bottom-width:1px;border-bottom-style:solid">
              <h3 class="font-bold">📋 المدارس المسجلة ({{ schools.length }})</h3>
            </div>
            <div v-if="!schools.length" class="p-8 text-center mgr-muted">{{ t('no_schools_yet') }}</div>
            <table v-else class="w-full text-sm">
              <thead>
                <tr class="mgr-row-head">
                  <th class="p-3 text-right mgr-th">الاسم</th>
                  <th class="p-3 text-right mgr-th">الحالة</th>
                  <th class="p-3 text-right mgr-th">{{ t('actions_label') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="s in schools" :key="s.id" class="border-t mgr-border">
                  <td class="p-3 font-medium">{{ s.name }}</td>
                  <td class="p-3">
                    <span v-if="s.setup_completed" class="text-xs px-2 py-1 rounded-full" style="background: rgba(16,185,129,0.15); color: #10b981">✅ {{ t('configured') }}</span>
                    <span v-else class="text-xs px-2 py-1 rounded-full" style="background: rgba(251,191,36,0.15); color: #fbbf24">⏳ {{ t('awaiting_setup') }}</span>
                  </td>
                  <td class="p-3 flex gap-2">
                    <button @click="goToSetup(s.id)" class="text-xs px-3 py-1 rounded" style="background: rgba(74,126,255,0.15); color: #4a7eff">📤 {{ t('upload_excel') }}</button>
                    <button @click="confirmDeleteSchool(s)" class="text-xs px-3 py-1 rounded" style="background: rgba(239,68,68,0.15); color: #ef4444">🗑️ {{ t('delete_btn') }}</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- ============ 📤 إعداد + رفع Excel ============ -->
        <div v-if="activeTab === 'setup'" class="animate-fade-in">
          <h2 class="text-2xl font-bold mb-6 gradient-text">{{ t('upload_excel') }}</h2>

          <!-- اختيار المدرسة -->
          <div class="memorix-card p-6 mb-6">
            <label class="block text-sm font-medium mb-2 mgr-muted">اختر المدرسة</label>
            <select v-model="selectedSchool" class="memorix-input" style="direction: rtl">
              <option value="">-- اختر مدرسة --</option>
              <option v-for="s in schools" :key="s.id" :value="s.id">{{ s.name }}</option>
            </select>
            <p v-if="!schools.length" class="text-xs mt-2" style="color: #fbbf24">⚠️ لا توجد مدارس — أضف مدرسة أولاً من تبويب "المدارس"</p>
          </div>

          <!-- شرح ملف Excel -->
          <div v-if="selectedSchool" class="memorix-card p-6 mb-6" style="border:1px solid rgba(74,126,255,.3)">
            <h3 class="font-bold mb-3" style="color:#4a7eff">📋 صيغة ملف Excel المتوقعة</h3>
            <p class="text-xs mb-3" style="color:#94a3b8">يجب أن يحتوي الملف على هذه الأعمدة (الترتيب غير مهم):</p>
            <table class="w-full text-xs mgr-textarea" style="border-radius:8px">
              <thead>
                <tr style="background:rgba(99,102,241,.15)">
                  <th class="p-2">الاسم</th>
                  <th class="p-2">الدور</th>
                  <th class="p-2">الصف</th>
                  <th class="p-2">الشعبة</th>
                  <th class="p-2">المادة</th>
                  <th class="p-2">الرقم الوزاري</th>
                </tr>
              </thead>
              <tbody>
                <tr><td class="p-2">محمد أحمد</td><td class="p-2">طالب</td><td class="p-2">الصف الخامس</td><td class="p-2">أ</td><td class="p-2">-</td><td class="p-2">12345</td></tr>
                <tr><td class="p-2">سارة علي</td><td class="p-2">معلم</td><td class="p-2">الصف الخامس</td><td class="p-2">أ</td><td class="p-2">رياضيات</td><td class="p-2">T001</td></tr>
                <tr><td class="p-2">سارة علي</td><td class="p-2">معلم</td><td class="p-2">الصف الخامس</td><td class="p-2">ب</td><td class="p-2">رياضيات</td><td class="p-2">T001</td></tr>
                <tr><td class="p-2">خالد سعد</td><td class="p-2">إداري</td><td class="p-2">-</td><td class="p-2">-</td><td class="p-2">-</td><td class="p-2">A01</td></tr>
              </tbody>
            </table>
            <p class="text-xs mt-3" style="color:#10b981">✅ يقبل: طالب/معلم/إداري أو student/teacher/admin</p>
            <p class="text-xs mt-2" style="color:#fbbf24">💡 الطالب: اكتب صفّه وشعبته. المعلم: اكتب الصف والشعبة والمادة اللي بيدرّسها — ولو بيدرّس أكثر من شعبة كرّر اسمه في سطر لكل شعبة (بنفس الرقم الوزاري).</p>
          </div>

          <!-- رفع الملف -->
          <div v-if="selectedSchool" class="memorix-card p-6">
            <h3 class="font-bold mb-4" style="color:#a78bfa">📤 ارفع ملف Excel</h3>
            <input ref="excelInput" type="file" accept=".xlsx,.xls" @change="onExcelChange" class="memorix-input" />
            <p v-if="excelFileName" class="mt-3 text-sm" style="color:#10b981">📄 الملف المختار: {{ excelFileName }}</p>
            <button @click="uploadExcel" :disabled="!excelFile || uploadLoading"
                    class="btn-primary mt-4 flex items-center gap-2">
              <span v-if="uploadLoading" class="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ⚡ ارفع وولّد الحسابات
            </button>
            <div v-if="uploadResult" class="mt-4 p-4 rounded-lg" style="background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3)">
              <h4 class="font-bold mb-2" style="color:#10b981">✅ تم بنجاح!</h4>
              <p class="mgr-muted">المدرسة: {{ uploadResult.school_name }}</p>
              <p class="mgr-muted">إجمالي الحسابات المولدة: {{ uploadResult.total }}</p>
              <p class="mgr-muted">طلاب: {{ uploadResult.students_count }} • معلمون: {{ uploadResult.teachers_count }} • إداريون: {{ uploadResult.admins_count }}</p>
              <p class="mt-2 text-sm" style="color:#fbbf24">📋 الحسابات وكلمات السر متاحة الآن في تبويب "الحسابات"</p>
            </div>
          </div>
        </div>

        <!-- ============ تبويب الحسابات ============ -->
        <div v-if="activeTab === 'accounts'" class="animate-fade-in">
          <div class="flex items-center justify-between mb-6">
            <h2 class="text-2xl font-bold gradient-text">{{ t('accounts') }}</h2>
            <button v-if="accounts.length && selectedSchoolForAccounts"
                    @click="downloadCSV"
                    class="btn-primary text-sm py-2 flex items-center gap-2">
              📥 {{ t('download_csv') }}
            </button>
          </div>

          <!-- اختيار المدرسة -->
          <div class="memorix-card p-4 mb-6 flex items-center gap-4">
            <label class="text-sm mgr-muted">المدرسة:</label>
            <select v-model="selectedSchoolForAccounts" @change="loadAccounts" class="memorix-input w-64" style="direction: rtl">
              <option value="">-- اختر مدرسة --</option>
              <option v-for="s in schools" :key="s.id" :value="s.id">{{ s.name }}</option>
            </select>
          </div>

          <!-- جدول الحسابات -->
          <div v-if="accountsLoading" class="space-y-2">
            <div v-for="i in 5" :key="i" class="skeleton h-12 rounded-lg" />
          </div>

          <div v-else-if="accounts.length" class="memorix-card overflow-hidden">
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="mgr-row-head">
                    <th class="p-3 text-right mgr-th">الاسم</th>
                    <th class="p-3 text-right mgr-th">الإيميل</th>
                    <th class="p-3 text-right mgr-th">الدور</th>
                    <th class="p-3 text-right mgr-th">الصف</th>
                    <th class="p-3 text-right mgr-th">الشعبة</th>
                    <th class="p-3 text-right mgr-th">المادة</th>
                    <th class="p-3 text-right mgr-th">كلمة السر</th>
                    <th class="p-3 text-right mgr-th">{{ t('actions_label') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="acc in accounts" :key="acc.id"
                      class="border-t mgr-border transition-colors hover:bg-white/5">
                    <td class="p-3">{{ acc.full_name }}</td>
                    <td class="p-3 font-mono text-xs" style="color: #4a7eff; direction: ltr">{{ acc.email }}</td>
                    <td class="p-3">
                      <span class="px-2 py-1 rounded-full text-xs"
                            :style="roleStyle(acc.role)">
                        {{ roleLabel(acc.role) }}
                      </span>
                    </td>
                    <td class="p-3 mgr-td-muted">{{ acc.grade || '-' }}</td>
                    <td class="p-3 mgr-td-muted">{{ acc.section || '-' }}</td>
                    <td class="p-3 mgr-td-muted">{{ acc.subject || '-' }}</td>
                    <td class="p-3">
                      <button v-if="!revealedPasswords[acc.id]"
                              @click="revealPassword(acc.id)"
                              :disabled="revealLoading[acc.id]"
                              class="text-xs px-3 py-1 rounded"
                              style="background:rgba(139,92,246,0.15);color:#a78bfa">
                        {{ revealLoading[acc.id] ? '⏳' : '🔑 عرض' }}
                      </button>
                      <span v-else class="font-mono px-2 py-1 rounded text-xs cursor-pointer"
                            @click="copyToClipboard(revealedPasswords[acc.id])"
                            style="background:rgba(139,92,246,0.15);color:#a78bfa;letter-spacing:1px"
                            title="انقر للنسخ">
                        {{ revealedPasswords[acc.id] }}
                      </span>
                    </td>
                    <td class="p-3" style="display:flex;gap:6px;flex-wrap:wrap">
                      <button @click="resetPassword(acc.id)"
                              class="text-xs px-3 py-1 rounded"
                              style="background:rgba(251,191,36,0.15);color:#fbbf24">
                        🔄 إعادة تعيين
                      </button>
                      <button @click="confirmDeleteAccount(acc)"
                              class="text-xs px-3 py-1 rounded"
                              style="background:rgba(239,68,68,0.15);color:#ef4444">
                        🗑️ حذف
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="p-3 text-center text-sm mgr-muted mgr-section-divider" style="border-top-width:1px;border-top-style:solid">
              إجمالي: {{ accounts.length }} حساب
            </div>
          </div>

          <div v-else-if="selectedSchoolForAccounts" class="memorix-card p-12 text-center mgr-muted">
            {{ t('no_accounts_yet') }}
          </div>
        </div>

        <!-- ============ تبويب الكتب ============ -->
        <div v-if="activeTab === 'books'" class="animate-fade-in">
          <h2 class="text-2xl font-bold mb-6 gradient-text">{{ t('books') }}</h2>

          <!-- إضافة كتاب -->
          <div class="memorix-card p-6 mb-6">
            <h3 class="font-bold mb-4" style="color: #00d4ff">➕ إضافة كتاب جديد</h3>

            <!-- معلومات الكتاب -->
            <div class="grid md:grid-cols-3 gap-4 mb-4">
              <input v-model="newBook.title" class="memorix-input" :placeholder="t('book_title_ph')" dir="rtl" />
              <select v-model="newBook.subject" class="memorix-input" dir="rtl">
                <option value="" disabled>{{ t('select_subject') }}</option>
                <option v-for="s in subjectOptions" :key="s.value" :value="s.value">{{ s.label }}</option>
              </select>
              <select v-model="newBook.grade" class="memorix-input" dir="rtl">
                <option value="" disabled>{{ t('select_grade') }}</option>
                <option v-for="g in gradeOptions" :key="g.value" :value="g.value">{{ g.label }}</option>
              </select>
            </div>

            <!-- رفع ملف الكتاب (PDF أو PowerPoint) -->
            <div class="mb-4">
              <p class="text-xs mb-2" style="color:#94a3b8">
                📎 ارفع الكتاب كملف لتوليد الملخص تلقائياً بالذكاء الاصطناعي
              </p>
              <input ref="bookFileInput" type="file"
                     accept=".pdf,.pptx,.txt,.md"
                     @change="onBookFileChange" style="display:none" />

              <!-- منطقة الرفع -->
              <div @click="$refs.bookFileInput?.click()" @dragover.prevent @drop.prevent="onBookFileDrop"
                   style="cursor:pointer;border:2px dashed rgba(0,212,255,0.35);border-radius:12px;padding:24px;text-align:center;transition:all .2s;background:rgba(0,212,255,0.03)"
                   :style="bookFileName ? 'border-color:#10b981;background:rgba(16,185,129,0.05)' : ''">

                <!-- حالة: لا يوجد ملف -->
                <div v-if="!bookFileName && !bookExtractLoading">
                  <div style="font-size:36px;margin-bottom:8px">📄</div>
                  <p style="color:#00d4ff;font-weight:600;margin-bottom:4px">اسحب الملف هنا أو اضغط للاختيار</p>
                  <p style="color:#94a3b8;font-size:12px">PDF · PowerPoint (PPTX) · TXT</p>
                </div>

                <!-- حالة: يتم الرفع والمعالجة -->
                <div v-else-if="bookExtractLoading" style="color:#fbbf24">
                  <div style="font-size:32px;margin-bottom:8px">⏳</div>
                  <p style="font-weight:600">جاري رفع الملف ومعالجته...</p>
                </div>

                <!-- حالة: تم الرفع بنجاح -->
                <div v-else-if="bookFilePath && !bookExtractLoading">
                  <div style="font-size:32px;margin-bottom:8px">✅</div>
                  <p style="color:#10b981;font-weight:700">{{ bookFileName }}</p>
                  <p style="color:#94a3b8;font-size:12px;margin-top:4px">
                    تم رفع الملف وحفظه بنجاح ✓<span v-if="bookFileText"> — سيُولَّد ملخص بالـ AI عند الإضافة</span>
                  </p>
                  <button @click.stop="clearBookFile" style="margin-top:8px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);color:#ef4444;border-radius:8px;padding:4px 12px;font-size:12px;cursor:pointer">
                    🗑️ إزالة الملف
                  </button>
                </div>

                <!-- حالة: خطأ في الاستخراج -->
                <div v-else-if="bookExtractError">
                  <div style="font-size:32px;margin-bottom:8px">⚠️</div>
                  <p style="color:#ef4444;font-weight:600">{{ bookExtractError }}</p>
                  <p style="color:#94a3b8;font-size:12px;margin-top:4px">اضغط للمحاولة مرة أخرى</p>
                </div>
              </div>
            </div>

            <!-- زر الإضافة -->
            <button @click="addBook" class="btn-primary text-sm flex items-center gap-2"
                    :disabled="bookLoading || bookExtractLoading || !newBook.title || !newBook.subject">
              <span v-if="bookLoading" class="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              📖 {{ bookLoading ? (bookFileText ? '⏳ يُوَلِّد الملخص بالـ AI...' : '⏳ جاري الإضافة...') : t('add_book') }}
            </button>
            <p class="text-xs mt-2" style="color:#94a3b8">
              💡 يمكن إضافة الكتاب بدون ملف — الملخص سيُولَّد لاحقاً عند رفع الملف
            </p>
          </div>

          <!-- قائمة الكتب -->
          <div v-if="!books.length" class="memorix-card p-8 text-center" style="color:#94a3b8">
            {{ t('no_books_yet') }}
          </div>
          <div v-else class="grid md:grid-cols-2 gap-4">
            <div v-for="book in books" :key="book.id" class="memorix-card p-5">
              <div class="flex items-start justify-between mb-2">
                <h4 class="font-bold">{{ book.title }}</h4>
                <span class="text-xs px-2 py-1 rounded-full" style="background: rgba(74,126,255,0.15); color: #4a7eff">
                  {{ book.grade || t('not_specified') }}
                </span>
              </div>
              <p class="text-xs mb-3" style="color: #8b5cf6">📚 {{ book.subject }}</p>
              <p class="text-sm line-clamp-3" style="color: #94a3b8; line-height:1.7">
                {{ book.summary || '⏳ لم يُولَّد الملخص بعد — ارفع ملف الكتاب لتوليده' }}
              </p>
              <div class="flex items-center gap-3 mt-3">
                <a v-if="book.file_url" :href="book.file_url" target="_blank" rel="noopener"
                   style="color:#10b981;font-size:13px;font-weight:700;text-decoration:none">📥 تحميل / عرض الكتاب</a>
                <span v-else style="color:#64748b;font-size:12px">📄 بدون ملف</span>
                <button @click="removeBook(book.id)"
                        style="margin-inline-start:auto;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);color:#ef4444;border-radius:8px;padding:3px 10px;font-size:12px;cursor:pointer">🗑️ حذف</button>
              </div>
            </div>
          </div>
        </div>

        <!-- ============ تبويب مساعد AI ============ -->
        <div v-if="activeTab === 'chat'" class="animate-fade-in" style="height: calc(100vh - 200px); display: flex; gap: 0;">
          <!-- Chat history sidebar -->
          <div class="chat-hist-panel">
            <button class="chat-hist-new" @click="startNewChat">+ {{ t('new_chat') || 'محادثة جديدة' }}</button>
            <div class="chat-hist-list">
              <div v-for="c in chatConversations" :key="c.id"
                :class="['chat-hist-item', { active: chatConvId === c.id }]"
                @click="loadChatConv(c.id)">
                <span class="chat-hist-title">{{ c.title }}</span>
                <button class="chat-hist-del" @click.stop="deleteChatConv(c.id)">&times;</button>
              </div>
              <p v-if="!chatConversations.length" class="text-xs mgr-muted" style="padding:12px;text-align:center">{{ t('no_conversations') || 'لا توجد محادثات' }}</p>
            </div>
          </div>
          <!-- Chat main area -->
          <div style="flex:1;display:flex;flex-direction:column;min-width:0">
          <div ref="chatEl" style="flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px;">
            <div v-if="!chatMsgs.length" class="memorix-card p-10 text-center">
              <div style="margin-bottom:12px">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48" style="display:inline-block;color:var(--accent,#4a7eff)"><path d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.42-4.03 8-9 8a9.9 9.9 0 01-4.25-.96L3 20l1.28-3.56A7.4 7.4 0 013 12c0-4.42 4.03-8 9-8s9 3.58 9 8z" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </div>
              <h3 class="font-bold text-xl mb-2">{{ t('ai_assistant') }}</h3>
              <p style="color: #94a3b8; margin-bottom: 16px">اسأل بأي لغة أو لهجة — الـ AI يرد بنفس الأسلوب</p>
              <div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center">
                <button v-for="q in mgrQuickQs" :key="q"
                  class="text-sm px-4 py-2 rounded-full transition-all"
                  style="background: rgba(74,126,255,0.1); border: 1px solid rgba(74,126,255,0.3); color: #94a3b8; cursor:pointer"
                  @click="sendMgrMsg(q)">{{ q }}</button>
              </div>
            </div>
            <div v-for="(msg, i) in chatMsgs" :key="i"
              :style="msg.role==='user' ? 'display:flex;justify-content:flex-start' : 'display:flex;justify-content:flex-end'">
              <div style="max-width:75%;display:flex;align-items:flex-start;gap:10px"
                :style="msg.role==='user' ? '' : 'flex-direction:row-reverse'">
                <span style="flex-shrink:0;margin-top:4px;width:24px;height:24px;display:inline-flex;align-items:center;justify-content:center;border-radius:50%;color:var(--text2)"
                  v-html="msg.role==='user'
                    ? '<svg viewBox=\'0 0 20 20\' fill=\'currentColor\' width=\'18\' height=\'18\'><path d=\'M10 10a4 4 0 100-8 4 4 0 000 8zm-7 8a7 7 0 0114 0H3z\'/></svg>'
                    : '<svg viewBox=\'0 0 20 20\' fill=\'currentColor\' width=\'18\' height=\'18\'><path d=\'M2 5a2 2 0 012-2h12a2 2 0 012 2v6a2 2 0 01-2 2h-2l-4 4-4-4H4a2 2 0 01-2-2V5zm4 3a1 1 0 100 2h.01a1 1 0 100-2H6zm4 0a1 1 0 100 2h.01a1 1 0 100-2H10zm4 0a1 1 0 100 2h.01a1 1 0 100-2H14z\'/></svg>'
                  "></span>
                <div class="text-sm p-3 rounded-xl" style="line-height:1.6"
                  :style="msg.role==='user'
                    ? 'background:rgba(74,126,255,0.15);border:1px solid rgba(74,126,255,0.3);color:#e2e8f0'
                    : 'background:rgba(26,31,58,0.8);border:1px solid #1a1f3a;color:#e2e8f0'"
                  v-html="fmtChat(msg.content)"></div>
              </div>
            </div>
            <div v-if="chatThinking" style="display:flex;justify-content:flex-end">
              <div style="display:flex;align-items:center;gap:10px;flex-direction:row-reverse">
                <span style="width:24px;height:24px;display:inline-flex;align-items:center;justify-content:center;color:var(--text2)">
                  <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path d="M2 5a2 2 0 012-2h12a2 2 0 012 2v6a2 2 0 01-2 2h-2l-4 4-4-4H4a2 2 0 01-2-2V5zm4 3a1 1 0 100 2h.01a1 1 0 100-2H6zm4 0a1 1 0 100 2h.01a1 1 0 100-2H10zm4 0a1 1 0 100 2h.01a1 1 0 100-2H14z"/></svg>
                </span>
                <div class="p-3 rounded-xl mgr-textarea">
                  <div style="display:flex;gap:4px;align-items:center">
                    <span v-for="n in 3" :key="n" class="mgr-muted" style="width:8px;height:8px;border-radius:50%;display:inline-block;animation:bounce 1s infinite;background:currentColor" :style="`animation-delay:${(n-1)*0.15}s`"></span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="memorix-card p-3" style="display:flex;gap:10px;align-items:flex-end;margin:0;border-radius:0;border-left:none;border-right:none;border-bottom:none">
            <textarea v-model="chatInput" rows="2"
              class="memorix-input flex-1 resize-none" placeholder="اكتب سؤالك للمساعد الذكي..." dir="rtl"
              style="border-radius:10px"
              @keydown.enter.exact.prevent="sendMgrMsg()" @keydown.enter.shift.exact="chatInput+='\n'"></textarea>
            <button @click="sendMgrMsg()" :disabled="!chatInput.trim()||chatThinking"
              class="btn-primary px-4 py-3" style="border-radius:10px;font-size:18px;flex-shrink:0">➤</button>
          </div>
          </div><!-- close chat main area -->
        </div>

        <!-- ============ 💪 صحة المدارس ============ -->
        <div v-if="activeTab === 'health'" class="animate-fade-in">
          <h2 class="text-2xl font-bold mb-6 gradient-text">{{ t('school_health') || 'صحة المدارس' }}</h2>
          <button @click="loadHealth" :disabled="hlLoading" class="btn-primary px-6 py-3 mb-4" style="border-radius:10px">
            {{ hlLoading ? '⏳' : '🔄 ' + t('refresh_btn') }}
          </button>
          <div v-if="health.length" class="grid gap-3">
            <div v-for="h in health" :key="h.school_id" class="memorix-card p-4 flex justify-between items-center">
              <div>
                <h3 class="font-bold">{{ h.name }}</h3>
                <p class="text-sm mgr-muted">{{ h.users }} مستخدم • {{ h.active_week }} {{ t('active_label') }}</p>
              </div>
              <div class="text-left">
                <div style="font-size:28px;font-weight:bold;color:#fbbf24">{{ h.score }}</div>
                <div class="text-sm">{{ h.status }}</div>
              </div>
            </div>
          </div>
        </div>


        <!-- ============ تبويب الإعدادات ============ -->
        <div v-if="activeTab === 'settings'" class="animate-fade-in">
          <h2 class="text-2xl font-bold mb-6 gradient-text">{{ t('settings') }}</h2>
          <div class="grid md:grid-cols-2 gap-6">

            <!-- معلومات الحساب + Avatar -->
            <div class="memorix-card p-6">
              <h3 class="font-bold mb-4" style="color: #00d4ff">👤 {{ t('account_info') }}</h3>
              <div class="flex items-center gap-4 mb-4">
                <div>
                  <svg v-if="mgrSettings.avatar_url && avatarMap[mgrSettings.avatar_url]" viewBox="0 0 80 80" width="64" height="64">
                    <circle cx="40" cy="40" r="38" :fill="avatarMap[mgrSettings.avatar_url].bg"/>
                    <circle cx="40" cy="32" r="16" :fill="avatarMap[mgrSettings.avatar_url].skin"/>
                    <ellipse cx="40" cy="62" rx="22" ry="16" :fill="avatarMap[mgrSettings.avatar_url].outfit"/>
                    <path :d="avatarMap[mgrSettings.avatar_url].hair" :fill="avatarMap[mgrSettings.avatar_url].hairColor"/>
                  </svg>
                  <div v-else style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#4a7eff,#8b5cf6);display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:700;color:#fff">
                    {{ auth.user?.full_name?.[0] || 'م' }}
                  </div>
                </div>
                <div style="flex:1">
                  <p class="text-xs mgr-muted mb-1">{{ t('choose_avatar') || 'اختر صورتك الرمزية' }}</p>
                </div>
              </div>
              <div class="avatar-grid">
                <div v-for="av in avatarOptions" :key="av.id"
                     class="avatar-option" :class="{ selected: mgrSettings.avatar_url === av.id }"
                     @click="selectAvatar(av.id)">
                  <svg viewBox="0 0 80 80" width="48" height="48">
                    <circle cx="40" cy="40" r="38" :fill="av.bg"/>
                    <circle cx="40" cy="32" r="16" :fill="av.skin"/>
                    <ellipse cx="40" cy="62" rx="22" ry="16" :fill="av.outfit"/>
                    <path :d="av.hair" :fill="av.hairColor"/>
                  </svg>
                </div>
              </div>
              <div class="flex justify-between py-2 text-sm mgr-label mgr-section-divider" style="border-bottom-width:1px;border-bottom-style:solid"><span>{{ t('full_name') }}</span><b class="mgr-value">{{ auth.user?.full_name }}</b></div>
              <div class="flex justify-between py-2 text-sm mgr-label mgr-section-divider" style="border-bottom-width:1px;border-bottom-style:solid"><span>{{ t('email') }}</span><b class="mgr-value" style="direction:ltr">{{ auth.user?.email }}</b></div>
              <div class="flex justify-between py-2 text-sm mgr-label"><span>الدور</span><b style="color:#10b981">{{ t('role_manager') }}</b></div>
            </div>

            <!-- المظهر -->
            <div class="memorix-card p-6">
              <h3 class="font-bold mb-4" style="color: #00d4ff">🎨 {{ t('appearance') }}</h3>
              <p class="text-xs mb-2 mgr-muted">{{ t('theme') }}</p>
              <div class="flex gap-2 mb-5 flex-wrap">
                <button v-for="th in [{k:'dark',l:t('theme_dark'),i:'🌑'},{k:'light',l:t('theme_light'),i:'☀️'},{k:'library',l:t('theme_library'),i:'📚'}]"
                        :key="th.k" @click="mgrSettings.theme=th.k; saveMgrSettings()"
                        class="flex-1 py-3 rounded-xl font-medium transition-all mgr-select-btn"
                        :class="{ active: mgrSettings.theme === th.k }">
                  {{ th.i }} {{ th.l }}
                </button>
              </div>
            </div>

            <!-- اللغة -->
            <div class="memorix-card p-6">
              <h3 class="font-bold mb-4" style="color: #8b5cf6">🌐 {{ t('language') }}</h3>
              <div class="grid grid-cols-2 gap-2">
                <button v-for="(L, code) in languages" :key="code"
                        @click="changeMgrLang(code)"
                        class="py-3 rounded-xl font-medium transition-all mgr-select-btn flex items-center justify-center gap-2"
                        :class="{ active: mgrSettings.language === code }">
                  <img :src="L.flagImg" :alt="L.name" style="width:20px;height:14px;border-radius:2px;object-fit:cover" /> {{ L.name }}
                </button>
              </div>
            </div>

            <!-- الإشعارات -->
            <div class="memorix-card p-6">
              <h3 class="font-bold mb-4" style="color: #f59e0b">🔔 {{ t('notifications') }}</h3>
              <label class="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" v-model="mgrSettings.notifications_enabled" @change="saveMgrSettings" />
                <span class="mgr-value">{{ t('notifications_enabled') }}</span>
              </label>
            </div>
          </div>
          <p v-if="settingsMsg" class="mt-4 text-center" style="color:#4ade80;font-weight:bold">{{ settingsMsg }}</p>
        </div>

      </div>
    </div>

    <!-- نافذة نتائج التوليد -->
    <div v-if="generatedAccounts.length" class="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div class="memorix-card p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-bold text-xl" style="color: #00d4ff">✅ تم توليد {{ generatedAccounts.length }} حساب</h3>
          <button @click="generatedAccounts = []" class="mgr-muted" style="font-size: 24px; background: none; border: none; cursor: pointer">×</button>
        </div>
        <div class="p-3 rounded-lg mb-4 text-sm"
             style="background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); color: #ef4444">
          ⚠️ احفظ كلمات المرور الآن! لن تظهر مرة أخرى.
        </div>
        <div class="space-y-2">
          <div v-for="acc in generatedAccounts" :key="acc.email"
               class="p-3 rounded-lg flex items-center justify-between mgr-textarea"
               style="border-radius:8px">
            <div>
              <div class="font-medium text-sm">{{ acc.full_name }}</div>
              <div class="text-xs font-mono mt-0.5" style="color: #4a7eff; direction: ltr">{{ acc.email }}</div>
            </div>
            <div class="text-right">
              <div class="font-mono text-sm px-2 py-1 rounded"
                   style="background: rgba(139,92,246,0.2); color: #8b5cf6">
                {{ acc.password }}
              </div>
              <div class="text-xs mt-1 mgr-muted">{{ roleLabel(acc.role) }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
import { managerAPI, teacherAPI, aiAPI } from '../api.js'
import Stars from '../components/Stars.vue'
import MatrixBackground from '../components/MatrixBackground.vue'
import { useTheme } from '../composables/useTheme.js'
import { useI18n, LANGUAGES } from '../composables/useI18n.js'
import NavBar from '../components/NavBar.vue'

const router = useRouter()
const auth = useAuthStore()
const { t, lang, setLang } = useI18n()
const languages = LANGUAGES

const activeTab = ref('stats')
const tabIcons = {
  stats: `<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M2 11h3v6H2zm5-4h3v10H7zm5-5h3v15h-3zm-10 9h2v4H2z"/></svg>`,
  schools: `<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M10 2L2 7v2h16V7L10 2zM3 10v6h4v-4h6v4h4v-6H3z"/></svg>`,
  setup: `<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M3 17a1 1 0 01-1-1V4a1 1 0 011-1h4l2 2h6a1 1 0 011 1v2H9l-2-2H4v9l2-6h12l-2.6 7.8A1 1 0 0114.5 17H3z"/></svg>`,
  accounts: `<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M7 8a4 4 0 108 0 4 4 0 00-8 0zm0 2a6 6 0 00-6 6v1h20v-1a6 6 0 00-6-6H7z"/></svg>`,
  books: `<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M2 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1H3a1 1 0 01-1-1V4zm5-1a1 1 0 00-1 1v12a1 1 0 001 1h2a1 1 0 001-1V4a1 1 0 00-1-1H7zm5 0a1 1 0 00-.8.4l4 12a1 1 0 001.2.6l1.9-.6a1 1 0 00.6-1.2l-4-12a1 1 0 00-1.2-.6L12.2 3z"/></svg>`,
  health: `<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M3.17 5.17a4.5 4.5 0 016.36 0L10 5.64l.47-.47a4.5 4.5 0 016.36 6.36L10 18.36l-6.83-6.83a4.5 4.5 0 010-6.36z"/></svg>`,
  chat: `<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M18 10c0 3.87-3.58 7-8 7a8.8 8.8 0 01-3.8-.85L2 18l1.3-3.5A6.6 6.6 0 012 10c0-3.87 3.58-7 8-7s8 3.13 8 7zM7 9H5v2h2V9zm4 0H9v2h2V9zm4 0h-2v2h2V9z"/></svg>`,
  settings: `<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M11.5 2.6l.8 1.5a1 1 0 001 .5l1.6-.2a8 8 0 011.5 1.5l-.2 1.6a1 1 0 00.5 1l1.5.8v2.1l-1.5.8a1 1 0 00-.5 1l.2 1.6a8 8 0 01-1.5 1.5l-1.6-.2a1 1 0 00-1 .5l-.8 1.5H8.5l-.8-1.5a1 1 0 00-1-.5l-1.6.2a8 8 0 01-1.5-1.5l.2-1.6a1 1 0 00-.5-1L1.8 11V8.9l1.5-.8a1 1 0 00.5-1l-.2-1.6a8 8 0 011.5-1.5l1.6.2a1 1 0 001-.5l.8-1.5h3zM10 7a3 3 0 100 6 3 3 0 000-6z"/></svg>`,
}
const tabs = computed(() => [
  { id: 'stats', label: t('statistics'), svg: tabIcons.stats },
  { id: 'schools', label: t('schools'), svg: tabIcons.schools },
  { id: 'setup', label: t('upload_excel'), svg: tabIcons.setup },
  { id: 'accounts', label: t('accounts'), svg: tabIcons.accounts },
  { id: 'books', label: t('books'), svg: tabIcons.books },
  { id: 'health', label: t('school_health') || 'صحة المدارس', svg: tabIcons.health },
  { id: 'chat', label: t('ai_assistant'), svg: tabIcons.chat },
  { id: 'settings', label: t('settings'), svg: tabIcons.settings },
])

// الإحصائيات
const stats = ref(null)
const statsLoading = ref(false)

const statCards = computed(() => stats.value ? [
  { label: 'إجمالي المستخدمين', value: stats.value.total_users,    icon: '👤', color: '#4a7eff' },
  { label: 'الطلبة',            value: stats.value.total_students,  icon: '👨‍🎓', color: '#00d4ff' },
  { label: 'المعلمون',          value: stats.value.total_teachers,  icon: '👨‍🏫', color: '#8b5cf6' },
  { label: 'إداريون',           value: stats.value.total_admins,    icon: '🛡️', color: '#f59e0b' },
] : [])

const learningStyleCards = [
  { key: 'visual',      label: 'بصري', icon: '👁️', color: '#4a7eff' },
  { key: 'auditory',    label: 'سمعي', icon: '🎧', color: '#00d4ff' },
  { key: 'kinesthetic', label: 'حركي', icon: '🤸', color: '#8b5cf6' },
]

function learningStylePct(key) {
  if (!stats.value) return 0
  const ls = stats.value.learning_styles || {}
  const total = Object.values(ls).reduce((a, b) => a + b, 0)
  return total ? Math.round((ls[key] || 0) / total * 100) : 0
}

const gradesList = computed(() => {
  if (!stats.value?.grades_dist) return []
  return Object.entries(stats.value.grades_dist).sort((a, b) => b[1] - a[1])
})

// المدارس والحسابات
const schools = ref([])
const schoolSearch = ref('')
const filteredSchools = computed(() =>
  schoolSearch.value
    ? schools.value.filter(s => s.name.includes(schoolSearch.value))
    : schools.value
)
const selectedSchool = ref('')
const selectedSchoolForAccounts = ref('')
const accounts = ref([])
const accountsLoading = ref(false)

// AI Chat with history
const chatMsgs = ref([])
const chatInput = ref('')
const chatThinking = ref(false)
const chatEl = ref(null)
const chatConversations = ref([])
const chatConvId = ref(null)
const mgrQuickQs = [
  'كيف أحسن أداء المدرسة؟',
  'اقترح خطة تطوير للمعلمين',
  'كيف أتابع الطلاب المتأخرين؟',
  'أفضل استراتيجيات الإدارة',
  'كيف أحسّن نسبة الاحتفاظ بالطلاب؟',
  'اقترح خطة استراتيجية للفصل القادم',
]

// Settings
const mgrSettings = ref({
  avatar_url: '', theme: 'dark', language: 'ar',
  notifications_enabled: true
})
useTheme(mgrSettings)
function changeMgrLang(code) {
  mgrSettings.value.language = code
  setLang(code)
  saveMgrSettings()
}
const avatarOptions = [
  { id: 'av1', bg: '#E3F2FD', skin: '#FDBCB4', hairColor: '#3E2723', outfit: '#1976D2', hair: 'M24,24 Q40,8 56,24 Q56,16 40,12 Q24,16 24,24Z' },
  { id: 'av2', bg: '#FFF3E0', skin: '#8D5524', hairColor: '#1B1B1B', outfit: '#E65100', hair: 'M24,26 Q40,10 56,26 L56,20 Q40,6 24,20Z' },
  { id: 'av3', bg: '#E8F5E9', skin: '#FDBCB4', hairColor: '#5D4037', outfit: '#2E7D32', hair: 'M22,28 Q32,12 40,14 Q48,12 58,28 Q56,18 40,8 Q24,18 22,28Z' },
  { id: 'av4', bg: '#FCE4EC', skin: '#D4A574', hairColor: '#4E342E', outfit: '#C2185B', hair: 'M22,30 Q28,14 40,12 Q52,14 58,30 L58,22 Q50,10 40,8 Q30,10 22,22Z' },
  { id: 'av5', bg: '#EDE7F6', skin: '#FDBCB4', hairColor: '#F9A825', outfit: '#512DA8', hair: 'M26,24 Q40,10 54,24 Q52,14 40,8 Q28,14 26,24Z' },
  { id: 'av6', bg: '#E0F7FA', skin: '#8D5524', hairColor: '#212121', outfit: '#00838F', hair: 'M24,26 Q40,14 56,26 Q54,18 40,10 Q26,18 24,26Z' },
  { id: 'av7', bg: '#FFF8E1', skin: '#C68642', hairColor: '#3E2723', outfit: '#FF8F00', hair: 'M20,28 Q30,10 40,12 Q50,10 60,28 Q58,16 40,6 Q22,16 20,28Z' },
  { id: 'av8', bg: '#F3E5F5', skin: '#FDBCB4', hairColor: '#1B1B1B', outfit: '#7B1FA2', hair: 'M24,28 Q32,12 48,12 Q56,16 56,28 L56,22 Q54,14 40,10 Q26,14 24,22Z' },
  { id: 'av9', bg: '#E8EAF6', skin: '#D4A574', hairColor: '#BF360C', outfit: '#283593', hair: 'M26,26 Q34,12 46,12 Q54,16 54,26 Q52,18 40,10 Q28,18 26,26Z' },
  { id: 'av10', bg: '#EFEBE9', skin: '#8D5524', hairColor: '#1B1B1B', outfit: '#4E342E', hair: 'M24,24 Q40,8 56,24 Q54,14 40,6 Q26,14 24,24Z' },
  { id: 'av11', bg: '#E0F2F1', skin: '#FDBCB4', hairColor: '#4E342E', outfit: '#00695C', hair: 'M22,28 Q32,14 48,14 Q58,20 58,28 L56,22 Q48,12 32,12 Q22,20 22,28Z' },
  { id: 'av12', bg: '#F1F8E9', skin: '#C68642', hairColor: '#33691E', outfit: '#558B2F', hair: 'M26,24 Q40,12 54,24 Q52,16 40,10 Q28,16 26,24Z' },
]
const avatarMap = Object.fromEntries(avatarOptions.map(a => [a.id, a]))
function selectAvatar(id) {
  mgrSettings.value.avatar_url = id
  saveMgrSettings()
}
const settingsMsg = ref('')

// إعداد المدرسة
const studentsText = ref('')
const teachersText = ref('')
const adminsCount = ref(1)
const setupLoading = ref(false)
const generatedAccounts = ref([])

const parsedStudents = computed(() => {
  return studentsText.value.split('\n')
    .map(l => l.trim()).filter(Boolean)
    .map(line => {
      const [name, ministry_id, grade, section] = line.split(',').map(s => s.trim())
      return { name: name || '', ministry_id: ministry_id || '', grade: grade || '', section: section || '' }
    })
})

const parsedTeachers = computed(() => {
  // كل سطر = تكليف: الاسم، الرقم الوزاري، المادة، الصف، الشعبة
  // المعلم اللي بيدرّس أكتر من شعبة = سطر لكل شعبة بنفس الاسم/الرقم الوزاري
  return teachersText.value.split('\n')
    .map(l => l.trim()).filter(Boolean)
    .map(line => {
      const [name, ministry_id, subject, grade, section] = line.split(',').map(s => s.trim())
      return { name: name || '', ministry_id: ministry_id || '', subject: subject || '', grade: grade || '', section: section || '' }
    })
})

// الباسووردات
const savedPasswords = ref([])
const selectedSchoolForPasswords = ref('')
const passwordsLoading = ref(false)

// الكتب
const books = ref([])
const bookLoading = ref(false)
const newBook = ref({ title: '', subject: '', grade: '' })

// قوائم المواد والصفوف
const subjectOptions = computed(() => [
  { value: 'arabic',   label: t('subj_arabic') },
  { value: 'english',  label: t('subj_english') },
  { value: 'math',     label: t('subj_math') },
  { value: 'science',  label: t('subj_science') },
  { value: 'physics',  label: t('subj_physics') },
  { value: 'chemistry',label: t('subj_chemistry') },
  { value: 'biology',  label: t('subj_biology') },
  { value: 'history',  label: t('subj_history') },
  { value: 'geography',label: t('subj_geography') },
  { value: 'islamic',  label: t('subj_islamic') },
  { value: 'computer', label: t('subj_computer') },
  { value: 'art',      label: t('subj_art') },
  { value: 'pe',       label: t('subj_pe') },
  { value: 'other',    label: t('subj_other') },
])

const gradeOptions = computed(() => [
  { value: '1',  label: t('grade_1') },
  { value: '2',  label: t('grade_2') },
  { value: '3',  label: t('grade_3') },
  { value: '4',  label: t('grade_4') },
  { value: '5',  label: t('grade_5') },
  { value: '6',  label: t('grade_6') },
  { value: '7',  label: t('grade_7') },
  { value: '8',  label: t('grade_8') },
  { value: '9',  label: t('grade_9') },
  { value: '10', label: t('grade_10') },
  { value: '11', label: t('grade_11') },
  { value: '12', label: t('grade_12') },
])
const bookFileText = ref('')
const bookFileName = ref('')
const bookExtractLoading = ref(false)
const bookExtractError = ref('')
const bookFilePath = ref('')
const bookFileUrl = ref('')
const bookFileSize = ref(0)
const bookMime = ref('')

async function onBookFileChange(e) {
  const file = e.target.files?.[0]
  if (!file) return
  await extractBookFile(file)
  // إعادة تعيين input للسماح بإعادة اختيار نفس الملف
  e.target.value = ''
}

function onBookFileDrop(e) {
  const file = e.dataTransfer?.files?.[0]
  if (!file) return
  extractBookFile(file)
}

function clearBookFile() {
  bookFileText.value = ''
  bookFileName.value = ''
  bookExtractError.value = ''
  bookFilePath.value = ''
  bookFileUrl.value = ''
  bookFileSize.value = 0
  bookMime.value = ''
}

async function uploadBookToStorage(file) {
  // رابط رفع موقّع من الباك، ثم رفع مباشر إلى Supabase (يتخطّى حد 4.5MB في Vercel)
  const { data } = await managerAPI.getBookUploadUrl(file.name, file.type || 'application/octet-stream')
  const put = await fetch(data.upload_url, {
    method: 'PUT',
    headers: { 'content-type': file.type || 'application/octet-stream' },
    body: file,
  })
  if (!put.ok) throw new Error('فشل رفع الملف للتخزين (' + put.status + ')')
  return { path: data.path, url: data.public_url }
}

async function extractBookFile(file) {
  if (file.size > 50 * 1024 * 1024) {
    bookExtractError.value = 'الملف أكبر من 50MB — اختر ملفاً أصغر'
    return
  }
  const allowed = ['.pdf', '.pptx', '.txt', '.md']
  const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'))
  if (!allowed.includes(ext)) {
    bookExtractError.value = `صيغة غير مدعومة (${ext}). استخدم: PDF أو PPTX أو TXT`
    return
  }

  bookFileName.value = file.name
  bookFileText.value = ''
  bookFilePath.value = ''
  bookFileUrl.value = ''
  bookExtractError.value = ''
  bookExtractLoading.value = true

  // auto-fill title from filename if empty
  if (!newBook.value.title.trim()) {
    newBook.value.title = file.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ').trim()
  }

  // 1) رفع الملف نفسه للتخزين الدائم (أي حجم — مباشر إلى Supabase)
  try {
    const up = await uploadBookToStorage(file)
    bookFilePath.value = up.path
    bookFileUrl.value = up.url
    bookFileSize.value = file.size
    bookMime.value = file.type || ''
  } catch (e) {
    bookExtractError.value = e.message || 'فشل رفع الملف للتخزين'
    bookFileName.value = ''
    bookExtractLoading.value = false
    return
  }

  // 2) استخراج النص لتوليد الملخص (أفضل جهد — لا يُفشل العملية إن تعذّر)
  try {
    if (ext === '.txt' || ext === '.md') {
      bookFileText.value = await new Promise((resolve) => {
        const r = new FileReader()
        r.onload = (ev) => resolve((ev.target.result || '').slice(0, 80000))
        r.onerror = () => resolve('')
        r.readAsText(file, 'utf-8')
      })
    } else if (file.size <= 4 * 1024 * 1024) {
      // PDF/PPTX ≤ 4MB — الباك يستخرج النص (حد Vercel للرفع عبر الباك)
      const res = await managerAPI.extractBookText(file)
      bookFileText.value = res.data.text || ''
    }
    // ملفات أكبر من 4MB: تُخزَّن بنجاح بدون ملخص تلقائي
  } catch (e) {
    bookFileText.value = ''
  } finally {
    bookExtractLoading.value = false
  }
}

async function loadStats() {
  statsLoading.value = true
  try {
    const res = await managerAPI.getStats()
    stats.value = res.data
  } catch (e) {
    console.error('خطأ في الإحصائيات:', e)
  } finally {
    statsLoading.value = false
  }
}

async function loadAccounts() {
  if (!selectedSchoolForAccounts.value) return
  accountsLoading.value = true
  try {
    const res = await managerAPI.getAccounts(selectedSchoolForAccounts.value)
    accounts.value = res.data
  } catch (e) {
    console.error('خطأ في جلب الحسابات:', e)
  } finally {
    accountsLoading.value = false
  }
}

async function generateAccounts() {
  if (!selectedSchool.value) return
  if (!parsedStudents.value.length && !parsedTeachers.value.length && !adminsCount.value) {
    alert('أدخل بيانات على الأقل')
    return
  }

  setupLoading.value = true
  try {
    const res = await managerAPI.setupSchool({
      school_id: selectedSchool.value,
      students: parsedStudents.value,
      teachers: parsedTeachers.value,
      admins_count: adminsCount.value
    })
    generatedAccounts.value = res.data.accounts
    await loadStats()
  } catch (e) {
    alert('خطأ: ' + (e.response?.data?.detail || e.message))
  } finally {
    setupLoading.value = false
  }
}

async function downloadCSV() {
  try {
    const res = await managerAPI.exportCSV(selectedSchoolForAccounts.value)
    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url
    a.download = 'memorix_accounts.csv'
    a.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    alert('خطأ في التحميل')
  }
}

async function loadSavedPasswords() {
  if (!selectedSchoolForPasswords.value) return
  passwordsLoading.value = true
  try {
    const res = await managerAPI.getSavedPasswords(selectedSchoolForPasswords.value)
    savedPasswords.value = res.data.accounts || []
  } catch (e) {
    console.error('خطأ في جلب الباسووردات:', e)
  } finally {
    passwordsLoading.value = false
  }
}

function downloadPasswordsCSV() {
  const BOM = '﻿'
  const header = 'الاسم,الإيميل,الباسوورد,الدور\n'
  const rows = savedPasswords.value.map(a =>
    `${a.full_name},${a.email},${a.password},${roleLabel(a.role)}`
  ).join('\n')
  const blob = new Blob([BOM + header + rows], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'memorix_passwords.csv'
  link.click()
  URL.revokeObjectURL(url)
}

async function addBook() {
  if (!newBook.value.title?.trim() || !newBook.value.subject?.trim()) {
    alert('أدخل عنوان الكتاب والمادة الدراسية')
    return
  }
  bookLoading.value = true
  try {
    await managerAPI.addBook({
      title: newBook.value.title.trim(),
      subject: newBook.value.subject.trim(),
      grade: newBook.value.grade?.trim() || '',
      raw_text: bookFileText.value || '',
      file_path: bookFilePath.value || null,
      file_url: bookFileUrl.value || null,
      file_name: bookFileName.value || null,
      file_size: bookFileSize.value || null,
      mime_type: bookMime.value || null
    })
    // تصفير الحقول
    newBook.value = { title: '', subject: '', grade: '' }
    clearBookFile()
    // إعادة تحميل الكتب
    const res = await managerAPI.getBooks()
    books.value = res.data
  } catch (e) {
    alert('❌ خطأ في إضافة الكتاب: ' + (e.response?.data?.detail || e.message))
  } finally {
    bookLoading.value = false
  }
}

async function removeBook(id) {
  if (!confirm('حذف هذا الكتاب وملفه نهائياً؟')) return
  try {
    await managerAPI.deleteBook(id)
    books.value = books.value.filter(b => b.id !== id)
  } catch (e) {
    alert('تعذر الحذف: ' + (e.response?.data?.detail || e.message))
  }
}

function roleLabel(role) {
  return { student: 'طالب', teacher: 'معلم', admin: 'إداري', manager: 'مدير' }[role] || role
}

function roleStyle(role) {
  const map = {
    student: 'background: rgba(74,126,255,0.15); color: #4a7eff',
    teacher: 'background: rgba(0,212,255,0.15); color: #00d4ff',
    admin: 'background: rgba(139,92,246,0.15); color: #8b5cf6',
    manager: 'background: rgba(16,185,129,0.15); color: #10b981',
  }
  return map[role] || ''
}

async function loadChatHistory() {
  try { chatConversations.value = (await aiAPI.getConversations()).data } catch {}
}
function startNewChat() { chatConvId.value = null; chatMsgs.value = [] }
async function loadChatConv(id) {
  chatConvId.value = id
  try {
    const r = await aiAPI.getMessages(id)
    chatMsgs.value = r.data.messages || []
    nextTick(() => { if(chatEl.value) chatEl.value.scrollTop = chatEl.value.scrollHeight })
  } catch {}
}
async function deleteChatConv(id) {
  try {
    await aiAPI.deleteConversation(id)
    chatConversations.value = chatConversations.value.filter(c => c.id !== id)
    if (chatConvId.value === id) { chatConvId.value = null; chatMsgs.value = [] }
  } catch {}
}
async function sendMgrMsg(text) {
  const m = text || chatInput.value.trim(); if(!m) return
  chatInput.value = ''; chatMsgs.value.push({ role: 'user', content: m }); chatThinking.value = true
  nextTick(() => { if(chatEl.value) chatEl.value.scrollTop = chatEl.value.scrollHeight })
  try {
    const r = await aiAPI.chat(m, chatConvId.value)
    chatConvId.value = r.data.conversation_id
    chatMsgs.value.push({ role: 'assistant', content: r.data.reply })
    loadChatHistory()
  } catch {
    chatMsgs.value.push({ role: 'assistant', content: 'حدث خطأ في الاتصال.' })
  } finally {
    chatThinking.value = false
    nextTick(() => { if(chatEl.value) chatEl.value.scrollTop = chatEl.value.scrollHeight })
  }
}

function fmtChat(t) {
  if(!t) return ''
  return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/\*(.*?)\*/g,'<em>$1</em>')
    .replace(/`(.*?)`/g,'<code style="background:rgba(255,255,255,.1);border-radius:4px;padding:1px 5px">$1</code>').replace(/\n/g,'<br>')
}

async function loadMgrSettings() {
  try {
    const r = await managerAPI.getSettings()
    mgrSettings.value = { ...mgrSettings.value, ...r.data }
    if (mgrSettings.value.language) setLang(mgrSettings.value.language)
  } catch (e) { console.warn('mgr settings load failed', e) }
}
async function saveMgrSettings() {
  try {
    const r = await managerAPI.updateSettings(mgrSettings.value)
    settingsMsg.value = r.data.message || '✅ تم الحفظ'
    setTimeout(() => { settingsMsg.value = '' }, 2500)
  } catch {
    settingsMsg.value = '❌ فشل الحفظ'
    setTimeout(() => { settingsMsg.value = '' }, 2500)
  }
}

async function handleLogout() {
  await auth.logout()
  router.push('/login')
}

// 👔 ميزات المدير المتقدمة
const health = ref([]), hlLoading = ref(false)
async function loadHealth() { hlLoading.value=true; try { health.value=(await managerAPI.healthScore()).data } catch(e){alert('فشل')} hlLoading.value=false }
const adQuestion = ref(''), adContext = ref(''), adLoading = ref(false), adAnswer = ref('')
async function askAdvisor() {
  if (!adQuestion.value.trim()) return alert('اطرح سؤالك')
  adLoading.value=true; adAnswer.value=''
  try { adAnswer.value=(await managerAPI.strategicAdvisor(adQuestion.value, adContext.value)).data.advice }
  catch(e) { alert('فشل') }
  adLoading.value=false
}

// 🏫 إدارة المدارس
const newSchool = ref({ name:'', branch:'', ministry_code:'' })
const newSchoolLoading = ref(false)
const newSchoolMsg = ref('')
async function createNewSchool() {
  if (!newSchool.value.name.trim()) return
  newSchoolLoading.value = true; newSchoolMsg.value = ''
  try {
    await managerAPI.createSchool(newSchool.value)
    newSchoolMsg.value = '✅ تمت الإضافة وتم الحفظ في قاعدة البيانات'
    newSchool.value = { name:'', branch:'', ministry_code:'' }
    schools.value = (await managerAPI.getSchools()).data
  } catch (e) {
    newSchoolMsg.value = '❌ ' + (e.response?.data?.detail || e.message)
  }
  newSchoolLoading.value = false
}

// رفع ملف Excel لإنشاء مدرسة/مدارس مع صفوفها وشُعبها
const schoolExcelFile = ref(null)
const schoolExcelLoading = ref(false)
const schoolExcelMsg = ref('')
function onSchoolExcelChange(e) {
  schoolExcelFile.value = e.target.files?.[0] || null
}
async function uploadSchoolsExcelFile() {
  if (!schoolExcelFile.value) return
  schoolExcelLoading.value = true; schoolExcelMsg.value = ''
  try {
    const res = await managerAPI.uploadSchoolsExcel(schoolExcelFile.value)
    const n = res.data?.total_schools || 0
    schoolExcelMsg.value = `✅ تم إنشاء/تحديث ${n} مدرسة بصفوفها وشُعبها`
    schoolExcelFile.value = null
    schools.value = (await managerAPI.getSchools()).data
  } catch (e) {
    schoolExcelMsg.value = '❌ ' + (e.response?.data?.detail || e.message)
  }
  schoolExcelLoading.value = false
}
async function confirmDeleteSchool(s) {
  if (!confirm(`⚠️ هل أنت متأكد من حذف مدرسة "${s.name}"؟\nسيتم حذف كل الحسابات المرتبطة بها نهائياً!`)) return
  try {
    await managerAPI.deleteSchool(s.id)
    schools.value = (await managerAPI.getSchools()).data
    alert('✅ تم حذف المدرسة وكل بياناتها')
  } catch (e) {
    alert('❌ فشل: ' + (e.response?.data?.detail || e.message))
  }
}
function goToSetup(schoolId) {
  selectedSchool.value = schoolId
  activeTab.value = 'setup'
}

// 📤 رفع Excel
const excelFile = ref(null)
const excelFileName = ref('')
const uploadLoading = ref(false)
const uploadResult = ref(null)
function onExcelChange(e) {
  const f = e.target.files?.[0]
  if (!f) return
  excelFile.value = f
  excelFileName.value = f.name
}
async function uploadExcel() {
  if (!excelFile.value || !selectedSchool.value) return
  uploadLoading.value = true; uploadResult.value = null
  try {
    const r = await managerAPI.uploadExcel(selectedSchool.value, excelFile.value)
    uploadResult.value = r.data
    schools.value = (await managerAPI.getSchools()).data
  } catch (e) {
    alert('❌ فشل الرفع: ' + (e.response?.data?.detail || e.message))
  }
  uploadLoading.value = false
}

// 🔑 عرض كلمة السر لكل حساب
const revealedPasswords = ref({})
const revealLoading = ref({})
async function revealPassword(userId) {
  revealLoading.value[userId] = true
  try {
    const r = await managerAPI.getAccountPassword(userId)
    if (r.data.found && r.data.password) {
      revealedPasswords.value[userId] = r.data.password
    } else {
      // كلمة السر غير محفوظة → اقترح إعادة تعيين
      const ok = confirm(`${r.data.message || 'كلمة السر غير محفوظة'}\n\n${r.data.suggestion || ''}\n\nهل تريد إنشاء كلمة سر جديدة الآن؟`)
      if (ok) await resetPassword(userId)
    }
  } catch (e) {
    alert('❌ ' + (e.response?.data?.detail || 'تعذر جلب كلمة السر'))
  }
  revealLoading.value[userId] = false
}

async function resetPassword(userId) {
  if (!confirm('⚠️ هل أنت متأكد من إعادة تعيين كلمة السر؟ كلمة السر القديمة لن تعمل بعد ذلك.')) return
  revealLoading.value[userId] = true
  try {
    const r = await managerAPI.resetAccountPassword(userId)
    revealedPasswords.value[userId] = r.data.password
    alert(`✅ كلمة السر الجديدة:\n${r.data.password}\n\nاحفظها — لن تظهر مرة أخرى!`)
  } catch (e) {
    alert('❌ ' + (e.response?.data?.detail || 'فشل إعادة التعيين'))
  }
  revealLoading.value[userId] = false
}
function copyToClipboard(text) {
  navigator.clipboard?.writeText(text)
  alert('✅ تم نسخ كلمة السر')
}

// 🗑️ حذف حساب
async function confirmDeleteAccount(acc) {
  if (!confirm(`⚠️ هل أنت متأكد من حذف الحساب "${acc.full_name}" (${acc.email})؟\nسيتم حذف كل بياناته نهائياً من قاعدة البيانات!`)) return
  try {
    await managerAPI.deleteAccount(acc.id)
    accounts.value = accounts.value.filter(a => a.id !== acc.id)
    delete revealedPasswords.value[acc.id]
    alert('✅ تم حذف الحساب نهائياً')
  } catch (e) {
    alert('❌ فشل: ' + (e.response?.data?.detail || e.message))
  }
}

onMounted(async () => {
  await loadMgrSettings()
  await loadStats()
  loadChatHistory()
  try {
    const res = await managerAPI.getSchools()
    schools.value = res.data
    const booksRes = await managerAPI.getBooks()
    books.value = booksRes.data
  } catch (e) {
    console.error('خطأ في تحميل البيانات:', e)
  }
})
</script>

<style scoped>
@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}

/* بطاقات الإحصائيات ذات التوهج */
.stat-glow-card {
  transition: transform 0.2s, box-shadow 0.2s;
}
.stat-glow-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 0 24px var(--glow-c, rgba(74,126,255,0.25));
}

/* Avatar grid */
.avatar-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 8px; }
.avatar-option { cursor: pointer; border-radius: 50%; padding: 4px; border: 3px solid transparent; transition: all 0.2s; display: flex; align-items: center; justify-content: center; }
.avatar-option:hover { border-color: var(--accent, #4a7eff); transform: scale(1.1); }
.avatar-option.selected { border-color: var(--accent, #4a7eff); box-shadow: 0 0 12px rgba(74,126,255,0.4); }

/* Chat history sidebar */
.chat-hist-panel {
  width: 220px; flex-shrink: 0; display: flex; flex-direction: column;
  background: var(--card, rgba(26,31,58,0.6)); border-right: 1px solid var(--border, rgba(255,255,255,0.08));
  border-radius: 12px 0 0 12px; overflow: hidden;
}
.chat-hist-new {
  padding: 12px; text-align: center; font-size: 13px; font-weight: 600;
  background: rgba(74,126,255,0.12); color: var(--accent, #4a7eff);
  border: none; border-bottom: 1px solid var(--border, rgba(255,255,255,0.08));
  cursor: pointer; transition: background 0.15s;
}
.chat-hist-new:hover { background: rgba(74,126,255,0.2); }
.chat-hist-list { flex: 1; overflow-y: auto; padding: 6px; }
.chat-hist-item {
  display: flex; align-items: center; justify-content: space-between; gap: 4px;
  padding: 8px 10px; border-radius: 8px; cursor: pointer; font-size: 12px;
  color: var(--text2, #94a3b8); transition: all 0.15s; margin-bottom: 2px;
}
.chat-hist-item:hover { background: rgba(74,126,255,0.08); }
.chat-hist-item.active { background: rgba(74,126,255,0.15); color: var(--accent, #4a7eff); font-weight: 600; }
.chat-hist-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
.chat-hist-del {
  width: 20px; height: 20px; border-radius: 4px; border: none; cursor: pointer;
  background: transparent; color: var(--text2); font-size: 14px; opacity: 0;
  display: flex; align-items: center; justify-content: center; transition: all 0.15s;
}
.chat-hist-item:hover .chat-hist-del { opacity: 0.6; }
.chat-hist-del:hover { opacity: 1; background: rgba(239,68,68,0.15); color: #ef4444; }

@media (max-width: 768px) {
  .chat-hist-panel { display: none; }
}
</style>

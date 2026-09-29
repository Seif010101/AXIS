<template>
  <div class="hub hub-teacher">
    <MatrixBackground />

    <!-- 📡 البث المباشر -->
    <LiveClass v-if="liveOverlay" :room="liveRoom" :name="firstName" :title="liveTitle" @close="endLiveSession" />
    <button v-if="!liveOverlay" @click="openLiveStart" style="position:fixed;bottom:18px;left:18px;z-index:9000;background:linear-gradient(135deg,#ef4444,#f59e0b);color:#fff;border:none;padding:12px 20px;border-radius:30px;font-weight:800;cursor:pointer;box-shadow:0 6px 24px rgba(239,68,68,.5);font-size:14px">📡 بث مباشر</button>
    <div v-if="liveStartOpen" @click.self="liveStartOpen=false" style="position:fixed;inset:0;z-index:9100;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:16px">
      <div style="background:var(--card,#0b0e1f);border:1px solid var(--border,#1a1f3a);border-radius:16px;padding:24px;width:100%;max-width:380px;color:var(--text,#fff)">
        <h3 style="margin:0 0 14px">📡 بدء حصة مباشرة</h3>
        <select v-model="livePickIdx" class="memorix-input" style="margin-bottom:12px" dir="rtl">
          <option v-for="(c,i) in liveClasses" :key="i" :value="i">{{ c.grade }} {{ c.section }} — {{ c.subject }}</option>
        </select>
        <button @click="doStartLive" :disabled="liveBusy||!liveClasses.length" class="btn-primary" style="width:100%">{{ liveBusy ? '...' : 'ابدأ الحصة الآن' }}</button>
        <p v-if="!liveClasses.length" style="color:#f59e0b;font-size:13px;margin-top:10px">لا توجد صفوف مكلّف بها — تأكد من تكليفك من المدير</p>
      </div>
    </div>
    <!-- Mobile menu -->
    <button class="mobile-toggle" @click="mobileOpen = !mobileOpen" aria-label="Menu">{{ mobileOpen ? '✕' : '☰' }}</button>
    <div :class="['mobile-overlay', { open: mobileOpen }]" @click="mobileOpen = false"></div>

    <!-- Sidebar -->
    <aside :class="['sidebar',{collapsed:sb, open: mobileOpen}]">
      <div class="sb-header" @click="sb=!sb">
        <div class="brand"><div class="b-icon">M</div><span v-if="!sb" class="b-name">Morix</span></div>
      </div>
      <nav class="sb-nav">
        <button v-for="s in sections" :key="s.id" :class="['nav-item',{active:cur===s.id}]" @click="cur=s.id; mobileOpen=false" :title="s.label">
          <span class="nav-icon" v-html="s.svg"></span><span v-if="!sb" class="nav-label">{{ s.label }}</span>
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
        :avatar-url="tSettings.avatar_url"
        :current-theme="tSettings.theme"
        :current-lang="lang"
        @theme="v => { tSettings.theme = v; saveTeacherSettings() }"
        @lang="changeTeacherLang"
      />

      <!-- ===== OVERVIEW ===== -->
      <section v-show="cur==='overview'" class="body pad">
        <div class="stats-grid">
          <div class="sc"><div class="sn">{{ students.length }}</div><div class="sl">طلاب المدرسة</div></div>
          <div class="sc"><div class="sn">{{ homework.length }}</div><div class="sl">واجبات محددة</div></div>
          <div class="sc"><div class="sn">{{ myTests.length }}</div><div class="sl">اختبارات</div></div>
          <div class="sc"><div class="sn">{{ worksheets.length }}</div><div class="sl">أوراق عمل</div></div>
        </div>
        <div class="card mt">
          <h3>👋 مرحباً {{ firstName }}!</h3>
          <p style="color:var(--t2)">اختر قسماً من القائمة الجانبية للبدء.</p>
        </div>
      </section>

      <!-- ===== HOMEWORK ===== -->
      <section v-show="cur==='homework'" class="body pad">
        <div class="card">
          <div class="row-sb"><h3>📚 الواجبات</h3><button class="btn-p" @click="hwForm=!hwForm">+ {{ t('add_btn') }}</button></div>
          <div v-if="hwForm" class="form-box">
            <p style="color:var(--t2);font-size:13px;margin:0 0 8px">🤖 AI يولّد العنوان والتعليمات تلقائياً — فقط أدخل الموضوع والمادة.</p>
            <input v-model="hwNew.topic" class="inp" placeholder="الموضوع / ما تريد الطلاب يدرسونه *" />
            <div class="row-gap">
              <select v-if="myClasses.length" class="inp" v-model="hwClassIdx" @change="onClassPick('hw')">
                <option value="">اختر الصف / الشعبة *</option>
                <option v-for="(c,i) in myClasses" :key="i" :value="i">
                  {{ c.subject || 'مادة' }} — {{ c.grade }}{{ c.section ? ' / ' + c.section : '' }}
                </option>
              </select>
              <template v-else>
                <input v-model="hwNew.subject" class="inp" placeholder="المادة *" />
                <input v-model="hwNew.grade" class="inp" placeholder="الصف" />
              </template>
              <input v-model="hwNew.due_date" class="inp" type="datetime-local" />
            </div>
            <p v-if="myClasses.length && hwNew.grade" class="text-xs" style="color:#10b981;margin:0 0 6px">
              📌 سيصل الواجب لطلاب: {{ hwNew.grade }}{{ hwNew.section ? ' / شعبة ' + hwNew.section : '' }}
            </p>
            <div class="row-gap"><button class="btn-p" @click="createHw" :disabled="hwLoading||!hwNew.topic||!hwNew.subject">{{ hwLoading?'⏳ AI يولّد...':'✨ ' + t('create_ai') }}</button><button class="btn-o" @click="hwForm=false">{{ t('cancel') }}</button></div>
          </div>
          <div v-if="!homework.length" class="empty">{{ t('no_homework') }}</div>
          <div v-else class="list-col">
            <div v-for="hw in homework" :key="hw.id" class="list-item">
              <div style="flex:1"><h4>{{ hw.title }}</h4>
                <div class="meta"><span>📚 {{ hw.subject }}</span><span v-if="hw.grade">🎓 {{ hw.grade }}</span><span v-if="hw.due_date">📅 {{ fmtDate(hw.due_date) }}</span></div>
              </div>
              <div class="row-gap">
                <button class="btn-s" @click="viewSubmissions(hw.id)">{{ t('view_submissions') }}</button>
                <button class="btn-s danger" @click="deleteHw(hw.id)">{{ t('delete_btn') }}</button>
              </div>
            </div>
          </div>
        </div>
        <div v-if="submissions.length" class="card mt">
          <h3>📥 التسليمات</h3>
          <div class="list-col">
            <div v-for="s in submissions" :key="s.id" class="list-item">
              <div><h4>{{ s.users?.full_name }}</h4><p style="color:var(--t2);font-size:13px">{{ s.content }}</p></div>
            </div>
          </div>
        </div>
      </section>

      <!-- ===== TESTS ===== -->
      <section v-show="cur==='tests'" class="body pad">
        <div class="card">
          <div class="row-sb"><h3>📝 الاختبارات</h3><button class="btn-p" @click="testForm=!testForm">{{ testForm ? '✕ إغلاق' : '+ ' + t('add_btn') }}</button></div>

          <!-- ── نموذج إنشاء الاختبار اليدوي ── -->
          <div v-if="testForm" class="form-box" style="border:2px solid var(--accent);border-radius:12px;padding:16px;margin-top:12px">
            <h4 style="color:var(--accent);margin-bottom:12px">📝 بانية الاختبار اليدوي</h4>

            <!-- معلومات الاختبار -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
              <input v-model="testNew.title" class="inp" placeholder="عنوان الاختبار *" />
              <select v-if="myClasses.length" class="inp" v-model="testClassIdx" @change="onClassPick('test')">
                <option value="">اختر الصف / الشعبة *</option>
                <option v-for="(c,i) in myClasses" :key="i" :value="i">
                  {{ c.subject || 'مادة' }} — {{ c.grade }}{{ c.section ? ' / ' + c.section : '' }}
                </option>
              </select>
              <template v-else>
                <input v-model="testNew.subject" class="inp" placeholder="المادة *" />
                <input v-model="testNew.grade" class="inp" placeholder="الصف" />
              </template>
              <input v-model.number="testNew.duration_minutes" class="inp" type="number" placeholder="المدة (دقيقة)" min="5" max="180" />
            </div>

            <!-- الأسئلة -->
            <div v-for="(q, qi) in testQuestions" :key="qi" style="background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:12px">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                <span style="font-weight:700;color:var(--accent)">سؤال {{ qi+1 }}</span>
                <button class="btn-s danger" @click="removeQuestion(qi)" style="padding:4px 10px;font-size:12px">🗑 حذف</button>
              </div>
              <input v-model="q.question" class="inp" :placeholder="`نص السؤال ${qi+1} *`" style="margin-bottom:8px" />
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px">
                <input v-for="(opt, oi) in ['a','b','c','d']" :key="oi"
                       v-model="q.options[opt]" class="inp"
                       :placeholder="`الخيار ${['أ','ب','ج','د'][oi]} *`"
                       :style="{borderColor: q.answer===opt ? 'var(--accent)' : 'var(--border)'}" />
              </div>
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                <span style="color:var(--t2);font-size:13px">الإجابة الصحيحة:</span>
                <button v-for="(opt,oi) in ['a','b','c','d']" :key="oi"
                        @click="q.answer=opt"
                        :class="['btn-s', q.answer===opt ? '' : 'btn-outline']"
                        :style="{background: q.answer===opt ? 'var(--accent)' : 'transparent', color: q.answer===opt ? '#fff' : 'var(--t2)', border: '1px solid var(--border)', padding:'4px 12px'}">
                  {{ ['أ','ب','ج','د'][oi] }}
                </button>
                <input v-model="q.explanation" class="inp" placeholder="شرح الإجابة (اختياري)" style="flex:1;min-width:120px" />
              </div>
            </div>

            <!-- أزرار الأسئلة -->
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">
              <button class="btn-o" @click="addQuestion" style="flex:1">➕ إضافة سؤال</button>
              <button class="btn-o" @click="addQuestionBlock(5)" style="flex:1">➕ إضافة 5 أسئلة</button>
            </div>

            <!-- معاينة عدد الأسئلة -->
            <div v-if="testQuestions.length" style="padding:8px;background:rgba(99,102,241,.1);border-radius:8px;margin-bottom:10px;font-size:13px;color:var(--t2)">
              📊 عدد الأسئلة: <b style="color:var(--accent)">{{ testQuestions.length }}</b> سؤال
            </div>

            <div style="display:flex;gap:8px">
              <button class="btn-p" style="flex:1" @click="createTest"
                :disabled="testLoading || !testNew.title || !testNew.subject || !testQuestions.length || testQuestions.some(q=>!q.question||!q.options.a||!q.options.b||!q.options.c||!q.options.d||!q.answer)">
                {{ testLoading ? '⏳ جاري الحفظ...' : '💾 حفظ الاختبار' }}
              </button>
              <button class="btn-o" @click="testForm=false;testQuestions=[]">إلغاء</button>
            </div>
            <p v-if="testSaveError" style="color:#f87171;font-size:12px;margin-top:6px">⚠️ {{ testSaveError }}</p>
          </div>

          <!-- قائمة الاختبارات -->
          <div v-if="!myTests.length" class="empty">{{ t('no_tests') }}</div>
          <div v-else class="list-col">
            <div v-for="tst in myTests" :key="tst.id" class="list-item">
              <div style="flex:1">
                <h4>{{ tst.title }}</h4>
                <div class="meta">
                  <span>📚 {{ tst.subject }}</span>
                  <span v-if="tst.grade">🎓 {{ tst.grade }}</span>
                  <span>⏱ {{ tst.duration_minutes }}د</span>
                  <span style="color:var(--accent)">❓ {{ (tst.questions||[]).length }} سؤال</span>
                </div>
              </div>
              <button class="btn-s danger" @click="deleteTest(tst.id)">{{ t('delete_btn') }}</button>
            </div>
          </div>
        </div>
      </section>

      <!-- ===== WORKSHEETS ===== -->
      <section v-show="cur==='worksheets'" class="body pad">
        <div class="card">
          <div class="row-sb"><h3>📋 أوراق العمل</h3><button class="btn-p" @click="wsForm=!wsForm">+ {{ t('add_btn') }}</button></div>
          <div v-if="wsForm" class="form-box">
            <p style="color:var(--t2);font-size:13px;margin:0 0 8px">🤖 AI يولّد ورقة العمل الكاملة — فقط أدخل الموضوع والمادة.</p>
            <input v-model="wsNew.topic" class="inp" placeholder="الموضوع المحدد *" />
            <div class="row-gap">
              <select v-if="myClasses.length" class="inp" v-model="wsClassIdx" @change="onClassPick('ws')">
                <option value="">اختر الصف / الشعبة *</option>
                <option v-for="(c,i) in myClasses" :key="i" :value="i">
                  {{ c.subject || 'مادة' }} — {{ c.grade }}{{ c.section ? ' / ' + c.section : '' }}
                </option>
              </select>
              <template v-else>
                <input v-model="wsNew.subject" class="inp" placeholder="المادة *" />
                <input v-model="wsNew.grade" class="inp" placeholder="الصف" />
              </template>
            </div>
            <div class="row-gap"><button class="btn-p" @click="createWs" :disabled="wsLoading||!wsNew.topic||!wsNew.subject">{{ wsLoading?'⏳ AI يولّد ورقة العمل...':'✨ ' + t('create_ai') }}</button><button class="btn-o" @click="wsForm=false">{{ t('cancel') }}</button></div>
          </div>
          <div v-if="!worksheets.length" class="empty">{{ t('no_worksheets') }}</div>
          <div v-else class="list-col">
            <div v-for="ws in worksheets" :key="ws.id" class="list-item clickable" @click="viewWs(ws)">
              <div style="flex:1"><h4>{{ ws.title }}</h4><div class="meta"><span>📚 {{ ws.subject }}</span><span v-if="ws.ai_generated" class="ai-tag">🤖 AI</span></div></div>
              <button class="btn-s danger" @click.stop="deleteWs(ws.id)">{{ t('delete_btn') }}</button>
            </div>
          </div>
        </div>
        <div v-if="activeWs" class="card mt">
          <div class="row-sb"><h3>{{ activeWs.title }}</h3><button class="btn-o" @click="activeWs=null">✕</button></div>
          <div style="color:var(--t2);line-height:1.8;font-size:14px;white-space:pre-wrap" v-html="fmt(activeWs.content||'')"></div>
        </div>
      </section>

      <!-- ===== STUDENTS ===== -->
      <section v-show="cur==='students'" class="body pad">
        <div class="card">
          <h3>👨‍🎓 الطلاب</h3>
          <div v-if="studLoading" class="empty">⏳ تحميل...</div>
          <div v-else-if="!students.length" class="empty">{{ t('no_students') }}</div>
          <div v-else class="list-col">
            <div v-for="s in students" :key="s.id" class="list-item">
              <div style="flex:1">
                <h4>{{ s.full_name }}</h4>
                <div class="meta">
                  <span v-if="s.grade">🎓 {{ s.grade }}</span>
                  <span v-if="s.learning_style">🧠 {{ {visual:t('visual'),auditory:t('auditory'),kinesthetic:t('kinesthetic')}[s.learning_style]||s.learning_style }}</span>
                  <span>🔥 {{ s.streak_count||0 }} يوم</span>
                  <span>⭐ {{ s.stars_count||0 }}</span>
                </div>
              </div>
              <button class="btn-s" @click="viewStudentProgress(s.id)">التقدم</button>
            </div>
          </div>
        </div>
        <div v-if="studentProgress" class="card mt">
          <div class="row-sb">
            <h3>{{ studentProgress.student?.full_name }}</h3>
            <button class="btn-o" @click="studentProgress=null">✕</button>
          </div>
          <div class="stats-grid">
            <div class="sc"><div class="sn">🔥 {{ studentProgress.streak?.current_streak||0 }}</div><div class="sl">أيام متتالية</div></div>
            <div class="sc"><div class="sn">💬 {{ studentProgress.total_conversations||0 }}</div><div class="sl">محادثات</div></div>
            <div class="sc"><div class="sn">📝 {{ studentProgress.test_results?.length||0 }}</div><div class="sl">اختبارات</div></div>
          </div>
        </div>
      </section>

      <!-- ===== PPT GENERATOR ===== -->
      <section v-show="cur==='ppt'" class="body pad">
        <div class="card">
          <h3>📊 توليد عرض PowerPoint</h3>
          <p style="color:var(--t2);font-size:13px;margin:0 0 16px">أدخل معلومات الكتاب وسيولّد الذكاء الاصطناعي مخططاً احترافياً للعرض</p>
          <div class="col-gap">
            <input v-model="pptTitle" class="inp" placeholder="عنوان الكتاب / الدرس *" />
            <input v-model="pptSubject" class="inp" placeholder="المادة الدراسية *" />
            <textarea v-model="pptContent" class="inp" rows="4" placeholder="محتوى الكتاب (اختياري — الصفحات الأولى)"></textarea>
            <button class="btn-p" @click="genPPT" :disabled="pptLoading||!pptTitle||!pptSubject">
              {{ pptLoading?'⏳ ' + t('generating'):'✨ ' + t('generate_btn') }}
            </button>
          </div>
          <div v-if="pptHtml" class="result-box" style="margin-top:16px">
            <div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap">
              <button class="btn-s" @click="downloadPpt">⬇ {{ t('download_btn') }} HTML</button>
              <button class="btn-s" @click="openPptNewTab">🔗 فتح في نافذة جديدة</button>
              <button class="btn-s" @click="copyText(pptResult)">📋 {{ t('copy_btn') }} JSON</button>
            </div>
            <iframe :srcdoc="pptHtml"
                    style="width:100%;height:600px;border:2px solid var(--accent);border-radius:16px;background:#0f172a"
                    sandbox="allow-scripts allow-same-origin allow-popups">
            </iframe>
            <p style="color:var(--t2);font-size:12px;margin-top:8px">💡 استخدم أزرار التنقل أو ← → بلوحة المفاتيح، أو زر ملء الشاشة</p>
          </div>
          <div v-if="pptSlides.length" class="result-box" style="margin-top:16px">
            <h4 style="color:var(--accent);margin-bottom:8px">📋 الشرائح كنص:</h4>
            <div v-for="slide in pptSlides" :key="slide.slide" class="ppt-slide">
              <div class="ppt-num">شريحة {{ slide.slide || (pptSlides.indexOf(slide)+1) }}</div>
              <div class="ppt-title">{{ slide.title }}</div>
              <ul class="ppt-points">
                <li v-for="pt in (slide.points || slide.bullets || [])" :key="pt">{{ pt }}</li>
              </ul>
              <div v-if="slide.notes" class="ppt-notes">💡 {{ slide.notes }}</div>
            </div>
          </div>
          <div v-else-if="pptResult && !pptHtml" class="result-box">
            <pre class="code-block">{{ pptResult }}</pre>
          </div>
        </div>
      </section>

      <!-- ===== AI CHAT ===== -->
      <section v-show="cur==='chat'" class="body">
        <div class="chat-area">
          <div class="messages" ref="chatEl">
            <div v-if="!chatMsgs.length" class="chat-welcome">
              <div style="font-size:48px;margin-bottom:14px">🤖</div>
              <h3>مساعد المعلم الذكي</h3>
              <p style="color:var(--t2)">اسأل بلهجتك — الـ AI يرد بنفس اللهجة. ويمكنك إرسال صور وملفات 📎</p>
              <div class="quick-btns">
                <button v-for="q in tQuickQs" :key="q" class="quick-btn" @click="sendTeacherMsg(q)">{{ q }}</button>
              </div>
            </div>
            <div v-for="(msg,i) in chatMsgs" :key="i" :class="['msg',msg.role]">
              <div class="msg-bubble">
                <span class="msg-icon">{{ msg.role==='user'?'👤':'🤖' }}</span>
                <div class="msg-text" v-html="fmt(msg.content)"></div>
              </div>
            </div>
            <div v-if="chatThinking" class="msg assistant"><div class="msg-bubble"><span class="msg-icon">🤖</span><div class="dots"><span></span><span></span><span></span></div></div></div>
          </div>
          <div v-if="tAttachedFile" class="attach-chip">
            <span>📎 {{ tAttachedFile.name }}</span>
            <button @click="clearTAttach">✕</button>
          </div>
          <div class="input-row">
            <input type="file" ref="tFileInputEl" accept="image/*,.pdf,.txt,.docx" @change="onTFileAttach" style="display:none" />
            <button class="attach-btn" @click="tFileInputEl.click()" title="إرفاق ملف أو صورة">📎</button>
            <textarea v-model="chatInput" rows="2" placeholder="اكتب سؤالك للمساعد الذكي..."
              @keydown.enter.exact.prevent="sendTeacherMsg()" @keydown.enter.shift.exact="chatInput+='\n'"></textarea>
            <button class="send-btn" @click="sendTeacherMsg()" :disabled="(!chatInput.trim()&&!tAttachedFile)||chatThinking">➤</button>
          </div>
        </div>
      </section>

      <!-- ===== VIDEO SCRIPT ===== -->
      <section v-show="cur==='video'" class="body pad">
        <div class="card">
          <h3>🎬 توليد سكريبت فيديو تعليمي</h3>
          <p style="color:var(--t2);font-size:13px;margin:0 0 16px">المدة من 30 ثانية حتى 10 دقائق</p>
          <div class="col-gap">
            <input v-model="vidTopic" class="inp" placeholder="موضوع الفيديو *" />
            <input v-model="vidSubject" class="inp" placeholder="المادة الدراسية" />
            <div>
              <p style="color:var(--t2);font-size:13px;margin:0 0 6px">المدة: {{ formatDur(vidSeconds) }}</p>
              <input type="range" v-model.number="vidSeconds" min="30" max="600" step="30" style="width:100%;accent-color:var(--accent)" />
              <div style="display:flex;justify-content:space-between;color:var(--t2);font-size:12px;margin-top:4px"><span>30 ثانية</span><span>10 دقائق</span></div>
            </div>
            <button class="btn-p" @click="genVid" :disabled="vidLoading||!vidTopic">
              {{ vidLoading ? '⏳ ' + t('generating') : '✨ ' + t('generate_script') }}
            </button>
          </div>
          <div v-if="vidScript" class="result-box" style="margin-top:20px">
            <div style="background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:20px;color:var(--t2);font-size:14px;line-height:1.8;white-space:pre-wrap;max-height:500px;overflow-y:auto" v-html="fmt(vidScript)"></div>
            <button class="btn-s" style="margin-top:10px" @click="copyText(vidScript)">📋 {{ t('copy_btn') }}</button>
          </div>
        </div>
      </section>

      <!-- ===== IMAGE GEN ===== -->
      <section v-show="cur==='image'" class="body pad">
        <div class="card">
          <h3>🎨 توليد الصور التعليمية</h3>
          <div class="col-gap">
            <textarea v-model="imgPrompt" class="inp" rows="3" placeholder="وصف الصورة المطلوبة..."></textarea>
            <button class="btn-p" @click="genImg" :disabled="imgLoading||!imgPrompt.trim()">{{ imgLoading?'⏳...':'✨ توليد' }}</button>
          </div>
          <div v-if="imgError" style="color:#f87171;font-size:13px;margin-top:12px">{{ imgError }}</div>
          <div v-if="genImage" style="margin-top:20px;text-align:center">
            <img :src="`data:image/png;base64,${genImage}`" style="max-width:100%;border-radius:12px" />
            <br><a :href="`data:image/png;base64,${genImage}`" download="morix.png" class="btn-s" style="display:inline-block;margin-top:10px">⬇ تحميل</a>
          </div>
        </div>
      </section>

      <!-- ============ 1️⃣ خطة درس ذكية ============ -->
      <section v-show="cur==='lesson_plan'" class="body pad">
        <div class="card">
          <h3>📋 مولد خطط الدروس التكيفي</h3>
          <input v-model="lp.topic" placeholder="موضوع الدرس" class="memorix-input" style="width:100%;margin-bottom:8px" />
          <input v-model="lp.grade" placeholder="المرحلة (مثال: الصف الخامس)" class="memorix-input" style="width:100%;margin-bottom:8px" />
          <input v-model.number="lp.duration_minutes" type="number" placeholder="المدة بالدقائق" class="memorix-input" style="width:100%;margin-bottom:8px" />
          <textarea v-model="lp.objectives" placeholder="النتائج المرجوة (اختياري)" rows="3" class="memorix-input" style="width:100%;margin-bottom:8px"></textarea>
          <button class="btn-primary" :disabled="lpLoading" @click="genLessonPlan">{{ lpLoading?'⏳ يولّد...':'🚀 ' + t('generate_plan') }}</button>
          <div v-if="lpResult" class="card mt" style="margin-top:16px">
            <h4 style="color:var(--accent)">{{ lpResult.title || 'الخطة' }}</h4>
            <div v-if="lpResult.objectives"><b>🎯 الأهداف:</b><ul><li v-for="o in lpResult.objectives" :key="o">{{o}}</li></ul></div>
            <div v-if="lpResult.warm_up"><b>🔥 التمهيد:</b><p>{{ lpResult.warm_up }}</p></div>
            <div v-if="lpResult.main_activities"><b>📚 الأنشطة الرئيسية:</b>
              <div v-for="(a,i) in lpResult.main_activities" :key="i" style="background:var(--card);padding:8px;border-radius:6px;margin:6px 0">
                <b>{{a.name}}</b> — {{a.duration}} دقيقة<br><span style="color:var(--t2)">{{a.description}}</span>
              </div>
            </div>
            <div v-if="lpResult.assessment"><b>✅ التقييم:</b><p>{{ lpResult.assessment }}</p></div>
            <div v-if="lpResult.discussion_questions"><b>❓ أسئلة نقاشية:</b><ul><li v-for="q in lpResult.discussion_questions" :key="q">{{q}}</li></ul></div>
            <div v-if="lpResult.homework"><b>🏠 الواجب:</b><p>{{ lpResult.homework }}</p></div>
            <div v-if="lpResult.materials"><b>🧰 المواد:</b><p>{{ lpResult.materials.join(' • ') }}</p></div>
            <pre v-if="lpResult.raw" style="white-space:pre-wrap">{{ lpResult.raw }}</pre>
          </div>
        </div>
      </section>

      <!-- ============ 2️⃣ محول الوسائط ============ -->
      <section v-show="cur==='multimedia'" class="body pad">
        <div class="card">
          <h3>🔄 محول الوسائط المتعددة</h3>
          <textarea v-model="mm.text" rows="6" placeholder="ألصق نص الدرس هنا..." class="memorix-input" style="width:100%;margin-bottom:8px"></textarea>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">
            <button v-for="m in [{k:'bullets',l:'📝 نقاط'},{k:'slides',l:'🎯 شرائح'},{k:'quiz',l:'❓ اختبار'},{k:'mindmap',l:'🧠 خريطة'}]"
                    :key="m.k" class="btn-s" :class="{active: mm.mode===m.k}" @click="mm.mode=m.k"
                    :style="{background: mm.mode===m.k?'var(--accent)':'var(--card)'}">{{ m.l }}</button>
          </div>
          <button class="btn-primary" :disabled="mmLoading" @click="convertMM">{{ mmLoading?'⏳':'🚀 ' + t('convert_btn') }}</button>
          <div v-if="mmResult" class="card mt" style="margin-top:16px">
            <pre v-if="typeof mmResult==='string'" style="white-space:pre-wrap;color:var(--text)">{{ mmResult }}</pre>
            <div v-else>
              <div v-if="mmResult.slides"><h4>🎯 الشرائح</h4>
                <div v-for="(s,i) in mmResult.slides" :key="i" style="background:var(--card);padding:10px;border-radius:8px;margin:6px 0">
                  <b>{{i+1}}. {{s.title}}</b><ul><li v-for="b in s.bullets" :key="b">{{b}}</li></ul>
                </div>
              </div>
              <div v-if="mmResult.questions"><h4>❓ الأسئلة</h4>
                <div v-for="(q,i) in mmResult.questions" :key="i" style="background:var(--card);padding:10px;border-radius:8px;margin:6px 0">
                  <b>{{i+1}}. {{q.q}}</b>
                  <ul><li v-for="(o,j) in q.options" :key="j" :style="{color: j===q.correct?'#10b981':'var(--text)'}">{{o}}<span v-if="j===q.correct"> ✓</span></li></ul>
                </div>
              </div>
              <div v-if="mmResult.central"><h4>🧠 خريطة المفاهيم: {{ mmResult.central }}</h4>
                <div v-for="(b,i) in mmResult.branches" :key="i" style="background:var(--card);padding:10px;border-radius:8px;margin:6px 0">
                  <b>🌿 {{b.label}}</b><ul><li v-for="s in b.sub" :key="s">{{s}}</li></ul>
                </div>
              </div>
              <pre v-if="mmResult.raw" style="white-space:pre-wrap">{{ mmResult.raw }}</pre>
            </div>
          </div>
        </div>
      </section>

      <!-- ============ 3️⃣ تصميم أنشطة ============ -->
      <section v-show="cur==='activity'" class="body pad">
        <div class="card">
          <h3>🎯 مساعد تصميم الأنشطة الصفية</h3>
          <input v-model="act.topic" placeholder="موضوع النشاط" class="memorix-input" style="width:100%;margin-bottom:8px" />
          <input v-model.number="act.student_count" type="number" placeholder="عدد الطلاب" class="memorix-input" style="width:100%;margin-bottom:8px" />
          <label style="display:block;margin-bottom:8px;color:var(--text)"><input type="checkbox" v-model="act.has_internet" /> يوجد إنترنت متاح</label>
          <select v-model="act.activity_type" class="memorix-input" style="width:100%;margin-bottom:8px">
            <option value="أي">أي نوع</option>
            <option value="حركي">حركي</option>
            <option value="جماعي">جماعي</option>
            <option value="فردي">فردي</option>
          </select>
          <textarea v-model="act.constraints" placeholder="قيود إضافية..." rows="2" class="memorix-input" style="width:100%;margin-bottom:8px"></textarea>
          <button class="btn-primary" :disabled="actLoading" @click="genActivity">{{ actLoading?'⏳':'💡 اقترح أنشطة' }}</button>
          <div v-if="actResult?.activities" class="mt" style="margin-top:16px">
            <div v-for="(a,i) in actResult.activities" :key="i" class="card" style="margin-bottom:8px">
              <h4 style="color:var(--accent)">{{i+1}}. {{a.name}} ({{a.duration_minutes}} دقيقة)</h4>
              <p><b>🧰 المواد:</b> {{ (a.materials||[]).join(' • ') }}</p>
              <ol><li v-for="s in a.steps" :key="s">{{s}}</li></ol>
              <p><b>🎯 المخرجات:</b> {{ (a.learning_outcomes||[]).join(' • ') }}</p>
            </div>
          </div>
        </div>
      </section>

      <!-- ============ 4️⃣ صياغة رسائل ============ -->
      <section v-show="cur==='compose'" class="body pad">
        <div class="card">
          <h3>✉️ مساعد صياغة الرسائل</h3>
          <select v-model="cm.recipient" class="memorix-input" style="width:100%;margin-bottom:8px">
            <option value="ولي الأمر">ولي الأمر</option>
            <option value="الإدارة">الإدارة</option>
            <option value="زميل معلم">زميل معلم</option>
          </select>
          <select v-model="cm.tone" class="memorix-input" style="width:100%;margin-bottom:8px">
            <option value="ودودة">ودودة</option>
            <option value="رسمية">رسمية</option>
            <option value="حازمة">حازمة</option>
          </select>
          <input v-model="cm.student_name" placeholder="اسم الطالب (اختياري)" class="memorix-input" style="width:100%;margin-bottom:8px" />
          <textarea v-model="cm.purpose" rows="2" placeholder="غرض الرسالة..." class="memorix-input" style="width:100%;margin-bottom:8px"></textarea>
          <textarea v-model="cm.notes" rows="3" placeholder="ملاحظات إضافية..." class="memorix-input" style="width:100%;margin-bottom:8px"></textarea>
          <button class="btn-primary" :disabled="cmLoading" @click="composeMsg">{{ cmLoading?'⏳':'✍️ ' + t('compose_msg') }}</button>
          <div v-if="cmResult" class="card mt" style="margin-top:16px;white-space:pre-wrap;line-height:1.8">{{ cmResult }}</div>
        </div>
      </section>

      <!-- ============ 5️⃣ تقارير ذكية ============ -->
      <section v-show="cur==='feedback'" class="body pad">
        <div class="card">
          <h3>📝 أتمتة التقارير التربوية</h3>
          <input v-model="fb.student_name" placeholder="اسم الطالب" class="memorix-input" style="width:100%;margin-bottom:8px" />
          <input v-model="fb.subject" placeholder="المادة" class="memorix-input" style="width:100%;margin-bottom:8px" />
          <textarea v-model="fb.strengths" rows="2" placeholder="نقاط القوة (اكتب بسرعة، AI ينظمها)" class="memorix-input" style="width:100%;margin-bottom:8px"></textarea>
          <textarea v-model="fb.weaknesses" rows="2" placeholder="نقاط الضعف (اكتب بسرعة، AI ينظمها)" class="memorix-input" style="width:100%;margin-bottom:8px"></textarea>
          <button class="btn-primary" :disabled="fbLoading" @click="genFeedback">{{ fbLoading?'⏳':'📋 ' + t('generate_report') }}</button>
          <div v-if="fbResult" class="card mt" style="margin-top:16px;white-space:pre-wrap;line-height:1.8">{{ fbResult }}</div>
        </div>
      </section>

      <!-- ============ 6️⃣ تحليل الأداء ============ -->
      <section v-show="cur==='insights'" class="body pad">
        <div class="card">
          <h3>📊 محلل بيانات الأداء</h3>
          <button class="btn-primary" :disabled="insLoading" @click="loadInsights">{{ insLoading?'⏳':'🔍 حلّل الآن' }}</button>
          <div v-if="insights" style="margin-top:16px">
            <div v-if="insights.alert" style="padding:12px;background:rgba(251,191,36,.15);border:1px solid #fbbf24;border-radius:8px;margin-bottom:12px;color:#fbbf24">
              {{ insights.alert }}
            </div>
            <div class="stats-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px">
              <div class="card"><b>👥 الطلاب</b><div style="font-size:24px">{{ insights.total_students }}</div></div>
              <div class="card"><b>📊 المتوسط</b><div style="font-size:24px">{{ insights.avg_score }}%</div></div>
              <div class="card"><b>⚠️ مواضيع ضعف</b><div style="font-size:24px">{{ insights.weak_topics?.length || 0 }}</div></div>
              <div class="card"><b>✅ مواضيع قوة</b><div style="font-size:24px">{{ insights.strong_topics?.length || 0 }}</div></div>
            </div>
            <div v-if="insights.weak_topics?.length" class="mt" style="margin-top:12px">
              <h4 style="color:#ef4444">⚠️ نقاط الضعف</h4>
              <div v-for="t in insights.weak_topics" :key="t.topic" class="card" style="margin:4px 0">
                {{ t.topic }} — متوسط: <b>{{ t.avg }}%</b>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ============ 7️⃣ تبسيط المحتوى ============ -->
      <section v-show="cur==='simplify'" class="body pad">
        <div class="card">
          <h3>🔍 مبسط المحتوى</h3>
          <textarea v-model="sm.text" rows="5" placeholder="النص المراد تبسيطه..." class="memorix-input" style="width:100%;margin-bottom:8px"></textarea>
          <select v-model="sm.level" class="memorix-input" style="width:100%;margin-bottom:8px">
            <option value="beginner">🟢 مبتدئ (صعوبات تعلم)</option>
            <option value="intermediate">🟡 متوسط</option>
            <option value="advanced">🔴 متقدم</option>
          </select>
          <button class="btn-primary" :disabled="smLoading" @click="simplify">{{ smLoading?'⏳':'✨ ' + t('simplify_btn') }}</button>
          <div v-if="smResult" class="card mt" style="margin-top:16px;white-space:pre-wrap;line-height:1.8">{{ smResult }}</div>
        </div>
      </section>

      <!-- ============ 8️⃣ تعلم متمايز ============ -->
      <section v-show="cur==='differentiate'" class="body pad">
        <div class="card">
          <h3>🌈 استراتيجيات التعلم المتمايز</h3>
          <input v-model="diff.concept" placeholder="المفهوم التعليمي" class="memorix-input" style="width:100%;margin-bottom:8px" />
          <button class="btn-primary" :disabled="diffLoading" @click="genDiff">{{ diffLoading?'⏳':'🎨 ' + t('suggest_methods') }}</button>
          <div v-if="diffResult" class="mt" style="margin-top:16px;display:grid;gap:8px">
            <div v-if="diffResult.visual" class="card" style="border-right:4px solid #6366f1">
              <h4>👁️ بصري</h4>
              <p><b>الأسلوب:</b> {{ diffResult.visual.approach }}</p>
              <p><b>النشاط:</b> {{ diffResult.visual.activity }}</p>
              <p><b>الأدوات:</b> {{ (diffResult.visual.tools||[]).join(' • ') }}</p>
            </div>
            <div v-if="diffResult.auditory" class="card" style="border-right:4px solid #10b981">
              <h4>👂 سمعي</h4>
              <p><b>الأسلوب:</b> {{ diffResult.auditory.approach }}</p>
              <p><b>النشاط:</b> {{ diffResult.auditory.activity }}</p>
              <p><b>الأدوات:</b> {{ (diffResult.auditory.tools||[]).join(' • ') }}</p>
            </div>
            <div v-if="diffResult.kinesthetic" class="card" style="border-right:4px solid #f59e0b">
              <h4>✋ حركي</h4>
              <p><b>الأسلوب:</b> {{ diffResult.kinesthetic.approach }}</p>
              <p><b>النشاط:</b> {{ diffResult.kinesthetic.activity }}</p>
              <p><b>الأدوات:</b> {{ (diffResult.kinesthetic.tools||[]).join(' • ') }}</p>
            </div>
            <pre v-if="diffResult.raw" style="white-space:pre-wrap">{{ diffResult.raw }}</pre>
          </div>
        </div>
      </section>

      <!-- ============ 9️⃣ مدرب تربوي ============ -->
      <section v-show="cur==='coach'" class="body pad">
        <div class="card">
          <h3>🧠 الموجه التربوي الذكي</h3>
          <textarea v-model="coachInput" rows="4" placeholder="اوصف التحدي الصفي..." class="memorix-input" style="width:100%;margin-bottom:8px"></textarea>
          <button class="btn-primary" :disabled="coachLoading" @click="askCoach">{{ coachLoading?'⏳':'💬 ' + t('get_advice') }}</button>
          <div v-if="coachAdvice" class="card mt" style="margin-top:16px;white-space:pre-wrap;line-height:1.8">{{ coachAdvice }}</div>
        </div>
      </section>

      <!-- ============ 🔟 أبحاث تربوية ============ -->
      <section v-show="cur==='research'" class="body pad">
        <div class="card">
          <h3>📰 ملخصات الأبحاث التربوية</h3>
          <button class="btn-primary" :disabled="rdLoading" @click="loadResearch">{{ rdLoading?'⏳':'📡 احصل على ملخصات هذا الأسبوع' }}</button>
          <div v-if="rdResult?.digest?.length" class="mt" style="margin-top:16px">
            <div v-for="(r,i) in rdResult.digest" :key="i" class="card" style="margin-bottom:8px">
              <h4 style="color:var(--accent)">{{i+1}}. {{r.title}}</h4>
              <p style="color:var(--text)">{{r.summary}}</p>
              <p style="color:#10b981"><b>💡 نصيحة:</b> {{r.actionable_tip}}</p>
              <small style="color:var(--t2)">{{r.source_type}}</small>
            </div>
          </div>
          <pre v-else-if="rdResult?.raw" style="white-space:pre-wrap;margin-top:16px">{{ rdResult.raw }}</pre>
        </div>
      </section>

      <!-- ============ 1️⃣1️⃣ مكتبة قوالب ============ -->
      <section v-show="cur==='prompts'" class="body pad">
        <div class="card">
          <h3>📚 مكتبة قوالب الـ Prompts</h3>
          <p style="color:var(--t2);margin-bottom:12px">انسخ القالب وعدّل ما بين [الأقواس] ثم استخدمه في مساعد AI</p>
          <button v-if="!promptCats.length" class="btn-primary" :disabled="plLoading" @click="loadPrompts">{{ plLoading?'⏳':'📥 حمّل المكتبة' }}</button>
          <div v-for="cat in promptCats" :key="cat.name" style="margin-top:16px">
            <h4 style="color:var(--accent)">{{cat.name}}</h4>
            <div v-for="p in cat.prompts" :key="p.title" class="card" style="margin:6px 0;background:var(--card)">
              <b>{{p.title}}</b>
              <p style="color:var(--t2);font-size:13px;margin:6px 0">{{p.template}}</p>
              <button class="btn-s" @click="copyPrompt(p.template)">📋 نسخ</button>
            </div>
          </div>
        </div>
      </section>

      <!-- ===== 📚 المكتبة الرقمية (داخل المنصة) ===== -->
      <section v-show="cur==='library'" class="body pad">
        <div class="card">
          <h3>📚 المكتبة الرقمية المجانية للمعلمين</h3>
          <p style="color:var(--t2);margin-bottom:12px">المراجع والكتب التربوية تفتح داخل المنصة</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
            <button v-for="src in libSources" :key="src.url"
                    @click="libUrl = src.url"
                    class="btn-s"
                    :style="{background: libUrl===src.url?'var(--accent)':'var(--card)',padding:'8px 14px'}">
              {{ src.icon }} {{ src.label }}
            </button>
          </div>
          <div style="background:var(--card);border-radius:12px;overflow:hidden;border:1px solid var(--border)">
            <iframe :src="proxiedLibUrl"
                    style="width:100%;height:80vh;border:none;background:#fff"
                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                    referrerpolicy="no-referrer"
                    loading="lazy">
            </iframe>
          </div>
          <p style="color:var(--t2);font-size:12px;margin-top:8px">💡 المكتبة تفتح داخل المنصة عبر بروكسي Morix</p>
        </div>
      </section>

      <!-- ===== 📓 دفتري الذكي (NotebookLM-like) ===== -->
      <section v-show="cur==='notebook'" class="body pad">
        <div class="card">
          <h3>📓 دفتري الذكي للمعلم — Morix Notebook</h3>
          <p style="color:var(--t2);margin-bottom:12px">ارفع المنهج/المرجع وولّد ملخصات، أسئلة، خرائط، وبودكاست AI داخل المنصة</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
            <button @click="nbTab='upload'" class="btn-s" :style="{background:nbTab==='upload'?'var(--accent)':'var(--card)',padding:'8px 14px'}">{{ nbExtractLoading ? '⏳' : '📤' }} {{ t('upload_file') }}</button>
            <button @click="nbTab='ask'" :disabled="!nbFileText||nbExtractLoading" class="btn-s" :style="{background:nbTab==='ask'?'var(--accent)':'var(--card)',padding:'8px 14px',opacity:nbFileText&&!nbExtractLoading?1:0.5}">💬 {{ t('ask_about_file') }}</button>
            <button @click="nbTab='generate'" :disabled="!nbFileText||nbExtractLoading" class="btn-s" :style="{background:nbTab==='generate'?'var(--accent)':'var(--card)',padding:'8px 14px',opacity:nbFileText&&!nbExtractLoading?1:0.5}">✨ {{ t('generate_content') }}</button>
          </div>

          <div v-if="nbTab==='upload'" class="card" style="background:var(--card)">
            <input ref="nbFileInput" type="file" accept=".pdf,.txt,.md,.pptx,.docx" @change="onNbFileUpload" style="display:none" />
            <button @click="$refs.nbFileInput?.click()" class="btn-p" style="width:100%;padding:24px;font-size:16px" :disabled="nbExtractLoading">
              {{ nbExtractLoading ? '⏳ ' + t('extracting_text') : '📤 اختر ملف PDF / PPTX / DOCX / TXT' }}
            </button>
            <div v-if="nbFileName && nbFileText" style="margin-top:12px;padding:12px;background:var(--bg3);border-radius:8px;border:1px solid var(--accent)">
              ✅ <b>{{ nbFileName }}</b> — جاهز ({{ Math.round(nbFileText.length/1000) }}K حرف)
            </div>
            <div v-if="nbExtractError" style="margin-top:10px;padding:10px;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);border-radius:8px;color:#f87171;font-size:13px">
              ⚠️ {{ nbExtractError }}
            </div>
          </div>

          <div v-if="nbTab==='ask'" class="card" style="background:var(--card)">
            <div style="max-height:50vh;overflow-y:auto;padding:8px;margin-bottom:12px">
              <div v-for="(m,i) in nbChat" :key="i" :style="{padding:'10px',marginBottom:'8px',borderRadius:'8px',background: m.role==='user'?'rgba(99,102,241,.15)':'var(--bg3)',borderRight: m.role==='user'?'3px solid var(--accent)':'3px solid #10b981'}">
                <b>{{ m.role==='user'?'🙋 أنت':'🤖 Morix' }}:</b>
                <div style="white-space:pre-wrap;margin-top:4px">{{ m.text }}</div>
              </div>
            </div>
            <div style="display:flex;gap:8px">
              <input v-model="nbInput" @keyup.enter="askNb" placeholder="اسأل سؤالاً عن الملف..." class="inp" style="flex:1" />
              <button @click="askNb" :disabled="nbAsking || !nbInput.trim()" class="btn-p">{{ nbAsking?'⏳':'➤' }}</button>
            </div>
          </div>

          <div v-if="nbTab==='generate'" class="card" style="background:var(--card)">
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px;margin-bottom:12px">
              <button @click="genNb('summary')" :disabled="nbGenLoading" class="btn-p">📝 {{ t('comprehensive_summary') }}</button>
              <button @click="genNb('lesson_plan')" :disabled="nbGenLoading" class="btn-p">📋 {{ t('lesson_plan') }}</button>
              <button @click="genNb('mcq_test')" :disabled="nbGenLoading" class="btn-p">📝 MCQ {{ t('tests') }}</button>
              <button @click="genNb('worksheet')" :disabled="nbGenLoading" class="btn-p">📄 {{ t('worksheets') }}</button>
              <button @click="genNb('mindmap')" :disabled="nbGenLoading" class="btn-p">🧠 {{ t('mind_map') }}</button>
              <button @click="genNb('podcast')" :disabled="nbGenLoading" class="btn-p">🎙️ {{ t('podcast_script') }}</button>
            </div>
            <div v-if="nbGenLoading" style="text-align:center;padding:20px;color:var(--t2)">⏳ {{ t('generating') }}</div>
            <div v-if="nbGenResult" style="padding:16px;background:var(--bg3);border-radius:8px;white-space:pre-wrap;line-height:1.8;max-height:60vh;overflow-y:auto">{{ nbGenResult }}</div>
          </div>
        </div>
      </section>

      <!-- ===== SETTINGS ===== -->
      <section v-show="cur==='settings'" class="body pad">
        <div class="settings-grid">
          <div class="card">
            <h3>👤 معلومات الحساب</h3>
            <div class="avatar-section">
              <div>
                <svg v-if="tSettings.avatar_url && avatarMap[tSettings.avatar_url]" viewBox="0 0 80 80" width="64" height="64">
                  <circle cx="40" cy="40" r="38" :fill="avatarMap[tSettings.avatar_url].bg"/>
                  <circle cx="40" cy="32" r="16" :fill="avatarMap[tSettings.avatar_url].skin"/>
                  <ellipse cx="40" cy="62" rx="22" ry="16" :fill="avatarMap[tSettings.avatar_url].outfit"/>
                  <path :d="avatarMap[tSettings.avatar_url].hair" :fill="avatarMap[tSettings.avatar_url].hairColor"/>
                </svg>
                <div v-else class="av-big">{{ firstName[0] }}</div>
              </div>
            </div>
            <div class="avatar-grid">
              <div v-for="av in avatarOptions" :key="av.id"
                   class="avatar-option" :class="{ selected: tSettings.avatar_url === av.id }"
                   @click="selectAvatar(av.id)">
                <svg viewBox="0 0 80 80" width="56" height="56">
                  <circle cx="40" cy="40" r="38" :fill="av.bg"/>
                  <circle cx="40" cy="32" r="16" :fill="av.skin"/>
                  <ellipse cx="40" cy="62" rx="22" ry="16" :fill="av.outfit"/>
                  <path :d="av.hair" :fill="av.hairColor"/>
                </svg>
              </div>
            </div>
            <div class="info-row"><span>الاسم</span><b>{{ tSettings.full_name }}</b></div>
            <div class="info-row"><span>الإيميل</span><b>{{ tSettings.email }}</b></div>
            <div class="info-row"><span>الدور</span><b>معلم</b></div>
          </div>
          <div class="card">
            <h3>🎨 المظهر</h3>
            <p style="color:var(--t2);font-size:13px;margin:0 0 10px">الثيم</p>
            <div class="theme-row">
              <button :class="['t-btn',{active:tSettings.theme==='dark'}]" @click="tSettings.theme='dark';saveTeacherSettings()">🌑 داكن</button>
              <button :class="['t-btn',{active:tSettings.theme==='light'}]" @click="tSettings.theme='light';saveTeacherSettings()">☀️ فاتح</button>
              <button :class="['t-btn',{active:tSettings.theme==='library'}]" @click="tSettings.theme='library';saveTeacherSettings()">📚 مكتبة</button>
            </div>
          </div>
          <div class="card">
            <h3>🌐 اللغة / Language</h3>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px">
              <button v-for="(L, code) in languages" :key="code"
                      @click="changeTeacherLang(code)"
                      :style="{padding:'10px',borderRadius:'10px',border:`2px solid ${tSettings.language===code?'var(--accent)':'var(--border)'}`,background:tSettings.language===code?'rgba(99,102,241,.15)':'var(--card)',color:'var(--text)',cursor:'pointer',fontWeight:600}">
                {{ L.flag }} {{ L.name }}
              </button>
            </div>
          </div>
        </div>
        <p v-if="settingsMsg" style="color:#4ade80;font-size:13px;margin-top:10px;text-align:center">{{ settingsMsg }}</p>
      </section>

    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useAuthStore } from '../stores/auth.js'
import { useRouter } from 'vue-router'
import { teacherAPI, aiAPI } from '../api.js'
import { useTheme } from '../composables/useTheme.js'
import { useI18n, LANGUAGES } from '../composables/useI18n.js'
import MatrixBackground from '../components/MatrixBackground.vue'
import NavBar from '../components/NavBar.vue'
import LiveClass from '../components/LiveClass.vue'

const auth = useAuthStore()
const router = useRouter()
const firstName = ref(auth.user?.full_name?.split(' ')?.[0] || 'معلم')

// 📡 البث المباشر
const liveOverlay = ref(false)
const liveRoom = ref('')
const liveTitle = ref('')
const liveStartOpen = ref(false)
const liveClasses = ref([])
const livePickIdx = ref(0)
const liveBusy = ref(false)
async function openLiveStart() {
  try { const r = await teacherAPI.getMyClasses(); liveClasses.value = r.data || [] } catch {}
  livePickIdx.value = 0
  liveStartOpen.value = true
}
async function doStartLive() {
  const c = liveClasses.value[livePickIdx.value]
  if (!c) return
  liveBusy.value = true
  try {
    const r = await teacherAPI.startLive({ grade: c.grade, section: c.section, subject: c.subject })
    liveRoom.value = r.data.room
    liveTitle.value = 'حصة ' + (c.subject || '') + ' — ' + (c.grade || '') + ' ' + (c.section || '')
    liveStartOpen.value = false
    liveOverlay.value = true
  } catch (e) { alert('تعذّر بدء البث') } finally { liveBusy.value = false }
}
async function endLiveSession() {
  liveOverlay.value = false
  try { await teacherAPI.endLive() } catch {}
}

// Settings
const tSettings = ref({ theme:'dark', language:'ar', notifications_enabled:true, avatar_url:'', email:'', full_name:'' })

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
useTheme(tSettings)
const { t, lang, setLang: setTLang } = useI18n()
const languages = LANGUAGES
function changeTeacherLang(code) {
  tSettings.value.language = code
  setTLang(code)
  saveTeacherSettings()
}
const settingsMsg = ref('')

const sections = computed(() => [
  { id:'overview',     svg:'<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7A1 1 0 003 11h1v6a1 1 0 001 1h4v-5h2v5h4a1 1 0 001-1v-6h1a1 1 0 00.707-1.707l-7-7z"/></svg>', label: t('overview') },
  { id:'homework',     svg:'<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M2 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1H3a1 1 0 01-1-1V4zm5-1a1 1 0 00-1 1v12a1 1 0 001 1h2a1 1 0 001-1V4a1 1 0 00-1-1H7zm5 0a1 1 0 00-.8.4l4 12a1 1 0 001.2.6l1.9-.6a1 1 0 00.6-1.2l-4-12a1 1 0 00-1.2-.6L12.2 3z"/></svg>', label: t('homework') },
  { id:'tests',        svg:'<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M9 2a1 1 0 00-1 1v1H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V6a2 2 0 00-2-2h-2V3a1 1 0 00-1-1H9zm0 2h2v1H9V4zM7 8h6v1H7V8zm0 3h6v1H7v-1zm0 3h4v1H7v-1z"/></svg>', label: t('tests') },
  { id:'worksheets',   svg:'<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M9 2a1 1 0 00-1 1v1H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V6a2 2 0 00-2-2h-2V3a1 1 0 00-1-1H9zm0 2h2v1H9V4zM7 8h6v1H7V8zm0 3h6v1H7v-1zm0 3h4v1H7v-1z"/></svg>', label: t('worksheets') },
  { id:'students',     svg:'<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M7 8a4 4 0 108 0 4 4 0 00-8 0zm0 2a6 6 0 00-6 6v1h20v-1a6 6 0 00-6-6H7z"/></svg>', label: t('students') },
  { id:'ppt',          svg:'<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M2 11h3v6H2zm5-4h3v10H7zm5-5h3v15h-3z"/></svg>', label: t('ppt_generator') },
  { id:'video',        svg:'<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zm12.55 1.17l3.78-2.52A1 1 0 0120 5.5v9a1 1 0 01-1.67.75l-3.78-2.52V7.17z"/></svg>', label: t('video_script') },
  { id:'chat',         svg:'<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M18 10c0 3.87-3.58 7-8 7a8.8 8.8 0 01-3.8-.85L2 18l1.3-3.5A6.6 6.6 0 012 10c0-3.87 3.58-7 8-7s8 3.13 8 7zM7 9H5v2h2V9zm4 0H9v2h2V9zm4 0h-2v2h2V9z"/></svg>', label: t('ai_assistant') },
  { id:'image',        svg:'<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"/><circle cx="13.5" cy="7.5" r="1.5"/></svg>', label: t('image_gen') },
  { id:'lesson_plan',  svg:'<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M9 2a1 1 0 00-1 1v1H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V6a2 2 0 00-2-2h-2V3a1 1 0 00-1-1H9zm0 2h2v1H9V4zM7 8h6v1H7V8zm0 3h6v1H7v-1zm0 3h4v1H7v-1z"/></svg>', label: t('lesson_plan') },
  { id:'multimedia',   svg:'<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"/><circle cx="13.5" cy="7.5" r="1.5"/></svg>', label: t('multimedia') },
  { id:'activity',     svg:'<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M11.3 1.05a1 1 0 00-1.1.45L5.7 9H2a1 1 0 00-.8 1.6l7.5 10a1 1 0 001.8-.6L9.7 13H18a1 1 0 00.8-1.6l-7.5-10.35z"/></svg>', label: t('activity') },
  { id:'compose',      svg:'<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884zM18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/></svg>', label: t('compose') },
  { id:'feedback',     svg:'<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M9 2a1 1 0 00-1 1v1H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V6a2 2 0 00-2-2h-2V3a1 1 0 00-1-1H9zm0 2h2v1H9V4zM7 8h6v1H7V8zm0 3h6v1H7v-1zm0 3h4v1H7v-1z"/></svg>', label: t('smart_feedback') },
  { id:'insights',     svg:'<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M2 11h3v6H2zm5-4h3v10H7zm5-5h3v15h-3z"/></svg>', label: t('insights') },
  { id:'simplify',     svg:'<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"/></svg>', label: t('simplify') },
  { id:'differentiate',svg:'<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M4 2a2 2 0 00-2 2v11a3 3 0 106 0V4a2 2 0 00-2-2H4zm1 14a1 1 0 100-2 1 1 0 000 2zm5-14a1 1 0 00-1 1v1.4l7.92 4.03a1 1 0 01.08 1.7L10 14.3V17a1 1 0 002 0v-1.9l5.58-3.57a3 3 0 00-.24-5.1L10 2.87V3z"/></svg>', label: t('differentiate') },
  { id:'coach',        svg:'<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M10 2a6 6 0 00-6 6c0 2.2 1.2 4.2 3 5.2V15a1 1 0 001 1h4a1 1 0 001-1v-1.8c1.8-1 3-3 3-5.2a6 6 0 00-6-6zm-1 15h2v1a1 1 0 01-2 0v-1z"/></svg>', label: t('coach') },
  { id:'research',     svg:'<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M2 5a2 2 0 012-2h8a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm3 1h6v2H5V6zm0 3h6v1H5V9zm0 2h4v1H5v-1z"/></svg>', label: t('research') },
  { id:'prompts',      svg:'<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M2 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1H3a1 1 0 01-1-1V4zm5-1a1 1 0 00-1 1v12a1 1 0 001 1h2a1 1 0 001-1V4a1 1 0 00-1-1H7zm5 0a1 1 0 00-.8.4l4 12a1 1 0 001.2.6l1.9-.6a1 1 0 00.6-1.2l-4-12a1 1 0 00-1.2-.6L12.2 3z"/></svg>', label: t('prompt_library') },
  { id:'library',      svg:'<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M2 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1H3a1 1 0 01-1-1V4zm5-1a1 1 0 00-1 1v12a1 1 0 001 1h2a1 1 0 001-1V4a1 1 0 00-1-1H7zm5 0a1 1 0 00-.8.4l4 12a1 1 0 001.2.6l1.9-.6a1 1 0 00.6-1.2l-4-12a1 1 0 00-1.2-.6L12.2 3z"/></svg>', label: t('digital_library') },
  { id:'notebook',     svg:'<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V4a2 2 0 00-2-2H6zm1 2h6v1H7V4zm0 3h6v1H7V7zm0 3h4v1H7v-1z"/></svg>', label: t('notebook') },
  { id:'settings',     svg:'<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M11.5 2.6l.8 1.5a1 1 0 001 .5l1.6-.2a8 8 0 011.5 1.5l-.2 1.6a1 1 0 00.5 1l1.5.8v2.1l-1.5.8a1 1 0 00-.5 1l.2 1.6a8 8 0 01-1.5 1.5l-1.6-.2a1 1 0 00-1 .5l-.8 1.5H8.5l-.8-1.5a1 1 0 00-1-.5l-1.6.2a8 8 0 01-1.5-1.5l.2-1.6a1 1 0 00-.5-1L1.8 11V8.9l1.5-.8a1 1 0 00.5-1l-.2-1.6a8 8 0 011.5-1.5l1.6.2a1 1 0 001-.5l.8-1.5h3zM10 7a3 3 0 100 6 3 3 0 000-6z"/></svg>', label: t('settings') },
])

const cur = ref('overview')
const sb = ref(false)
const mobileOpen = ref(false)

// الصفوف والشُّعب المكلّف بها المعلم
const myClasses = ref([])
const hwClassIdx = ref('')
async function loadMyClasses() {
  try { myClasses.value = (await teacherAPI.getMyClasses()).data || [] } catch { myClasses.value = [] }
}
function onClassPick(which) {
  const idx = which === 'hw' ? hwClassIdx.value : (which === 'test' ? testClassIdx.value : wsClassIdx.value)
  if (idx === '' || idx == null) return
  const c = myClasses.value[idx]
  if (!c) return
  const target = which === 'hw' ? hwNew : (which === 'test' ? testNew : wsNew)
  target.value.subject = c.subject || ''
  target.value.grade = c.grade || ''
  target.value.section = c.section || ''
}

const homework = ref([])
const hwForm = ref(false)
const hwLoading = ref(false)
const hwNew = ref({topic:'',subject:'',grade:'',section:'',due_date:''})
const submissions = ref([])

const myTests = ref([])
const testForm = ref(false)
const testLoading = ref(false)
const testSaveError = ref('')
const testNew = ref({title:'',subject:'',grade:'',section:'',duration_minutes:60})
const testClassIdx = ref('')

// بانية الأسئلة اليدوية
const testQuestions = ref([])
function _emptyQ() {
  return { question:'', options:{a:'',b:'',c:'',d:''}, answer:'', explanation:'' }
}
function addQuestion() { testQuestions.value.push(_emptyQ()) }
function addQuestionBlock(n) { for(let i=0;i<n;i++) testQuestions.value.push(_emptyQ()) }
function removeQuestion(i) { testQuestions.value.splice(i,1) }

const worksheets = ref([])
const wsForm = ref(false)
const wsLoading = ref(false)
const wsNew = ref({topic:'',subject:'',grade:'',section:''})
const wsClassIdx = ref('')

// Video
const vidTopic = ref('')
const vidSubject = ref('')
const vidSeconds = ref(300)
const vidLoading = ref(false)
const vidScript = ref('')
const activeWs = ref(null)

const students = ref([])
const studLoading = ref(false)
const studentProgress = ref(null)

const pptTitle = ref('')
const pptSubject = ref('')
const pptContent = ref('')
const pptLoading = ref(false)
const pptResult = ref('')
const pptSlides = ref([])

const chatMsgs = ref([])
const chatInput = ref('')
const chatThinking = ref(false)
const chatEl = ref(null)
const tQuickQs = ['كيف أصمم درساً تفاعلياً؟','اقترح 5 أسئلة اختبار','اكتب خطة درس في 30 دقيقة','استراتيجيات لإدارة الفصل']

// Avatar upload

// Teacher chat attachments
const tFileInputEl = ref(null)
const tAttachedFile = ref(null)
const tAttachedBase64 = ref(null)
const tAttachedFileText = ref(null)

const imgPrompt = ref('')
const imgLoading = ref(false)
const genImage = ref(null)
const imgError = ref('')

onMounted(async () => {
  await Promise.all([loadHomework(), loadTests(), loadWorksheets(), loadStudents(), loadTeacherSettings(), loadMyClasses()])
})

async function loadTeacherSettings() {
  try { tSettings.value = { ...tSettings.value, ...(await teacherAPI.getSettings()).data } } catch {}
}
async function saveTeacherSettings() {
  try { await teacherAPI.updateSettings(tSettings.value); settingsMsg.value='✅ تم الحفظ'; setTimeout(()=>{settingsMsg.value=''},2000) } catch {}
}
function selectAvatar(id) {
  tSettings.value.avatar_url = id
  saveTeacherSettings()
}

function _compressImage(file, maxW, maxH, quality) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = ev => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let w = img.width, h = img.height
        if(w > maxW || h > maxH) {
          const ratio = Math.min(maxW/w, maxH/h)
          w = Math.round(w*ratio); h = Math.round(h*ratio)
        }
        canvas.width = w; canvas.height = h
        canvas.getContext('2d').drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.src = ev.target.result
    }
    reader.readAsDataURL(file)
  })
}

async function loadHomework() { try { homework.value=(await teacherAPI.getHomework()).data } catch {} }
async function loadTests() { try { myTests.value=(await teacherAPI.getTests()).data } catch {} }
async function loadWorksheets() { try { worksheets.value=(await teacherAPI.getWorksheets()).data } catch {} }
async function loadStudents() { studLoading.value=true; try { students.value=(await teacherAPI.getStudents()).data } catch {} finally { studLoading.value=false } }

async function createHw() {
  hwLoading.value=true
  try {
    await teacherAPI.createHomework({ ...hwNew.value, ai_generate: true })
    hwForm.value=false; hwNew.value={topic:'',subject:'',grade:'',section:'',due_date:''}; hwClassIdx.value=''; await loadHomework()
  } catch {} finally { hwLoading.value=false }
}
async function deleteHw(id) { try { await teacherAPI.deleteHomework(id); await loadHomework() } catch {} }
async function viewSubmissions(id) { try { submissions.value=(await teacherAPI.getSubmissions(id)).data } catch {} }

async function createTest() {
  testSaveError.value = ''
  // تحقق من اكتمال كل سؤال
  for(let i=0;i<testQuestions.value.length;i++) {
    const q = testQuestions.value[i]
    if(!q.question.trim()) { testSaveError.value=`السؤال ${i+1} فارغ`; return }
    if(!q.options.a||!q.options.b||!q.options.c||!q.options.d) { testSaveError.value=`أكمل خيارات السؤال ${i+1}`; return }
    if(!q.answer) { testSaveError.value=`حدد الإجابة الصحيحة للسؤال ${i+1}`; return }
  }
  testLoading.value=true
  try {
    const questions = testQuestions.value.map((q,i) => ({
      id: i+1,
      question: q.question.trim(),
      options: q.options,
      answer: q.answer,
      explanation: q.explanation.trim() || undefined
    }))
    await teacherAPI.createTest({
      title: testNew.value.title,
      subject: testNew.value.subject,
      grade: testNew.value.grade,
      section: testNew.value.section,
      duration_minutes: testNew.value.duration_minutes || 60,
      questions,
      ai_generate: false
    })
    testForm.value=false
    testNew.value={title:'',subject:'',grade:'',section:'',duration_minutes:60}
    testClassIdx.value=''
    testQuestions.value=[]
    await loadTests()
  } catch(e) {
    testSaveError.value = e.response?.data?.detail || 'فشل حفظ الاختبار'
  } finally { testLoading.value=false }
}
async function deleteTest(id) { try { await teacherAPI.deleteTest(id); await loadTests() } catch {} }

async function createWs() {
  wsLoading.value=true
  try {
    await teacherAPI.createWorksheet({ ...wsNew.value, ai_generate: true, title: `ورقة عمل — ${wsNew.value.topic}` })
    wsForm.value=false; wsNew.value={topic:'',subject:'',grade:'',section:''}; wsClassIdx.value=''; await loadWorksheets()
  } catch {} finally { wsLoading.value=false }
}

async function genVid() {
  vidLoading.value=true; vidScript.value=''
  try { const r=await teacherAPI.generateVideo({topic:vidTopic.value,subject:vidSubject.value,duration_seconds:vidSeconds.value}); vidScript.value=r.data.script }
  catch { vidScript.value='تعذر توليد السكريبت.' }
  finally { vidLoading.value=false }
}

function formatDur(secs) {
  const m=Math.floor(secs/60); const s=secs%60
  if(m===0) return `${s} ثانية`
  if(s===0) return `${m} ${m===1?'دقيقة':'دقائق'}`
  return `${m} ${m===1?'دقيقة':'دقائق'} و${s} ثانية`
}
async function deleteWs(id) { try { await teacherAPI.deleteWorksheet(id); await loadWorksheets() } catch {} }
function viewWs(ws) { activeWs.value=ws }

async function viewStudentProgress(id) { try { studentProgress.value=(await teacherAPI.getStudentProgress(id)).data } catch {} }

async function genPPT() {
  pptLoading.value=true; pptResult.value=''; pptSlides.value=[]; pptHtml.value=''
  try {
    const r = await teacherAPI.generatePPT({title:pptTitle.value,subject:pptSubject.value,content:pptContent.value})
    pptResult.value = typeof r.data.outline === 'string' ? r.data.outline : JSON.stringify(r.data.outline, null, 2)
    pptHtml.value = r.data.html || ''
    // استخراج الشرائح كنص
    try {
      const parsed = typeof r.data.outline === 'string' ? JSON.parse(r.data.outline) : r.data.outline
      pptSlides.value = parsed.slides || (Array.isArray(parsed) ? parsed : [])
    } catch { pptSlides.value = [] }
  }
  catch (e) { pptResult.value='تعذر توليد المخطط. تأكد من صلاحية مفتاح Gemini API.' }
  finally { pptLoading.value=false }
}
const pptHtml = ref('')
function downloadPpt() {
  const blob = new Blob([pptHtml.value], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `${pptTitle.value || 'morix-presentation'}.html`
  a.click(); URL.revokeObjectURL(url)
}
function openPptNewTab() {
  const w = window.open('', '_blank')
  if (w) { w.document.write(pptHtml.value); w.document.close() }
}

async function onTFileAttach(e) {
  const file = e.target.files?.[0]; if(!file) return
  tAttachedFile.value = file
  tAttachedBase64.value = null; tAttachedFileText.value = null

  if(file.type.startsWith('image/')) {
    // صورة → base64 مباشرة
    const reader = new FileReader()
    reader.onload = ev => { tAttachedBase64.value = ev.target.result.split(',')[1] }
    reader.readAsDataURL(file)
  } else if(file.name.toLowerCase().endsWith('.txt') || file.name.toLowerCase().endsWith('.md')) {
    // نص عادي → قراءة مباشرة
    const reader = new FileReader()
    reader.onload = ev => { tAttachedFileText.value = (ev.target.result || '').slice(0, 50000) }
    reader.readAsText(file, 'utf-8')
  } else {
    // PDF / PPTX / DOCX → استخراج نص عبر الباكند
    try {
      tAttachedFile.value = { name: file.name + ' (⏳ جاري الاستخراج...)' }
      const res = await teacherAPI.extractFile(file)
      tAttachedFileText.value = res.data.text || ''
      tAttachedFile.value = { name: `📄 ${file.name} (${Math.round((tAttachedFileText.value.length/1000))}K حرف)` }
    } catch(err) {
      tAttachedFile.value = null
      alert(err.response?.data?.detail || 'فشل استخراج نص الملف — تأكد أن الملف يحتوي على نص')
    }
  }

  if(tFileInputEl.value) tFileInputEl.value.value = ''
}
function clearTAttach() { tAttachedFile.value=null; tAttachedBase64.value=null; tAttachedFileText.value=null }

async function sendTeacherMsg(text) {
  const m=text||chatInput.value.trim()
  if(!m && !tAttachedFile.value) return
  const displayMsg = m || `📎 ${tAttachedFile.value?.name}`
  const imgB64 = tAttachedBase64.value
  const fileTxt = tAttachedFileText.value
  chatInput.value=''; clearTAttach()
  chatMsgs.value.push({role:'user',content:displayMsg}); chatThinking.value=true
  nextTick(()=>{ if(chatEl.value) chatEl.value.scrollTop=chatEl.value.scrollHeight })
  try {
    const r = await teacherAPI.chat(m || 'حلل هذا الملف/الصورة', imgB64, fileTxt)
    chatMsgs.value.push({role:'assistant',content:r.data.reply})
  }
  catch { chatMsgs.value.push({role:'assistant',content:'حدث خطأ.'}) }
  finally { chatThinking.value=false; nextTick(()=>{ if(chatEl.value) chatEl.value.scrollTop=chatEl.value.scrollHeight }) }
}

async function genImg() {
  imgLoading.value=true; imgError.value=''; genImage.value=null
  try { const r=await aiAPI.generateImage(imgPrompt.value); if(r.data.success) genImage.value=r.data.image; else imgError.value=r.data.message }
  catch { imgError.value='خطأ في التوليد' }
  finally { imgLoading.value=false }
}

function copyText(t) { navigator.clipboard?.writeText(t).catch(()=>{}) }
async function doLogout() { await auth.logout(); router.push('/login') }
function fmtDate(d) { return d?new Date(d).toLocaleDateString('ar-SA'):'' }
function fmt(t) {
  if(!t) return ''
  return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/\*(.*?)\*/g,'<em>$1</em>')
    .replace(/`(.*?)`/g,'<code>$1</code>').replace(/\n/g,'<br>')
}

// ============================================================
// 🎓 ميزات المعلم الذكية (11 ميزة) — State + Methods
// ============================================================

// 1️⃣ Lesson Plan
const lp = ref({ topic:'', grade:'', duration_minutes:45, objectives:'' })
const lpLoading = ref(false)
const lpResult = ref(null)
async function genLessonPlan() {
  if (!lp.value.topic.trim()) return alert('أدخل موضوع الدرس')
  lpLoading.value = true; lpResult.value = null
  try { lpResult.value = (await teacherAPI.generateLessonPlan(lp.value)).data.plan }
  catch (e) { alert('فشل التوليد: ' + (e.response?.data?.detail || e.message)) }
  lpLoading.value = false
}

// 2️⃣ Multimedia Convert
const mm = ref({ text:'', mode:'bullets' })
const mmLoading = ref(false)
const mmResult = ref(null)
async function convertMM() {
  if (!mm.value.text.trim()) return alert('أدخل النص')
  mmLoading.value = true; mmResult.value = null
  try { mmResult.value = (await teacherAPI.multimediaConvert(mm.value.text, mm.value.mode)).data.data }
  catch (e) { alert('فشل: ' + (e.response?.data?.detail || e.message)) }
  mmLoading.value = false
}

// 3️⃣ Activity Designer
const act = ref({ topic:'', student_count:30, has_internet:true, activity_type:'أي', constraints:'' })
const actLoading = ref(false)
const actResult = ref(null)
async function genActivity() {
  if (!act.value.topic.trim()) return alert('أدخل الموضوع')
  actLoading.value = true; actResult.value = null
  try { actResult.value = (await teacherAPI.designActivity(act.value)).data }
  catch (e) { alert('فشل: ' + (e.response?.data?.detail || e.message)) }
  actLoading.value = false
}

// 4️⃣ Compose Message
const cm = ref({ recipient:'ولي الأمر', tone:'ودودة', purpose:'', student_name:'', notes:'' })
const cmLoading = ref(false)
const cmResult = ref('')
async function composeMsg() {
  if (!cm.value.purpose.trim()) return alert('اكتب غرض الرسالة')
  cmLoading.value = true; cmResult.value = ''
  try { cmResult.value = (await teacherAPI.composeMessage(cm.value)).data.message }
  catch (e) { alert('فشل: ' + (e.response?.data?.detail || e.message)) }
  cmLoading.value = false
}

// 5️⃣ Auto Feedback
const fb = ref({ student_name:'', subject:'', strengths:'', weaknesses:'' })
const fbLoading = ref(false)
const fbResult = ref('')
async function genFeedback() {
  if (!fb.value.strengths.trim() && !fb.value.weaknesses.trim()) return alert('أدخل نقاط القوة أو الضعف')
  fbLoading.value = true; fbResult.value = ''
  try { fbResult.value = (await teacherAPI.autoFeedback(fb.value)).data.report }
  catch (e) { alert('فشل: ' + (e.response?.data?.detail || e.message)) }
  fbLoading.value = false
}

// 6️⃣ Performance Insights
const insights = ref(null)
const insLoading = ref(false)
async function loadInsights() {
  insLoading.value = true
  try { insights.value = (await teacherAPI.getPerformanceInsights()).data }
  catch (e) { alert('فشل: ' + (e.response?.data?.detail || e.message)) }
  insLoading.value = false
}

// 7️⃣ Simplify
const sm = ref({ text:'', level:'beginner' })
const smLoading = ref(false)
const smResult = ref('')
async function simplify() {
  if (!sm.value.text.trim()) return alert('أدخل النص')
  smLoading.value = true; smResult.value = ''
  try { smResult.value = (await teacherAPI.simplifyContent(sm.value.text, sm.value.level)).data.simplified }
  catch (e) { alert('فشل: ' + (e.response?.data?.detail || e.message)) }
  smLoading.value = false
}

// 8️⃣ Differentiated Strategies
const diff = ref({ concept:'' })
const diffLoading = ref(false)
const diffResult = ref(null)
async function genDiff() {
  if (!diff.value.concept.trim()) return alert('أدخل المفهوم')
  diffLoading.value = true; diffResult.value = null
  try { diffResult.value = (await teacherAPI.differentiatedStrategies(diff.value.concept)).data }
  catch (e) { alert('فشل: ' + (e.response?.data?.detail || e.message)) }
  diffLoading.value = false
}

// 9️⃣ Pedagogical Coach
const coachInput = ref('')
const coachLoading = ref(false)
const coachAdvice = ref('')
async function askCoach() {
  if (!coachInput.value.trim()) return alert('اوصف التحدي')
  coachLoading.value = true; coachAdvice.value = ''
  try { coachAdvice.value = (await teacherAPI.pedagogicalCoach(coachInput.value)).data.advice }
  catch (e) { alert('فشل: ' + (e.response?.data?.detail || e.message)) }
  coachLoading.value = false
}

// 🔟 Research Digest
const rdResult = ref(null)
const rdLoading = ref(false)
async function loadResearch() {
  rdLoading.value = true
  try { rdResult.value = (await teacherAPI.researchDigest()).data }
  catch (e) { alert('فشل: ' + (e.response?.data?.detail || e.message)) }
  rdLoading.value = false
}

// 1️⃣1️⃣ Prompt Library
const promptCats = ref([])
const plLoading = ref(false)
async function loadPrompts() {
  plLoading.value = true
  try { promptCats.value = (await teacherAPI.promptLibrary()).data.categories || [] }
  catch (e) { alert('فشل: ' + (e.response?.data?.detail || e.message)) }
  plLoading.value = false
}
function copyPrompt(t) {
  navigator.clipboard?.writeText(t)
  alert('✅ تم نسخ القالب')
}

// 📚 Digital Library + 📓 NotebookLM
const libSources = [
  { label:'مؤسسة هنداوي', icon:'🇪🇬', url:'https://www.hindawi.org/books/' },
  { label:'مكتبة نور', icon:'📖', url:'https://www.noor-book.com/' },
  { label:'الشاملة', icon:'📜', url:'https://shamela.ws/' },
  { label:'Open Library', icon:'🌍', url:'https://openlibrary.org/' },
  { label:'Internet Archive', icon:'🏛️', url:'https://archive.org/details/texts' },
  { label:'ERIC تربوي', icon:'🎓', url:'https://eric.ed.gov/' },
]
const libUrl = ref(libSources[0].url)
// نمرّر التوكن في الـ URL لأن الـ iframe لا يستطيع إرسال هيدر Authorization
const proxiedLibUrl = computed(() => {
  const tok = localStorage.getItem('memorix_token') || ''
  return '/api/v1/proxy?url=' + encodeURIComponent(libUrl.value) + '&token=' + encodeURIComponent(tok)
})

// 📓 Morix Notebook (Teacher)
const nbTab = ref('upload')
const nbFileName = ref('')
const nbFileText = ref('')
const nbExtractLoading = ref(false)
const nbExtractError = ref('')
const nbChat = ref([])
const nbInput = ref('')
const nbAsking = ref(false)
const nbGenLoading = ref(false)
const nbGenResult = ref('')

async function onNbFileUpload(e) {
  const file = e.target.files?.[0]; if (!file) return
  if (file.size > 50 * 1024 * 1024) { alert('الملف أكبر من 50MB'); return }
  const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'))
  nbFileName.value = file.name
  nbFileText.value = ''
  nbExtractError.value = ''
  nbExtractLoading.value = true
  try {
    if (ext === '.txt' || ext === '.md') {
      // قراءة مباشرة — بدون سيرفر
      await new Promise((resolve) => {
        const r = new FileReader()
        r.onload = (ev) => { nbFileText.value = (ev.target.result || '').slice(0, 50000); resolve() }
        r.onerror = () => { nbExtractError.value = 'فشل قراءة الملف'; resolve() }
        r.readAsText(file, 'utf-8')
      })
    } else if (['.pdf', '.pptx', '.docx'].includes(ext)) {
      // ملفات ثنائية → استخراج عبر الباكند
      const res = await teacherAPI.extractFile(file)
      nbFileText.value = res.data.text || ''
      if (!nbFileText.value.trim()) {
        nbExtractError.value = 'لم يُستخرج نص من الملف — تأكد أنه يحتوي على نص قابل للقراءة'
        nbFileName.value = ''
      }
    } else {
      nbExtractError.value = 'صيغة غير مدعومة — استخدم PDF أو PPTX أو DOCX أو TXT أو MD'
      nbFileName.value = ''
    }
  } catch (err) {
    nbExtractError.value = err.response?.data?.detail || 'فشل استخراج الملف'
    nbFileName.value = ''
  } finally {
    nbExtractLoading.value = false
  }
  if(e.target) e.target.value = ''
}
async function askNb() {
  if (!nbInput.value.trim() || !nbFileText.value) return
  const q = nbInput.value
  nbChat.value.push({ role:'user', text:q }); nbInput.value=''; nbAsking.value=true
  try {
    const r = await teacherAPI.chat(q, null, nbFileText.value)
    nbChat.value.push({ role:'ai', text: r.data.reply || 'لا يوجد رد' })
  } catch { nbChat.value.push({ role:'ai', text:'❌ فشل' }) }
  nbAsking.value=false
}
async function genNb(type) {
  if (!nbFileText.value) return alert('ارفع ملفاً أولاً')
  const prompts = {
    summary: 'لخص هذا الكتاب/المرجع للمعلم في 10 فقرات منظمة بنقاط الأفكار الرئيسية لكل فصل.',
    lesson_plan: 'استخرج من الملف خطة درس متكاملة (أهداف، تمهيد، أنشطة، تقييم، واجب).',
    mcq_test: 'ولّد اختبار MCQ من 10 أسئلة من محتوى الملف مع الإجابات النموذجية.',
    worksheet: 'صمم ورقة عمل تطبيقية للطلاب من محتوى الملف، تحتوي على 6 تمارين متدرجة.',
    mindmap: 'حول الملف لخريطة ذهنية نصية (الموضوع → الفروع → التفاصيل).',
    podcast: 'اكتب سكربت بودكاست تعليمي مدته 5 دقائق بصوت معلم وضيف يناقشان أهم محتوى الملف.',
  }
  nbGenLoading.value=true; nbGenResult.value=''
  try {
    const r = await teacherAPI.chat(prompts[type], null, nbFileText.value)
    nbGenResult.value = r.data.reply || ''
  } catch { nbGenResult.value = '❌ فشل التوليد' }
  nbGenLoading.value=false
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
.body{flex:1;overflow-y:auto;}.body.pad{padding:24px;}
.card{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:24px;backdrop-filter:blur(10px);transition:box-shadow .2s;}.card:hover{box-shadow:var(--glow);}.card h3{color:var(--text);margin:0 0 20px;font-size:16px;}
.mt{margin-top:16px;}
.stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:16px;}
.sc{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:20px;text-align:center;}
.sn{font-size:22px;font-weight:800;color:var(--text);margin-bottom:4px;}
.sl{color:var(--t2);font-size:12px;}
.row-sb{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;}
.form-box{background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:20px;margin-bottom:16px;display:flex;flex-direction:column;gap:12px;}
.col-gap{display:flex;flex-direction:column;gap:12px;}
.row-gap{display:flex;gap:10px;flex-wrap:wrap;}
.ai-row{display:flex;align-items:center;}
.toggle-lbl{display:flex;align-items:center;gap:8px;cursor:pointer;color:var(--t2);font-size:14px;}
.toggle-lbl input{accent-color:var(--accent);}
.list-col{display:flex;flex-direction:column;gap:10px;}
.list-item{display:flex;align-items:center;justify-content:space-between;padding:14px;background:var(--bg2);border:1px solid var(--border);border-radius:12px;}
.list-item.clickable{cursor:pointer;transition:border-color .15s;}
.list-item.clickable:hover{border-color:var(--accent);}
.list-item h4{color:var(--text);margin:0 0 4px;}
.meta{display:flex;gap:10px;flex-wrap:wrap;}
.meta span{color:var(--t2);font-size:12px;}
.ai-tag{background:rgba(99,102,241,.2);color:var(--accent);border-radius:4px;padding:1px 6px;}
.empty{text-align:center;padding:40px;color:var(--t2);font-size:14px;}
.chat-area{flex:1;display:flex;flex-direction:column;overflow:hidden;}
.messages{flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:12px;}
.chat-welcome{display:flex;flex-direction:column;align-items:center;padding:48px 20px;}
.chat-welcome h3{color:var(--text);font-size:20px;margin:0 0 8px;}
.quick-btns{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:16px;}
.quick-btn{background:var(--bg2);border:1px solid var(--border);color:var(--t2);border-radius:20px;padding:8px 16px;cursor:pointer;font-size:12px;transition:all .15s;}
.quick-btn:hover{border-color:var(--accent);color:var(--accent);}
.msg{display:flex;}.msg.user{justify-content:flex-start;}.msg.assistant{justify-content:flex-end;}
.msg-bubble{display:flex;align-items:flex-start;gap:10px;max-width:72%;flex-direction:row-reverse;}
.msg.user .msg-bubble{flex-direction:row;}
.msg-icon{font-size:18px;flex-shrink:0;margin-top:4px;}
.msg-text{background:var(--bg2);border:1px solid var(--border);border-radius:14px;padding:12px 16px;color:var(--text);font-size:14px;line-height:1.6;}
.msg.user .msg-text{background:rgba(99,102,241,.2);border-color:rgba(99,102,241,.3);}
.dots{display:flex;gap:4px;padding:12px 16px;align-items:center;}
.dots span{width:8px;height:8px;background:var(--t2);border-radius:50%;animation:bounce 1s infinite;}
.dots span:nth-child(2){animation-delay:.15s}.dots span:nth-child(3){animation-delay:.3s}
@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
.input-row{display:flex;gap:10px;padding:14px 20px;border-top:1px solid var(--border);background:var(--bg2);align-items:flex-end;}
.input-row textarea{flex:1;background:var(--bg3);border:1px solid var(--border);color:var(--text);border-radius:12px;padding:12px 16px;font-size:14px;resize:none;font-family:inherit;text-align:right;}
.input-row textarea:focus{outline:none;border-color:var(--accent);}
.send-btn{background:var(--accent);color:#fff;border:none;border-radius:12px;width:44px;height:44px;cursor:pointer;font-size:18px;flex-shrink:0;}
.send-btn:disabled{opacity:.5;cursor:not-allowed;}
.result-box{margin-top:20px;}
.code-block{background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:20px;color:var(--t2);font-size:13px;line-height:1.7;overflow:auto;max-height:500px;white-space:pre-wrap;}
.inp{width:100%;box-sizing:border-box;background:var(--bg2);border:1px solid var(--border);color:var(--text);border-radius:10px;padding:12px 14px;font-size:14px;font-family:inherit;text-align:right;}
.inp:focus{outline:none;border-color:var(--accent);}
select.inp{cursor:pointer;}textarea.inp{resize:vertical;}
.btn-p{background:linear-gradient(135deg,var(--accent),#00c8ff);color:#000;border:none;border-radius:10px;padding:11px 18px;cursor:pointer;font-size:14px;font-weight:700;transition:opacity .15s,box-shadow .15s;box-shadow:0 0 14px rgba(0,255,159,.2);}
.btn-p:hover:not(:disabled){opacity:.88;box-shadow:0 0 24px rgba(0,255,159,.35);}.btn-p:disabled{opacity:.5;cursor:not-allowed;}
.btn-o{background:transparent;border:1px solid var(--border);color:var(--t2);border-radius:10px;padding:11px 18px;cursor:pointer;font-size:14px;}
.btn-o:hover{border-color:var(--accent);color:var(--accent);}
.btn-s{background:var(--bg3);border:1px solid var(--border);color:var(--t2);border-radius:8px;padding:7px 12px;cursor:pointer;font-size:12px;transition:all .15s;}
.btn-s:hover{border-color:var(--accent);color:var(--accent);}
.btn-s.danger{background:rgba(239,68,68,.1);border-color:rgba(239,68,68,.3);color:#f87171;}
code{background:var(--bg3);border-radius:4px;padding:2px 6px;font-size:12px;}
.settings-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px;}
.avatar-section{display:flex;align-items:center;gap:14px;margin-bottom:16px;}
.av-preview{width:60px;height:60px;border-radius:50%;object-fit:cover;border:2px solid var(--border);}
.av-big{width:60px;height:60px;min-width:60px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:26px;color:#fff;}
.avatar-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:12px 0;}
.avatar-option{cursor:pointer;border-radius:50%;padding:4px;border:3px solid transparent;transition:all 0.2s;display:flex;align-items:center;justify-content:center;}
.avatar-option:hover{border-color:var(--accent);transform:scale(1.1);}
.avatar-option.selected{border-color:var(--accent);box-shadow:0 0 12px var(--accent);}
.av-overlay{position:absolute;inset:0;border-radius:50%;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;font-size:18px;opacity:0;transition:opacity .15s;}
.avatar-section>div:first-child:hover .av-overlay{opacity:1;}
.info-row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border);color:var(--t2);font-size:13px;}
.info-row b{color:var(--text);}
.theme-row{display:flex;gap:10px;flex-wrap:wrap;}
.t-btn{background:var(--bg3);border:1px solid var(--border);color:var(--t2);border-radius:10px;padding:9px 16px;cursor:pointer;font-size:13px;transition:all .15s;}
.t-btn.active{background:rgba(99,102,241,.2);border-color:var(--accent);color:var(--accent);}
select.inp{cursor:pointer;}
.attach-btn{background:var(--bg3);border:1px solid var(--border);color:var(--t2);border-radius:10px;width:40px;height:40px;cursor:pointer;font-size:16px;flex-shrink:0;transition:all .15s;}
.attach-btn:hover{border-color:var(--accent);color:var(--accent);}
.attach-chip{display:flex;align-items:center;gap:8px;padding:6px 16px;background:rgba(99,102,241,.1);border-top:1px solid var(--border);color:var(--t2);font-size:12px;}
.attach-chip button{background:none;border:none;cursor:pointer;color:var(--t2);font-size:14px;line-height:1;}
.ppt-slide{background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:12px;}
.ppt-num{color:var(--accent);font-size:11px;font-weight:700;margin-bottom:4px;text-transform:uppercase;}
.ppt-title{color:var(--text);font-size:16px;font-weight:700;margin-bottom:10px;}
.ppt-points{padding-right:16px;margin:0 0 8px;color:var(--t2);font-size:13px;line-height:2;}
.ppt-notes{color:var(--t2);font-size:12px;padding:8px;background:rgba(99,102,241,.08);border-radius:8px;border-right:3px solid var(--accent);}
@media(max-width:768px){.sidebar{position:fixed;top:0;right:0;height:100vh;width:80vw;max-width:300px;transform:translateX(100%);transition:transform .25s ease;z-index:1001;box-shadow:-4px 0 24px rgba(0,0,0,.5);overflow-y:auto;background:#0b1226 !important;backdrop-filter:none !important;-webkit-backdrop-filter:none !important}.sidebar.open{transform:translateX(0)}.sidebar .nav-item,.sidebar .nav-icon{color:#cbd5e1 !important}.sidebar .nav-item.active{color:#5b9dff !important;background:rgba(91,157,255,.15) !important}.sidebar .nav-label,.sidebar .brand-name{color:#e6edf3 !important}.stats-grid{grid-template-columns:1fr 1fr}.settings-grid{grid-template-columns:1fr}}
</style>

<template>
  <div class="hub hub-student">
    <MatrixBackground />

    <!-- 📡 البث المباشر -->
    <LiveClass v-if="liveOverlay" :room="liveRoom" :name="firstName" :title="liveTitle" @close="liveOverlay=false" />
    <div v-if="activeLive && !liveOverlay" @click="joinLive"
         style="position:fixed;bottom:18px;left:50%;transform:translateX(-50%);z-index:9000;background:linear-gradient(135deg,#ef4444,#f59e0b);color:#fff;padding:12px 22px;border-radius:30px;font-weight:800;cursor:pointer;box-shadow:0 6px 24px rgba(239,68,68,.5);font-size:14px;white-space:nowrap">
      📡 حصة مباشرة الآن — اضغط للانضمام
    </div>

    <!-- Mobile menu button -->
    <button class="mobile-toggle" @click="mobileOpen = !mobileOpen" aria-label="Menu">
      {{ mobileOpen ? '✕' : '☰' }}
    </button>
    <div :class="['mobile-overlay', { open: mobileOpen }]" @click="mobileOpen = false"></div>

    <!-- Sidebar -->
    <aside :class="['sidebar', { collapsed: sidebarCollapsed, open: mobileOpen }]">
      <div class="sidebar-header" @click="sidebarCollapsed = !sidebarCollapsed">
        <div class="brand">
          <div class="brand-icon">M</div>
          <span v-if="!sidebarCollapsed" class="brand-name">Morix</span>
        </div>
      </div>
      <nav class="sidebar-nav">
        <button v-for="sec in sections" :key="sec.id"
          :class="['nav-item', { active: currentSection === sec.id }]"
          @click="switchSection(sec.id)" :title="sec.label">
          <span class="nav-icon" v-html="sec.svg"></span>
          <span v-if="!sidebarCollapsed" class="nav-label">{{ sec.label }}</span>
        </button>
      </nav>
      <div class="sidebar-footer">
        <div v-if="!sidebarCollapsed" class="streak-row">
          <span>🔥 {{ profile.streak_count || 0 }}</span>
          <span>⭐ {{ profile.total_stars || 0 }}</span>
        </div>
        <div v-else class="streak-mini">🔥{{ profile.streak_count || 0 }}</div>
        <button class="logout-btn" @click="handleLogout">
          <span>🚪</span><span v-if="!sidebarCollapsed">{{ t('logout_btn') }}</span>
        </button>
      </div>
    </aside>

    <!-- Main -->
    <main class="main-content">
      <NavBar
        :title="currentSectionLabel"
        :name="firstName"
        :avatar-url="appSettings.avatar_url"
        :current-theme="appSettings.theme"
        :current-lang="lang"
        @theme="t => { appSettings.theme = t; saveSettings() }"
        @lang="changeStudentLang"
      />

      <!-- ===== CHAT ===== -->
      <section v-show="currentSection === 'chat'" class="section-body">
        <!-- Diagnostic -->
        <div v-if="needsDiagnostic" class="diag-wrap">
          <div class="diag-card">
            <h3>🎯 اختبار أسلوب التعلم</h3>
            <p class="diag-step">سؤال {{ diagStep + 1 }} من {{ diagQuestions.length }}</p>
            <div v-if="diagQuestions[diagStep]">
              <p class="q-text">{{ diagQuestions[diagStep].question }}</p>
              <div class="q-options">
                <button v-for="opt in diagQuestions[diagStep].options" :key="opt.value"
                  class="q-opt" @click="answerDiag(opt.value)">{{ opt.text }}</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Chat UI -->
        <div v-else class="chat-layout">
          <div class="conv-panel">
            <button class="new-conv-btn" @click="startNewConv">{{ t('new_chat') }}</button>
            <div class="conv-list">
              <div v-for="c in conversations" :key="c.id"
                :class="['conv-item', { active: currentConvId === c.id }]"
                @click="loadConv(c.id)">
                <span class="conv-title">{{ c.title }}</span>
                <button class="del-conv" @click.stop="deleteConv(c.id)">✕</button>
              </div>
              <p v-if="!conversations.length" class="no-conv">{{ t('no_conversations') }}</p>
            </div>
            <div class="book-sel">
              <label>{{ t('book_label') }}</label>
              <select v-model="selectedBookId">
                <option value="">{{ t('no_book') }}</option>
                <option v-for="b in books" :key="b.id" :value="b.id">{{ b.title }}</option>
              </select>
            </div>
          </div>

          <div class="chat-area">
            <div class="messages" ref="messagesEl">
              <div v-if="!messages.length" class="chat-welcome">
                <div style="font-size:52px;margin-bottom:14px">🤖</div>
                <h3>مرحباً {{ firstName }}!</h3>
                <p>{{ t('how_can_i_help') }}</p>
                <div class="quick-btns">
                  <button v-for="q in quickQs" :key="q" class="quick-btn" @click="sendMsg(q)">{{ q }}</button>
                </div>
              </div>
              <div v-for="(msg, i) in messages" :key="i" :class="['msg', msg.role]">
                <div class="msg-bubble">
                  <span class="msg-icon">{{ msg.role === 'user' ? '👤' : '🤖' }}</span>
                  <div class="msg-text" v-html="fmt(msg.content)"></div>
                </div>
              </div>
              <div v-if="aiThinking" class="msg assistant">
                <div class="msg-bubble">
                  <span class="msg-icon">🤖</span>
                  <div class="dots"><span></span><span></span><span></span></div>
                </div>
              </div>
            </div>
            <!-- Quick gen bar -->
            <div v-if="chatGenMode" class="chat-gen-bar">
              <div v-if="chatGenMode==='image'" class="chat-gen-inner">
                <span class="gen-label">🖼️ توليد صورة</span>
                <input v-model="chatImgPrompt" class="gen-input" placeholder="صِف الصورة التي تريدها..." @keydown.enter.prevent="doChatGenImage" />
                <button class="gen-go" @click="doChatGenImage" :disabled="!chatImgPrompt.trim() || chatGenLoading">
                  {{ chatGenLoading ? '⏳' : '✨ ولّد' }}
                </button>
                <button class="gen-close" @click="chatGenMode=null">✕</button>
              </div>
              <div v-if="chatGenMode==='video'" class="chat-gen-inner">
                <span class="gen-label">🎬 فيديو</span>
                <input v-model="vidTopic" class="gen-input" placeholder="موضوع الفيديو..." @keydown.enter.prevent="doChatGenVideo" />
                <input v-model="vidSubject" class="gen-input" placeholder="المادة..." style="max-width:120px" />
                <button class="gen-go" @click="doChatGenVideo" :disabled="!vidTopic.trim() || vidLoading">
                  {{ vidLoading ? '⏳' : '✨ ولّد' }}
                </button>
                <button class="gen-close" @click="chatGenMode=null">✕</button>
              </div>
            </div>

            <div class="input-row">
              <input type="file" ref="fileInputEl" accept="image/*,.pdf,.txt,.md,.pptx,.docx" @change="onFileAttach" style="display:none" />
              <button class="attach-btn" @click="fileInputEl.click()" title="إرفاق صورة أو ملف">📎</button>
              <button class="attach-btn" @click="chatGenMode = chatGenMode==='image'?null:'image'" :class="{active:chatGenMode==='image'}" title="توليد صورة">🖼️</button>
              <button class="attach-btn" @click="chatGenMode = chatGenMode==='video'?null:'video'" :class="{active:chatGenMode==='video'}" title="توليد فيديو">🎬</button>
              <div v-if="attachedFile" class="attach-chip">
                {{ attachedFile.name.slice(0,20) }}
                <button @click="clearAttach" style="background:none;border:none;cursor:pointer;color:var(--text2)">✕</button>
              </div>
              <div v-if="genImg" class="attach-chip" style="gap:6px">
                <img :src="'data:image/png;base64,'+genImg" style="width:24px;height:24px;border-radius:4px;object-fit:cover" />
                <span>صورة</span>
                <button @click="genImg=null" style="background:none;border:none;cursor:pointer;color:var(--text2)">✕</button>
              </div>
              <textarea v-model="chatInput" rows="2" :placeholder="attachedFile?'أضف رسالة (اختياري)...':'اكتب سؤالك...'"
                @keydown.enter.exact.prevent="sendMsg()"
                @keydown.enter.shift.exact="chatInput += '\n'"></textarea>
              <button class="send-btn" @click="sendMsg()" :disabled="(!chatInput.trim()&&!attachedFile&&!genImg) || aiThinking">➤</button>
            </div>
          </div>
        </div>
      </section>

      <!-- ===== BOOK SUMMARY ===== -->
      <section v-show="currentSection === 'books'" class="section-body pad">
        <div class="card">
          <h3>📖 {{ t('books') }}</h3>
          <div class="row-gap">
            <select v-model="summaryBookId" class="inp">
              <option value="">{{ t('select_book') }}</option>
              <option v-for="b in books" :key="b.id" :value="b.id">{{ b.title }} — {{ b.subject }}</option>
            </select>
            <button class="btn-p" @click="loadSummary" :disabled="!summaryBookId || summaryLoading">
              {{ summaryLoading ? '...' : t('summarize_book') }}
            </button>
          </div>
          <!-- مكتبة الكتب: تحميل/عرض الملفات المرفوعة من المدير -->
          <div v-if="books.length" style="margin-top:16px;display:flex;flex-direction:column;gap:8px">
            <div v-for="b in books" :key="'f'+b.id"
                 style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border:1px solid var(--border);border-radius:10px">
              <span style="font-size:13px">📚 {{ b.title }} <span style="opacity:.6">— {{ b.subject }}</span></span>
              <a v-if="b.file_url" :href="b.file_url" target="_blank" rel="noopener"
                 style="color:#10b981;font-weight:700;font-size:13px;text-decoration:none;white-space:nowrap">📥 تحميل</a>
            </div>
          </div>
          <div v-if="bookSummary" class="summary-box">
            <div class="summary-acts">
              <button class="btn-s" @click="speakSummary">{{ isSpeaking ? '⏸ ' + t('stop_audio') : '🔊 ' + t('listen_btn') }}</button>
              <button v-if="isSpeaking" class="btn-s danger" @click="stopSpeech">⏹</button>
            </div>
            <p class="summary-text">{{ bookSummary }}</p>
          </div>
          <div v-if="summaryBookId && bookSummary" style="margin-top:20px">
            <h4 style="color:var(--text);margin:0 0 12px">💬 {{ t('ask_about_book') }}</h4>
            <div class="messages mini" ref="bookMsgsEl">
              <div v-for="(msg,i) in bookMessages" :key="i" :class="['msg',msg.role]">
                <div class="msg-bubble">
                  <span class="msg-icon">{{ msg.role==='user'?'👤':'🤖' }}</span>
                  <div class="msg-text" v-html="fmt(msg.content)"></div>
                </div>
              </div>
            </div>
            <div class="input-row" style="border:none;padding:12px 0 0">
              <input v-model="bookQ" placeholder="سؤال عن الكتاب..." @keydown.enter="askBook" />
              <button class="send-btn" @click="askBook" :disabled="!bookQ.trim()">➤</button>
            </div>
          </div>
        </div>
      </section>

      <!-- ===== GAMES ===== -->
      <section v-show="currentSection === 'games'" class="section-body pad">
        <div v-if="!activeGame" class="card">
          <h3>🎮 {{ t('educational_games') }}</h3>
          <div class="col-gap">
            <select v-model="gameType" class="inp">
              <option value="mcq">✅ {{ t('multiple_choice') }}</option>
              <option value="matching">🔗 {{ t('matching') }}</option>
              <option value="flashcards">📇 {{ t('flashcards_label') }}</option>
            </select>
            <input v-model="gameSubject" class="inp" placeholder="المادة (مثال: الرياضيات)" />
            <input v-model="gameTopic" class="inp" placeholder="الموضوع (اختياري)" />
            <button class="btn-p" @click="startGame" :disabled="gameLoading || !gameSubject">
              {{ gameLoading ? '⏳ ' + t('generating') : '🚀 ' + t('start_game') }}
            </button>
          </div>
          <div v-if="pastGames.length" style="margin-top:20px;border-top:1px solid var(--border);padding-top:16px">
            <p style="color:var(--text2);font-size:13px;margin:0 0 10px">{{ t('past_games') }}:</p>
            <div v-for="g in pastGames.slice(0,5)" :key="g.id"
              style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);color:var(--text2);font-size:13px">
              <span>{{ g.game_type==='mcq'?'✅':g.game_type==='matching'?'🔗':'📇' }} {{ g.subject }}</span>
              <span :style="{color: g.completed ? '#4ade80':'#facc15'}">{{ g.completed ? g.score+'%' : 'معلق' }}</span>
            </div>
          </div>
        </div>

        <!-- MCQ -->
        <div v-if="activeGame && gameType==='mcq'" class="card">
          <div class="game-header">
            <h3>✅ {{ activeGame.subject }}</h3>
            <span class="q-cnt">{{ mcqIdx+1 }}/{{ activeGame.items?.length }}</span>
          </div>
          <div v-if="!gameFinished">
            <p class="q-text">{{ activeGame.items?.[mcqIdx]?.question }}</p>
            <div class="opts-grid">
              <button v-for="(txt,key) in activeGame.items?.[mcqIdx]?.options" :key="key"
                :class="['opt',{selected:mcqSel===key, correct:mcqAnswered&&key===activeGame.items[mcqIdx].answer, wrong:mcqAnswered&&mcqSel===key&&key!==activeGame.items[mcqIdx].answer}]"
                @click="mcqPick(key)" :disabled="mcqAnswered">{{ key }}) {{ txt }}</button>
            </div>
            <div v-if="mcqAnswered" class="expl">
              <p>{{ mcqSel===activeGame.items[mcqIdx].answer?'✅ صحيح!':'❌ خطأ!' }}</p>
              <p style="color:var(--text2);font-size:13px">{{ activeGame.items[mcqIdx].explanation }}</p>
              <button class="btn-p" @click="mcqNext">{{ mcqIdx<activeGame.items.length-1?t('next_btn'):t('finish_btn') }}</button>
            </div>
          </div>
          <div v-else class="result-box">
            <div style="font-size:48px">🏆</div>
            <h2>{{ gameScore }}%</h2>
            <p>{{ gameScore>=80?t('excellent'):gameScore>=60?t('good_keep_going'):t('try_again') }}</p>
            <button class="btn-p" @click="resetGame">🔄 {{ t('retry_btn') }}</button>
          </div>
        </div>

        <!-- Matching -->
        <div v-if="activeGame && gameType==='matching'" class="card">
          <h3>🔗 {{ activeGame.subject }}</h3>
          <div class="match-grid">
            <div>
              <p style="color:var(--text2);font-size:13px;margin:0 0 10px">المصطلحات</p>
              <button v-for="(it,i) in shuffledTerms" :key="'t'+i"
                :class="['match-btn',{selected:selectedTerm===i,matched:matchedTerms.includes(i)}]"
                @click="pickTerm(i)" :disabled="matchedTerms.includes(i)">{{ it.term }}</button>
            </div>
            <div>
              <p style="color:var(--text2);font-size:13px;margin:0 0 10px">التعاريف</p>
              <button v-for="(it,i) in shuffledDefs" :key="'d'+i"
                :class="['match-btn',{matched:matchedDefs.includes(i)}]"
                @click="pickDef(i)" :disabled="matchedDefs.includes(i)">{{ it.definition }}</button>
            </div>
          </div>
          <div v-if="matchScore!==null" class="result-box">
            <h2>🏆 {{ matchScore }}%</h2>
            <button class="btn-p" @click="resetGame">🔄 إعادة</button>
          </div>
        </div>

        <!-- Flashcards -->
        <div v-if="activeGame && gameType==='flashcards'" class="card" style="text-align:center">
          <h3>📇 {{ activeGame.subject }}</h3>
          <div :class="['flashcard',{flipped:cardFlipped}]" @click="cardFlipped=!cardFlipped">
            <div class="card-f">
              <p>{{ activeGame.items?.[cardIdx]?.question }}</p>
              <span style="color:var(--text2);font-size:12px;margin-top:10px">اضغط للإجابة</span>
            </div>
            <div class="card-b"><p>{{ activeGame.items?.[cardIdx]?.answer }}</p></div>
          </div>
          <div class="card-nav">
            <button class="btn-s" @click="cardIdx=Math.max(0,cardIdx-1)" :disabled="cardIdx===0">◀</button>
            <span style="color:var(--text2)">{{ cardIdx+1 }}/{{ activeGame.items?.length }}</span>
            <button class="btn-s" @click="cardIdx++;cardFlipped=false" :disabled="cardIdx>=(activeGame.items?.length||1)-1">▶</button>
          </div>
          <button class="btn-o" style="margin-top:12px" @click="resetGame">🔄 إعادة</button>
        </div>
      </section>

      <!-- ===== HOMEWORK ===== -->
      <section v-show="currentSection === 'homework'" class="section-body pad">
        <div class="card">
          <h3>📚 الواجبات</h3>
          <div v-if="hwLoading" class="empty">⏳ تحميل...</div>
          <div v-else-if="!homework.length" class="empty">📭 {{ t('no_homework') }}</div>
          <div v-else class="list-col">
            <div v-for="hw in homework" :key="hw.id" class="list-item">
              <div style="flex:1">
                <h4>{{ hw.title }}</h4>
                <p style="color:var(--text2);font-size:13px;margin:4px 0 8px">{{ hw.description }}</p>
                <div class="meta-row">
                  <span>📚 {{ hw.subject }}</span>
                  <span v-if="hw.grade">🎓 {{ hw.grade }}</span>
                  <span v-if="hw.due_date">📅 {{ fmtDate(hw.due_date) }}</span>
                </div>
              </div>
              <button class="btn-s" @click="openHwSubmit(hw)">{{ t('submit_btn') }} ✏️</button>
            </div>
          </div>
        </div>
        <div v-if="hwModal" class="modal-bg" @click.self="hwModal=null">
          <div class="modal-box">
            <h3>تسليم: {{ hwModal.title }}</h3>
            <textarea v-model="hwContent" class="inp" rows="6" placeholder="إجابتك هنا..."></textarea>
            <div class="row-gap" style="margin-top:12px">
              <button class="btn-p" @click="doHwSubmit">إرسال</button>
              <button class="btn-o" @click="hwModal=null">إلغاء</button>
            </div>
          </div>
        </div>
      </section>

      <!-- ===== TESTS ===== -->
      <section v-show="currentSection === 'tests'" class="section-body pad">
        <div v-if="!activeTest" class="card">
          <h3>📝 الاختبارات</h3>
          <div v-if="testsLoading" class="empty">⏳ تحميل...</div>
          <div v-else-if="!tests.length" class="empty">📭 {{ t('no_tests') }}</div>
          <div v-else class="list-col">
            <div v-for="t in tests" :key="t.id" class="list-item">
              <div style="flex:1">
                <h4>{{ t.title }}</h4>
                <div class="meta-row"><span>📚 {{ t.subject }}</span><span>⏱ {{ t.duration_minutes }}د</span></div>
              </div>
              <button class="btn-p" @click="startTest(t.id)">{{ t('start_btn') }}</button>
            </div>
          </div>
        </div>
        <div v-else class="card">
          <div class="game-header">
            <h3>{{ activeTest.title }}</h3>
            <span class="q-cnt">{{ tQIdx+1 }}/{{ activeTest.questions?.length }}</span>
          </div>
          <div v-if="!testDone">
            <p class="q-text">{{ activeTest.questions?.[tQIdx]?.question }}</p>
            <div class="opts-grid">
              <button v-for="(txt,key) in activeTest.questions?.[tQIdx]?.options" :key="key"
                :class="['opt',{selected:tAnswers[activeTest.questions[tQIdx].id]===key}]"
                @click="tAnswers[activeTest.questions[tQIdx].id]=key">{{ key }}) {{ txt }}</button>
            </div>
            <div class="test-nav">
              <button class="btn-s" @click="tQIdx--" :disabled="tQIdx===0">◀</button>
              <button v-if="tQIdx<(activeTest.questions?.length||1)-1" class="btn-s" @click="tQIdx++">▶</button>
              <button v-else class="btn-p" @click="doSubmitTest">{{ t('finish_btn') }}</button>
            </div>
          </div>
          <div v-else class="result-box">
            <h2>🏆 {{ tResult?.score }}%</h2>
            <p>{{ tResult?.correct }} صحيح من {{ tResult?.total }}</p>
            <button class="btn-o" @click="activeTest=null">← رجوع</button>
          </div>
        </div>
      </section>

      <!-- ===== WORKSHEETS ===== -->
      <section v-show="currentSection === 'worksheets'" class="section-body pad">
        <div class="card">
          <h3>📋 أوراق العمل</h3>
          <div v-if="wsLoading" class="empty">⏳ تحميل...</div>
          <div v-else-if="!worksheets.length" class="empty">📭 {{ t('no_worksheets') }}</div>
          <div v-else class="list-col">
            <div v-for="ws in worksheets" :key="ws.id" class="list-item clickable" @click="openWs(ws.id)">
              <div style="flex:1">
                <h4>{{ ws.title }}</h4>
                <div class="meta-row">
                  <span>📚 {{ ws.subject }}</span>
                  <span v-if="ws.ai_generated" style="background:rgba(99,102,241,.2);color:var(--accent);border-radius:4px;padding:1px 6px">🤖 AI</span>
                </div>
              </div>
              <span style="color:var(--text2)">←</span>
            </div>
          </div>
        </div>
        <div v-if="activeWs" class="card" style="margin-top:16px">
          <div style="display:flex;justify-content:space-between;margin-bottom:16px">
            <h3>{{ activeWs.title }}</h3>
            <button class="btn-o" @click="activeWs=null">✕</button>
          </div>
          <div style="color:var(--text2);line-height:1.8;font-size:14px" v-html="fmt(activeWs.content||'')"></div>
        </div>
      </section>

      <!-- ===== IMAGE GEN ===== -->
      <section v-show="currentSection === 'image'" class="section-body pad">
        <div class="card">
          <h3>🎨 توليد الصور التعليمية</h3>
          <p style="color:var(--text2);font-size:13px;margin:0 0 16px">اكتب وصفاً للصورة بأي لغة</p>
          <div class="col-gap">
            <textarea v-model="imgPrompt" class="inp" rows="3"
              placeholder="مثال: مخطط يوضح دورة الماء في الطبيعة..."></textarea>
            <button class="btn-p" @click="genImage" :disabled="imgLoading || !imgPrompt.trim()">
              {{ imgLoading ? '⏳ ' + t('generating') : '✨ ' + t('generate_image') }}
            </button>
          </div>
          <div v-if="imgError" style="color:#f87171;font-size:13px;margin-top:12px">{{ imgError }}</div>
          <div v-if="genImg" style="margin-top:20px;text-align:center">
            <img :src="`data:image/png;base64,${genImg}`" style="max-width:100%;border-radius:12px;border:2px solid var(--border)" />
            <br><a :href="`data:image/png;base64,${genImg}`" download="morix.png" class="btn-s" style="margin-top:10px;display:inline-block">⬇ {{ t('download_btn') }}</a>
          </div>
        </div>
      </section>

      <!-- ===== VIDEO SCRIPT ===== -->
      <section v-show="currentSection === 'video'" class="section-body pad">
        <div class="card">
          <h3>🎬 توليد سكريبت الفيديو</h3>
          <div class="col-gap">
            <input v-model="vidTopic" class="inp" :placeholder="t('video_topic')" />
            <input v-model="vidSubject" class="inp" placeholder="المادة الدراسية" />
            <div>
              <p style="color:var(--text2);font-size:13px;margin:0 0 6px">المدة: {{ formatVidDur(vidSeconds) }}</p>
              <input type="range" v-model.number="vidSeconds" min="30" max="600" step="30" style="width:100%;accent-color:var(--accent)" />
              <div style="display:flex;justify-content:space-between;color:var(--text2);font-size:12px;margin-top:4px"><span>30 ثانية</span><span>10 دقائق</span></div>
            </div>
            <button class="btn-p" @click="genVideo" :disabled="vidLoading||!vidTopic">
              {{ vidLoading ? '⏳ ...' : '✍️ ' + t('generate_script') }}
            </button>
          </div>
          <div v-if="vidScript" style="margin-top:20px">
            <div style="background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:20px;color:var(--text2);font-size:14px;line-height:1.8;white-space:pre-wrap" v-html="fmt(vidScript)"></div>
            <button class="btn-s" style="margin-top:10px" @click="copyText(vidScript)">📋 {{ t('copy_btn') }}</button>
          </div>
        </div>
      </section>

      <!-- ===== 🏆 LEADERBOARD ===== -->
      <section v-show="currentSection === 'leaderboard'" class="section-body pad">
        <div class="card">
          <h3 style="margin-bottom:16px">🏆 {{ t('school_heroes') }}</h3>
          <div v-if="!leaderboard.length" style="color:var(--text2);text-align:center;padding:32px">{{ t('loading') }}</div>
          <div v-for="u in leaderboard" :key="u.id"
               :style="{display:'flex',alignItems:'center',gap:12,padding:'12px',marginBottom:'8px',borderRadius:'12px',background:u.is_me?'linear-gradient(90deg,rgba(99,102,241,.25),transparent)':'var(--card)',border:u.is_me?'2px solid var(--accent)':'1px solid var(--border)'}">
            <div style="font-size:24px;font-weight:bold;width:40px;text-align:center">
              <span v-if="u.rank===1">🥇</span>
              <span v-else-if="u.rank===2">🥈</span>
              <span v-else-if="u.rank===3">🥉</span>
              <span v-else style="color:var(--text2)">#{{ u.rank }}</span>
            </div>
            <img v-if="u.avatar_url" :src="u.avatar_url" style="width:42px;height:42px;border-radius:50%;object-fit:cover" />
            <div v-else style="width:42px;height:42px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:bold">
              {{ (u.full_name||'?').charAt(0) }}
            </div>
            <div style="flex:1">
              <div style="font-weight:bold;color:var(--text)">{{ u.full_name }} <span v-if="u.is_me" style="font-size:12px;color:var(--accent)">{{ t('you_label') }}</span></div>
              <div style="font-size:12px;color:var(--text2)">{{ u.grade }}</div>
            </div>
            <div style="text-align:left">
              <div style="color:#fbbf24;font-weight:bold">⭐ {{ u.stars_count }}</div>
              <div style="font-size:12px;color:#f97316">🔥 {{ u.streak_count }}</div>
            </div>
          </div>
        </div>
      </section>

      <!-- ===== 🎯 DAILY CHALLENGE ===== -->
      <section v-show="currentSection === 'daily'" class="section-body pad">
        <div class="card" style="max-width:600px;margin:0 auto">
          <h3 style="margin-bottom:16px">🎯 التحدي اليومي</h3>
          <div v-if="dailyState==='loading'" style="text-align:center;color:var(--text2);padding:32px">{{ t('loading') }}</div>
          <div v-else-if="dailyState==='answered'" style="text-align:center;padding:32px">
            <div style="font-size:64px">✅</div>
            <h3 style="margin:12px 0">{{ t('answered_challenge') }}</h3>
            <p style="color:var(--text2)">{{ t('come_back_tomorrow') }}</p>
            <p style="color:#fbbf24;margin-top:12px">⭐ كسبت {{ dailyResult?.stars_earned || 0 }} نجمة</p>
          </div>
          <div v-else-if="dailyState==='ready' && dailyChallenge?.question">
            <div style="background:var(--card);padding:12px;border-radius:8px;margin-bottom:16px;font-size:13px;color:var(--text2)">
              📚 المادة: <strong style="color:var(--text)">{{ dailyChallenge.subject }}</strong>
            </div>
            <h4 style="color:var(--text);margin-bottom:16px">{{ dailyChallenge.question.question || dailyChallenge.question.q }}</h4>
            <div style="display:flex;flex-direction:column;gap:8px">
              <button v-for="(opt,i) in (dailyChallenge.question.options || [])" :key="i"
                      @click="answerDaily(opt, i)"
                      :disabled="dailyAnswering"
                      class="btn-primary" style="text-align:right">
                {{ opt.text || opt }}
              </button>
            </div>
          </div>
          <div v-else-if="dailyState==='result'" style="text-align:center;padding:24px">
            <div style="font-size:64px">{{ dailyResult?.stars_earned >= 25 ? '🎉' : '💪' }}</div>
            <h3 style="margin:12px 0">{{ dailyResult?.message }}</h3>
          </div>
          <div v-else style="color:var(--text2);text-align:center">لا يوجد تحدي اليوم، حاول غداً.</div>
        </div>
      </section>

      <!-- ===== ⏱️ POMODORO ===== -->
      <section v-show="currentSection === 'pomodoro'" class="section-body pad">
        <div class="card" style="max-width:500px;margin:0 auto;text-align:center">
          <h3 style="margin-bottom:24px">⏱️ مؤقت بومودورو</h3>
          <div style="font-size:96px;font-weight:bold;color:var(--accent);font-family:monospace">
            {{ pomoDisplay }}
          </div>
          <div style="margin:12px 0;color:var(--text2)">
            {{ pomoMode==='work' ? '🎯 ' + t('focus_time') : '☕ ' + t('break_time') }}
            — جلسة #{{ pomoSessions+1 }}
          </div>
          <div style="display:flex;gap:8px;justify-content:center;margin-top:16px">
            <button @click="startPomo" v-if="!pomoRunning" class="btn-primary">▶️ {{ t('start_btn') }}</button>
            <button @click="pausePomo" v-else class="btn-primary">⏸️ {{ t('pause_btn') }}</button>
            <button @click="resetPomo" class="btn-primary" style="background:var(--bg3)">🔄 {{ t('reset_btn') }}</button>
          </div>
          <div v-if="pomoMessage" style="margin-top:16px;color:#fbbf24">{{ pomoMessage }}</div>
        </div>
      </section>

      <!-- ===== 😊 MOOD ===== -->
      <section v-show="currentSection === 'mood'" class="section-body pad">
        <div class="card" style="max-width:600px;margin:0 auto">
          <h3 style="margin-bottom:16px">😊 {{ t('how_feeling') }}</h3>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px">
            <button v-for="m in moods" :key="m.key"
                    @click="logMood(m.key)"
                    class="btn-primary"
                    style="flex-direction:column;padding:20px;background:var(--card);border:1px solid var(--border)">
              <div style="font-size:36px">{{ m.emoji }}</div>
              <div style="margin-top:8px;color:var(--text)">{{ m.label }}</div>
            </button>
          </div>
          <div v-if="moodSuggestion" style="padding:16px;background:linear-gradient(135deg,rgba(99,102,241,.15),rgba(99,102,241,.05));border-radius:12px;border:1px solid var(--accent);color:var(--text);margin-bottom:20px">
            {{ moodSuggestion }}
          </div>
          <!-- سجل المزاجية آخر 7 أيام -->
          <div v-if="moodHistory.length" style="margin-top:8px">
            <h4 style="color:var(--text2);font-size:13px;margin-bottom:10px">📅 آخر 7 أيام</h4>
            <div style="display:flex;flex-direction:column;gap:8px">
              <div v-for="entry in moodHistory" :key="entry.created_at"
                   style="display:flex;align-items:center;gap:12px;padding:10px 14px;background:var(--bg2);border-radius:10px">
                <span style="font-size:22px">{{ getMoodInfo(entry.event_data?.mood).emoji }}</span>
                <span style="flex:1;color:var(--text)">{{ getMoodInfo(entry.event_data?.mood).label }}</span>
                <span style="color:var(--text2);font-size:12px">{{ new Date(entry.created_at).toLocaleDateString('ar-EG') }}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ===== 🌅 REFLECTION ===== -->
      <section v-show="currentSection === 'reflection'" class="section-body pad">
        <div class="card" style="max-width:600px;margin:0 auto">
          <h3 style="margin-bottom:8px">🌅 التأمل اليومي</h3>
          <p style="color:var(--text2);margin-bottom:16px">ماذا تعلمت اليوم؟ ما هو أفضل جزء من يومك الدراسي؟</p>
          <textarea v-model="reflectionText" rows="6" class="memorix-input"
                    :placeholder="t('write_reflection')" style="width:100%;resize:vertical"></textarea>
          <button @click="saveReflection" :disabled="!reflectionText.trim()" class="btn-primary" style="margin-top:12px">
            💾 {{ t('save_stars') }}
          </button>
          <div v-if="reflectionMessage" style="margin-top:12px;color:#fbbf24">{{ reflectionMessage }}</div>
        </div>
      </section>

      <!-- ===== 📚 DIGITAL LIBRARY (داخل المنصة عبر الـ proxy) ===== -->
      <section v-show="currentSection === 'library'" class="section-body pad">
        <div class="card">
          <h3 style="margin-bottom:8px">📚 {{ t('free_library') }}</h3>
          <p style="color:var(--text2);margin-bottom:12px">آلاف الكتب العربية والمراجع التعليمية مجانية — يفتح داخل المنصة</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
            <button v-for="src in libSources" :key="src.url"
                    @click="libUrl = src.url"
                    class="btn-primary"
                    :style="{background: libUrl===src.url?'var(--accent)':'var(--bg3)',padding:'8px 14px',fontSize:'13px'}">
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
          <p style="color:var(--text2);font-size:12px;margin-top:8px">💡 المكتبة تفتح داخل المنصة عبر بروكسي Morix — كل الروابط تتنقل في نفس النافذة</p>
        </div>
      </section>

      <!-- ===== 📓 دفتري الذكي (NotebookLM-like داخل المنصة) ===== -->
      <section v-show="currentSection === 'notebook'" class="section-body pad">
        <div class="card">
          <h3 style="margin-bottom:8px">📓 دفتري الذكي — Morix Notebook</h3>
          <p style="color:var(--text2);margin-bottom:12px">ارفع كتابك أو مذكراتك واسأل AI عنها، أو ولّد ملخصاً/خريطة ذهنية/أسئلة مراجعة</p>

          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
            <button @click="nbTab='upload'" class="btn-primary" :style="{background:nbTab==='upload'?'var(--accent)':'var(--bg3)',padding:'8px 14px',fontSize:'13px'}">📤 {{ t('upload_file') }}</button>
            <button @click="nbTab='ask'" :disabled="!nbFileText" class="btn-primary" :style="{background:nbTab==='ask'?'var(--accent)':'var(--bg3)',padding:'8px 14px',fontSize:'13px',opacity:nbFileText?1:0.5}">💬 {{ t('ask_about_file') }}</button>
            <button @click="nbTab='generate'" :disabled="!nbFileText" class="btn-primary" :style="{background:nbTab==='generate'?'var(--accent)':'var(--bg3)',padding:'8px 14px',fontSize:'13px',opacity:nbFileText?1:0.5}">✨ {{ t('generate_content') }}</button>
          </div>

          <div v-if="nbTab==='upload'" class="card" style="background:var(--card)">
            <input ref="nbFileInput" type="file" accept=".pdf,.txt,.md,.pptx,.docx" @change="onNbFileUpload" style="display:none" />
            <button @click="$refs.nbFileInput?.click()" class="btn-primary" style="width:100%;padding:24px;font-size:16px">
              📤 اختر ملف PDF / PPTX / DOCX / TXT / MD
            </button>
            <div v-if="nbFileName" style="margin-top:12px;padding:12px;background:var(--bg3);border-radius:8px;border:1px solid var(--accent)">
              ✅ <b>{{ nbFileName }}</b> — جاهز ({{ Math.round(nbFileText.length/1000) }}K حرف)
              <p style="color:var(--text2);font-size:12px;margin-top:6px">انتقل لتبويب "اسأل" أو "ولّد"</p>
            </div>
            <p style="color:var(--text2);font-size:12px;margin-top:8px">💡 الملفات تُعالج محلياً — لا تُرفع لأي خادم خارجي</p>
          </div>

          <div v-if="nbTab==='ask'" class="card" style="background:var(--card)">
            <div style="max-height:50vh;overflow-y:auto;padding:8px;margin-bottom:12px">
              <div v-for="(m,i) in nbChat" :key="i" :style="{padding:'10px',marginBottom:'8px',borderRadius:'8px',background: m.role==='user'?'rgba(99,102,241,.15)':'var(--bg3)',borderRight: m.role==='user'?'3px solid var(--accent)':'3px solid #10b981'}">
                <b>{{ m.role==='user'?'🙋 أنت':'🤖 Morix' }}:</b>
                <div style="white-space:pre-wrap;margin-top:4px">{{ m.text }}</div>
              </div>
            </div>
            <div style="display:flex;gap:8px">
              <input v-model="nbInput" @keyup.enter="askNb" placeholder="اسأل سؤالاً عن الملف..." class="memorix-input" style="flex:1" />
              <button @click="askNb" :disabled="nbAsking || !nbInput.trim()" class="btn-primary">{{ nbAsking?'⏳':'➤' }}</button>
            </div>
          </div>

          <div v-if="nbTab==='generate'" class="card" style="background:var(--card)">
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin-bottom:12px">
              <button @click="genNb('summary')" :disabled="nbGenLoading" class="btn-primary">📝 {{ t('comprehensive_summary') }}</button>
              <button @click="genNb('mindmap')" :disabled="nbGenLoading" class="btn-primary">🧠 {{ t('mind_map') }}</button>
              <button @click="genNb('questions')" :disabled="nbGenLoading" class="btn-primary">❓ 10 {{ t('review_questions') }}</button>
              <button @click="genNb('flashcards')" :disabled="nbGenLoading" class="btn-primary">🎴 {{ t('flashcards_label') }}</button>
              <button @click="genNb('podcast')" :disabled="nbGenLoading" class="btn-primary">🎙️ {{ t('podcast_script') }}</button>
              <button @click="genNb('keypoints')" :disabled="nbGenLoading" class="btn-primary">🎯 {{ t('key_points') }}</button>
            </div>
            <div v-if="nbGenLoading" style="text-align:center;padding:20px;color:var(--text2)">⏳ {{ t('generating') }}</div>
            <div v-if="nbGenResult" style="padding:16px;background:var(--bg3);border-radius:8px;white-space:pre-wrap;line-height:1.8;max-height:60vh;overflow-y:auto">{{ nbGenResult }}</div>
          </div>
        </div>
      </section>

      <!-- ===== PROGRESS ===== -->
      <section v-show="currentSection === 'progress'" class="section-body pad">
        <div class="stats-grid">
          <div class="stat-card"><div class="stat-n">🔥 {{ prog.streak||0 }}</div><div class="stat-l">{{ t('consecutive_days') }}</div></div>
          <div class="stat-card"><div class="stat-n">⭐ {{ prog.total_stars||0 }}</div><div class="stat-l">{{ t('total_stars') }}</div></div>
          <div class="stat-card"><div class="stat-n">💬 {{ prog.total_conversations||0 }}</div><div class="stat-l">{{ t('ai_conversations') }}</div></div>
          <div class="stat-card"><div class="stat-n">🎮 {{ prog.total_games_played||0 }}</div><div class="stat-l">{{ t('completed_games') }}</div></div>
          <div class="stat-card"><div class="stat-n">📝 {{ prog.avg_test_score||0 }}%</div><div class="stat-l">متوسط الاختبارات</div></div>
          <div class="stat-card"><div class="stat-n">🏆 {{ prog.longest_streak||0 }}</div><div class="stat-l">أطول سلسلة</div></div>
        </div>
        <div class="card" style="margin-top:16px">
          <h3>🧠 {{ t('learning_style') }}</h3>
          <div style="font-size:20px;color:var(--text)">
            <span v-if="profile.learning_style==='visual'">👁️ {{ t('visual') }}</span>
            <span v-else-if="profile.learning_style==='auditory'">👂 {{ t('auditory') }}</span>
            <span v-else-if="profile.learning_style==='kinesthetic'">✋ {{ t('kinesthetic') }}</span>
            <span v-else style="color:var(--text2);font-size:14px">لم يتحدد — أكمل الاختبار من قسم المحادثة</span>
          </div>
        </div>
      </section>

      <!-- ===== SETTINGS ===== -->
      <section v-show="currentSection === 'settings'" class="section-body pad">
        <div class="settings-grid">
          <div class="card">
            <h3>👤 معلومات الحساب</h3>
            <div class="avatar-section">
              <div>
                <svg v-if="appSettings.avatar_url && avatarMap[appSettings.avatar_url]" viewBox="0 0 80 80" width="64" height="64">
                  <circle cx="40" cy="40" r="38" :fill="avatarMap[appSettings.avatar_url].bg"/>
                  <circle cx="40" cy="32" r="16" :fill="avatarMap[appSettings.avatar_url].skin"/>
                  <ellipse cx="40" cy="62" rx="22" ry="16" :fill="avatarMap[appSettings.avatar_url].outfit"/>
                  <path :d="avatarMap[appSettings.avatar_url].hair" :fill="avatarMap[appSettings.avatar_url].hairColor"/>
                </svg>
                <div v-else class="av-big">{{ firstName[0] }}</div>
              </div>
            </div>
            <div class="avatar-grid">
              <div v-for="av in avatarOptions" :key="av.id"
                   class="avatar-option" :class="{ selected: appSettings.avatar_url === av.id }"
                   @click="selectAvatar(av.id)">
                <svg viewBox="0 0 80 80" width="56" height="56">
                  <circle cx="40" cy="40" r="38" :fill="av.bg"/>
                  <circle cx="40" cy="32" r="16" :fill="av.skin"/>
                  <ellipse cx="40" cy="62" rx="22" ry="16" :fill="av.outfit"/>
                  <path :d="av.hair" :fill="av.hairColor"/>
                </svg>
              </div>
            </div>
            <div class="info-row"><span>الاسم</span><b>{{ profile.name }}</b></div>
            <div class="info-row"><span>الإيميل</span><b>{{ auth.user?.email }}</b></div>
            <div class="info-row"><span>الصف</span><b>{{ profile.grade||'غير محدد' }}</b></div>
          </div>

          <div class="card">
            <h3>🎨 المظهر</h3>
            <p style="color:var(--text2);font-size:13px;margin:0 0 12px">الثيم</p>
            <div class="theme-row">
              <button :class="['t-btn',{active:appSettings.theme==='dark'}]" @click="setTheme('dark')">🌑 داكن</button>
              <button :class="['t-btn',{active:appSettings.theme==='light'}]" @click="setTheme('light')">☀️ فاتح</button>
              <button :class="['t-btn',{active:appSettings.theme==='library'}]" @click="setTheme('library')">📚 مكتبة</button>
            </div>
          </div>

          <div class="card">
            <h3>🎓 التفضيلات</h3>
            <p style="color:var(--text2);font-size:13px;margin:0 0 8px">مستوى الصعوبة</p>
            <select v-model="appSettings.difficulty" @change="saveSettings" class="inp">
              <option value="easy">سهل</option><option value="medium">متوسط</option><option value="hard">صعب</option>
            </select>
            <p style="color:var(--text2);font-size:13px;margin:14px 0 8px">الهوايات والاهتمامات</p>
            <input v-model="hobbiesInput" class="inp" placeholder="مثال: رياضيات، علوم" @blur="saveHobbies" />
          </div>

          <div class="card">
            <h3>🌐 اللغة / Language</h3>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px">
              <button v-for="(L, code) in languages" :key="code"
                      @click="changeStudentLang(code)"
                      :style="{padding:'10px',borderRadius:'10px',border:`2px solid ${appSettings.language===code?'var(--accent)':'var(--border)'}`,background:appSettings.language===code?'rgba(99,102,241,.15)':'var(--card)',color:'var(--text)',cursor:'pointer',fontWeight:600}">
                {{ L.flag }} {{ L.name }}
              </button>
            </div>
          </div>

          <div class="card">
            <h3>🎯 إعادة الاختبار التشخيصي</h3>
            <p style="color:var(--text2);font-size:13px">أسلوبك الحالي: <strong>{{ profile.learning_style||'غير محدد' }}</strong></p>
            <button class="btn-o" @click="retakeDiag">إعادة الاختبار</button>
          </div>

          <!-- 🧠 شخصية المعلم الذكي -->
          <div class="card">
            <h3>🧠 شخصية المعلم الذكي</h3>
            <p style="color:var(--text2);font-size:13px;margin:0 0 12px">اختر أسلوب المساعد الذكي الذي يناسبك</p>
            <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px">
              <button v-for="p in tutorPersonalities" :key="p.key"
                      @click="chooseTutorPersonality(p.key)"
                      :style="{padding:'12px',borderRadius:'12px',border:`2px solid ${appSettings.tutor_personality===p.key?'var(--accent)':'var(--border)'}`,background:appSettings.tutor_personality===p.key?'rgba(99,102,241,.15)':'var(--card)',color:'var(--text)',cursor:'pointer',textAlign:'right'}">
                <div style="font-size:22px;margin-bottom:4px">{{ p.emoji }}</div>
                <div style="font-weight:600;font-size:14px">{{ p.name }}</div>
                <div style="font-size:11px;color:var(--text2);margin-top:4px">{{ p.style }}</div>
              </button>
            </div>
          </div>

          <div class="card">
            <h3>📣 {{ t('complaint_suggestion') }}</h3>
            <select v-model="cpl.type" class="inp">
              <option value="complaint">شكوى</option><option value="suggestion">اقتراح</option><option value="bug">مشكلة تقنية</option>
            </select>
            <input v-model="cpl.title" class="inp" style="margin-top:10px" placeholder="العنوان" />
            <textarea v-model="cpl.content" class="inp" style="margin-top:10px" rows="3" placeholder="التفاصيل..."></textarea>
            <button class="btn-p" style="margin-top:10px" @click="sendCpl" :disabled="!cpl.title||!cpl.content">{{ t('send') }}</button>
            <p v-if="cplMsg" style="color:#4ade80;font-size:13px;margin-top:8px">{{ cplMsg }}</p>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useAuthStore } from '../stores/auth.js'
import { useRouter } from 'vue-router'
import { aiAPI, studentAPI, authAPI, teacherAPI } from '../api.js'
import NavBar from '../components/NavBar.vue'
import { useTheme } from '../composables/useTheme.js'
import { useI18n, LANGUAGES } from '../composables/useI18n.js'
import MatrixBackground from '../components/MatrixBackground.vue'
import LiveClass from '../components/LiveClass.vue'

const auth = useAuthStore()
const router = useRouter()

const sections = computed(() => [
  { id:'chat',      svg:'<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M18 10c0 3.87-3.58 7-8 7a8.8 8.8 0 01-3.8-.85L2 18l1.3-3.5A6.6 6.6 0 012 10c0-3.87 3.58-7 8-7s8 3.13 8 7zM7 9H5v2h2V9zm4 0H9v2h2V9zm4 0h-2v2h2V9z"/></svg>', label: t('student_chat') },
  { id:'books',     svg:'<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M3 4a1 1 0 011-1h3a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm6 0a1 1 0 011-1h3a1 1 0 011 1v12a1 1 0 01-1 1h-3a1 1 0 01-1-1V4zm7-1a1 1 0 00-1 .8l1 12.4a1 1 0 001 .8h1a1 1 0 001-.8l-1-12.4a1 1 0 00-1-.8h-1z"/></svg>', label: t('books') },
  { id:'games',     svg:'<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.5 6a.5.5 0 01-.5-.5V14a1 1 0 10-2 0v1.5a.5.5 0 01-1 0V14a1 1 0 10-2 0v1.5a.5.5 0 01-1 0V14a3 3 0 016 0v1.5a.5.5 0 01-.5.5z"/></svg>', label: t('games') },
  { id:'homework',  svg:'<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M2 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1H3a1 1 0 01-1-1V4zm5-1a1 1 0 00-1 1v12a1 1 0 001 1h2a1 1 0 001-1V4a1 1 0 00-1-1H7zm5 0a1 1 0 00-.8.4l4 12a1 1 0 001.2.6l1.9-.6a1 1 0 00.6-1.2l-4-12a1 1 0 00-1.2-.6L12.2 3z"/></svg>', label: t('homework') },
  { id:'tests',     svg:'<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M9 2a1 1 0 00-1 1v1H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V6a2 2 0 00-2-2h-2V3a1 1 0 00-1-1H9zm0 2h2v1H9V4zM7 8h6v1H7V8zm0 3h6v1H7v-1zm0 3h4v1H7v-1z"/></svg>', label: t('tests') },
  { id:'worksheets',svg:'<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm2 4h8v1H6V7zm0 3h8v1H6v-1zm0 3h5v1H6v-1z"/></svg>', label: t('worksheets') },
  { id:'image',     svg:'<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"/><circle cx="13.5" cy="7.5" r="1.5"/></svg>', label: t('image_gen') },
  { id:'video',     svg:'<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2l4 3V5l-4 3V5a2 2 0 00-2-2H4zm4 5l4 2.5L8 13V8z"/></svg>', label: t('video_script') },
  { id:'leaderboard',svg:'<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M9.05 3.69a1 1 0 011.9 0l1.28 3.94h4.15a1 1 0 01.59 1.81l-3.36 2.44 1.28 3.94a1 1 0 01-1.54 1.12L10 14.5l-3.35 2.44a1 1 0 01-1.54-1.12l1.28-3.94L3.03 9.44a1 1 0 01.59-1.81h4.15L9.05 3.69z"/></svg>', label: t('leaderboard') },
  { id:'daily',     svg:'<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M11.3 1.05a1 1 0 00-1.1.45L5.7 9H2a1 1 0 00-.8 1.6l7.5 10a1 1 0 001.8-.6L9.7 13H18a1 1 0 00.8-1.6l-7.5-10.35z"/></svg>', label: t('daily_challenge') },
  { id:'pomodoro',  svg:'<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.3.7l2.8 2.8a1 1 0 001.4-1.4L11 9.6V6z"/></svg>', label: t('pomodoro') },
  { id:'mood',      svg:'<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 100-2 1 1 0 000 2zm6 0a1 1 0 100-2 1 1 0 000 2zm-7.5 3a5.5 5.5 0 009 0h-9z"/></svg>', label: t('mood') },
  { id:'reflection',svg:'<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M9 4.8a.5.5 0 01.5-.8h1a.5.5 0 01.5.8L10 6l-1-1.2zM10 18a8 8 0 100-16 8 8 0 000 16zm-1-6a1 1 0 112 0v2a1 1 0 11-2 0v-2zm1-6a1 1 0 100 2 1 1 0 000-2z"/></svg>', label: t('reflection') },
  { id:'library',   svg:'<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M2 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1H3a1 1 0 01-1-1V4zm5-1a1 1 0 00-1 1v12a1 1 0 001 1h2a1 1 0 001-1V4a1 1 0 00-1-1H7zm5 0a1 1 0 00-.8.4l4 12a1 1 0 001.2.6l1.9-.6a1 1 0 00.6-1.2l-4-12a1 1 0 00-1.2-.6L12.2 3z"/></svg>', label: t('digital_library') },
  { id:'notebook',  svg:'<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V4a2 2 0 00-2-2H6zm1 3h6v1H7V5zm0 3h6v1H7V8zm0 3h4v1H7v-1z"/></svg>', label: t('notebook') },
  { id:'progress',  svg:'<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M2 11h3v6H2zm5-4h3v10H7zm5-5h3v15h-3z"/></svg>', label: t('progress') },
  { id:'settings',  svg:'<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M11.5 2.6l.8 1.5a1 1 0 001 .5l1.6-.2a8 8 0 011.5 1.5l-.2 1.6a1 1 0 00.5 1l1.5.8v2.1l-1.5.8a1 1 0 00-.5 1l.2 1.6a8 8 0 01-1.5 1.5l-1.6-.2a1 1 0 00-1 .5l-.8 1.5H8.5l-.8-1.5a1 1 0 00-1-.5l-1.6.2a8 8 0 01-1.5-1.5l.2-1.6a1 1 0 00-.5-1L1.8 11V8.9l1.5-.8a1 1 0 00.5-1l-.2-1.6a8 8 0 011.5-1.5l1.6.2a1 1 0 001-.5l.8-1.5h3zM10 7a3 3 0 100 6 3 3 0 000-6z"/></svg>', label: t('settings') },
])

const currentSection = ref('chat')
const sidebarCollapsed = ref(false)
const mobileOpen = ref(false)
const currentSectionLabel = computed(() => sections.value.find(s=>s.id===currentSection.value)?.label||'')

const profile = ref({ name:'', learning_style:null, grade:'', streak_count:0, total_stars:0 })
const firstName = computed(() => (auth.user?.full_name||profile.value.name||'طالب').split(' ')[0])

// 📡 البث المباشر
const liveOverlay = ref(false)
const liveRoom = ref('')
const liveTitle = ref('')
const activeLive = ref(null)
let liveTimer = null
async function loadLive() {
  try { const r = await studentAPI.getLive(); activeLive.value = (r.data && r.data[0]) || null } catch {}
}
function joinLive() {
  if (!activeLive.value) return
  liveRoom.value = activeLive.value.room
  liveTitle.value = activeLive.value.subject || ('حصة ' + (activeLive.value.host_name || ''))
  liveOverlay.value = true
}

// Chat
const needsDiagnostic = ref(false)
const diagQuestions = ref([])
const diagStep = ref(0)
const diagAnswers = ref([])
const conversations = ref([])
const currentConvId = ref(null)
const messages = ref([])
const chatInput = ref('')
const aiThinking = ref(false)
const messagesEl = ref(null)
const selectedBookId = ref('')
const books = ref([])
const quickQs = ['اشرح لي المفهوم الأساسي','أعطني مثالاً عملياً','لخص الدرس','ما أهم النقاط؟']

// Books
const summaryBookId = ref('')
const bookSummary = ref('')
const summaryLoading = ref(false)
const isSpeaking = ref(false)
const bookMessages = ref([])
const bookQ = ref('')
const bookConvId = ref(null)
const bookMsgsEl = ref(null)

// Games
const gameType = ref('mcq')
const gameSubject = ref('')
const gameTopic = ref('')
const gameLoading = ref(false)
const activeGame = ref(null)
const activeGameId = ref(null)
const pastGames = ref([])
const gameFinished = ref(false)
const gameScore = ref(0)
const mcqIdx = ref(0)
const mcqSel = ref(null)
const mcqAnswered = ref(false)
const mcqCorrect = ref(0)
const shuffledTerms = ref([])
const shuffledDefs = ref([])
const selectedTerm = ref(null)
const matchedTerms = ref([])
const matchedDefs = ref([])
const matchScore = ref(null)
const cardIdx = ref(0)
const cardFlipped = ref(false)

// Homework
const homework = ref([])
const hwLoading = ref(false)
const hwModal = ref(null)
const hwContent = ref('')

// Tests
const tests = ref([])
const testsLoading = ref(false)
const activeTest = ref(null)
const tQIdx = ref(0)
const tAnswers = ref({})
const testDone = ref(false)
const tResult = ref(null)

// Worksheets
const worksheets = ref([])
const wsLoading = ref(false)
const activeWs = ref(null)

// Image
const imgPrompt = ref('')
const imgLoading = ref(false)
const genImg = ref(null)
const imgError = ref('')

// Video
const vidTopic = ref('')
const vidSubject = ref('')
const vidSeconds = ref(300)
const vidLoading = ref(false)
const vidScript = ref('')

// Chat attachments
const fileInputEl = ref(null)
const attachedFile = ref(null)
const attachedBase64 = ref(null)
const attachedFileText = ref(null)

// Progress
const prog = ref({})

// Settings
const appSettings = ref({ theme:'dark', difficulty:'medium', hobbies:[], notifications_enabled:true, avatar_url:'', language:'ar', tutor_personality:'friend' })

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
useTheme(appSettings)
const { t, lang, setLang } = useI18n()
const languages = LANGUAGES
function changeStudentLang(code) {
  appSettings.value.language = code
  setLang(code)
  saveSettings()
}
const hobbiesInput = ref('')
const oldPass = ref('')
const newPass = ref('')
const passMsg = ref('')
const cpl = ref({ type:'complaint', title:'', content:'' })
const cplMsg = ref('')

// ========== Mount ==========
onMounted(async () => {
  await loadProfile()
  await loadBooks()
  await loadConversations()
  await loadProgress()
  await loadUserSettings()
  loadMoodHistory()
  loadTutorPersonalities()
  loadLive()
  liveTimer = setInterval(loadLive, 25000)
})

async function loadProfile() {
  try {
    const r = await studentAPI.getProfile()
    profile.value = r.data
    if (!profile.value.learning_style) {
      await studentAPI.getQuestions().then(r => { diagQuestions.value = r.data })
      needsDiagnostic.value = true
    }
  } catch {}
}
async function loadBooks() { try { books.value = (await aiAPI.getBooks()).data } catch {} }
async function loadConversations() { try { conversations.value = (await aiAPI.getConversations()).data } catch {} }
async function loadProgress() { try { prog.value = (await studentAPI.getProgress()).data } catch {} }
async function loadUserSettings() {
  try {
    const r = await studentAPI.getSettings()
    appSettings.value = { ...appSettings.value, ...r.data }
    hobbiesInput.value = (appSettings.value.hobbies||[]).join('، ')
  } catch {}
}

async function switchSection(id) {
  currentSection.value = id
  mobileOpen.value = false
  if (id==='homework' && !homework.value.length) { hwLoading.value=true; try { homework.value=(await studentAPI.getHomework()).data } catch {} finally { hwLoading.value=false } }
  else if (id==='tests' && !tests.value.length) { testsLoading.value=true; try { tests.value=(await studentAPI.getTests()).data } catch {} finally { testsLoading.value=false } }
  else if (id==='worksheets' && !worksheets.value.length) { wsLoading.value=true; try { worksheets.value=(await studentAPI.getWorksheets()).data } catch {} finally { wsLoading.value=false } }
  else if (id==='games') { try { pastGames.value=(await studentAPI.getGames()).data } catch {} }
  else if (id==='leaderboard') { try { leaderboard.value=(await studentAPI.getLeaderboard()).data } catch {} }
  else if (id==='daily') { await loadDailyChallenge() }
}

// ========== 🏆 Leaderboard ==========
const leaderboard = ref([])

// ========== 🎯 Daily Challenge ==========
const dailyState = ref('loading') // loading | ready | answered | result
const dailyChallenge = ref(null)
const dailyResult = ref(null)
const dailyAnswering = ref(false)
async function loadDailyChallenge() {
  dailyState.value = 'loading'
  try {
    const r = await studentAPI.getDailyChallenge()
    if (r.data.already_answered) {
      dailyState.value = 'answered'
      dailyResult.value = r.data.result
    } else if (r.data.question) {
      dailyChallenge.value = r.data
      dailyState.value = 'ready'
    } else {
      dailyState.value = 'empty'
    }
  } catch { dailyState.value = 'empty' }
}
async function answerDaily(opt, idx) {
  if (dailyAnswering.value) return
  dailyAnswering.value = true
  const q = dailyChallenge.value.question
  const correctIdx = q.correct ?? q.answer ?? q.correct_index ?? 0
  const correct = (typeof opt === 'object' && opt.correct) || idx === correctIdx
  try {
    const r = await studentAPI.answerDailyChallenge(correct)
    dailyResult.value = r.data
    dailyState.value = 'result'
    await loadProgress()
  } catch {}
  dailyAnswering.value = false
}

// ========== ⏱️ Pomodoro ==========
const pomoSeconds = ref(25 * 60)
const pomoRunning = ref(false)
const pomoMode = ref('work')
const pomoSessions = ref(0)
const pomoMessage = ref('')
let pomoInterval = null
const pomoDisplay = computed(() => {
  const m = String(Math.floor(pomoSeconds.value / 60)).padStart(2, '0')
  const s = String(pomoSeconds.value % 60).padStart(2, '0')
  return `${m}:${s}`
})
function startPomo() {
  pomoRunning.value = true
  pomoMessage.value = ''
  pomoInterval = setInterval(async () => {
    if (pomoSeconds.value > 0) { pomoSeconds.value-- }
    else {
      clearInterval(pomoInterval); pomoRunning.value = false
      if (pomoMode.value === 'work') {
        pomoSessions.value++
        try {
          const r = await studentAPI.logFocusSession(25, 'pomodoro')
          pomoMessage.value = r.data.message
          await loadProgress()
        } catch {}
        pomoMode.value = 'break'; pomoSeconds.value = 5 * 60
      } else {
        pomoMode.value = 'work'; pomoSeconds.value = 25 * 60
        pomoMessage.value = '☕ انتهت الاستراحة! ابدأ جلسة جديدة'
      }
    }
  }, 1000)
}
function pausePomo() { pomoRunning.value = false; clearInterval(pomoInterval) }
function resetPomo() {
  pausePomo(); pomoMode.value = 'work'; pomoSeconds.value = 25 * 60
  pomoSessions.value = 0; pomoMessage.value = ''
}

// ========== 😊 Mood ==========
const moods = [
  { key:'happy', emoji:'😄', label:'سعيد' },
  { key:'focused', emoji:'🎯', label:'مركّز' },
  { key:'tired', emoji:'😴', label:'متعب' },
  { key:'stressed', emoji:'😰', label:'متوتر' },
  { key:'bored', emoji:'😐', label:'ممل' },
  { key:'neutral', emoji:'🙂', label:'عادي' },
]

function getMoodInfo(key) {
  return moods.find(m => m.key === key) || { emoji: '😐', label: key || 'عادي' }
}

const moodSuggestion = ref('')
const moodHistory = ref([])
async function logMood(key) {
  try {
    const r = await studentAPI.logMood(key)
    moodSuggestion.value = r.data.suggestion
    // تحديث السجل بعد التسجيل
    await loadMoodHistory()
  } catch {}
}
async function loadMoodHistory() {
  try { moodHistory.value = (await studentAPI.getMoodHistory()).data || [] } catch {}
}

// ========== 📚 Digital Library ==========
const libSources = [
  { label:'مؤسسة هنداوي', icon:'🇪🇬', url:'https://www.hindawi.org/books/' },
  { label:'مكتبة نور', icon:'📖', url:'https://www.noor-book.com/' },
  { label:'الشاملة', icon:'📜', url:'https://shamela.ws/' },
  { label:'Open Library', icon:'🌍', url:'https://openlibrary.org/' },
  { label:'Internet Archive', icon:'🏛️', url:'https://archive.org/details/texts' },
  { label:'Project Gutenberg', icon:'📚', url:'https://www.gutenberg.org/' },
]
const libUrl = ref(libSources[0].url)
// نمرّر التوكن في الـ URL لأن الـ iframe لا يستطيع إرسال هيدر Authorization
const proxiedLibUrl = computed(() => {
  const tok = localStorage.getItem('memorix_token') || ''
  return '/api/v1/proxy?url=' + encodeURIComponent(libUrl.value) + '&token=' + encodeURIComponent(tok)
})

// ========== 📓 Morix Notebook (NotebookLM-like) ==========
const nbTab = ref('upload')
const nbFileName = ref('')
const nbFileText = ref('')
const nbChat = ref([])
const nbInput = ref('')
const nbAsking = ref(false)
const nbGenLoading = ref(false)
const nbGenResult = ref('')

// ضغط الصور قبل الرفع باستخدام Canvas
function _compressImage(file, maxW, maxH, quality) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = ev => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let w = img.width, h = img.height
        if (w > maxW || h > maxH) {
          const ratio = Math.min(maxW / w, maxH / h)
          w = Math.round(w * ratio); h = Math.round(h * ratio)
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

async function onNbFileUpload(e) {
  const file = e.target.files?.[0]
  if (!file) return
  if (file.size > 4 * 1024 * 1024) { alert('الملف أكبر من 4MB — اختر ملفاً أصغر لأن خوادم الاستضافة تسمح بـ 4 ميجابايت كحد أقصى للتحليل'); return }
  nbFileName.value = file.name
  const fname = file.name.toLowerCase()
  if (fname.endsWith('.txt') || fname.endsWith('.md')) {
    const reader = new FileReader()
    reader.onload = (ev) => { nbFileText.value = (ev.target.result || '').slice(0, 80000) }
    reader.readAsText(file, 'utf-8')
  } else if (fname.endsWith('.pdf') || fname.endsWith('.pptx') || fname.endsWith('.docx')) {
    nbFileText.value = '⏳ جاري استخراج النص...'
    try {
      const r = await aiAPI.extractFile(file)
      nbFileText.value = r.data.text || ''
      if (!nbFileText.value) { alert('لم يُستخرج أي نص من الملف'); nbFileName.value = '' }
    } catch (err) {
      alert('تعذر استخراج النص من الملف')
      nbFileName.value = ''
      nbFileText.value = ''
    }
  } else {
    alert('صيغة غير مدعومة — استخدم PDF أو PPTX أو DOCX أو TXT أو MD')
    nbFileName.value = ''
  }
}

async function askNb() {
  if (!nbInput.value.trim() || !nbFileText.value) return
  const q = nbInput.value
  nbChat.value.push({ role: 'user', text: q })
  nbInput.value = ''
  nbAsking.value = true
  try {
    const r = await aiAPI.chat(q, null, null, null, nbFileText.value)
    nbChat.value.push({ role: 'ai', text: r.data.reply || 'لا يوجد رد' })
  } catch (e) {
    nbChat.value.push({ role: 'ai', text: '❌ تعذر الاتصال' })
  }
  nbAsking.value = false
}

async function genNb(type) {
  if (!nbFileText.value) return alert('ارفع ملفاً أولاً')
  const prompts = {
    summary: 'لخص هذا الملف في 8-10 فقرات منظمة وواضحة بالعربية.',
    mindmap: 'حول الملف لخريطة ذهنية: الموضوع المركزي ثم الفروع الرئيسية ثم التفاصيل. استخدم تنسيق نصي بمسافات بادئة.',
    questions: 'ولّد 10 أسئلة مراجعة من الملف مع الإجابات في النهاية.',
    flashcards: 'اصنع 15 بطاقة تعليمية: السؤال على سطر، والإجابة على السطر التالي، مع فاصل ---',
    podcast: 'اكتب سكربت بودكاست (مقدم + ضيف) مدته 5 دقائق يناقش الأفكار الرئيسية في الملف.',
    keypoints: 'استخرج 12 نقطة جوهرية من الملف، كل نقطة في سطر واحد قصير ومركّز.',
  }
  nbGenLoading.value = true; nbGenResult.value = ''
  try {
    const r = await aiAPI.chat(prompts[type], null, null, null, nbFileText.value)
    nbGenResult.value = r.data.reply || ''
  } catch (e) { nbGenResult.value = '❌ فشل التوليد' }
  nbGenLoading.value = false
}

// ========== 🌅 Reflection ==========
const reflectionText = ref('')
const reflectionMessage = ref('')
async function saveReflection() {
  try {
    const r = await studentAPI.saveReflection(reflectionText.value)
    reflectionMessage.value = r.data.message
    reflectionText.value = ''
    await loadProgress()
    setTimeout(() => { reflectionMessage.value = '' }, 4000)
  } catch {}
}

// ========== Diagnostic ==========
async function answerDiag(val) {
  diagAnswers.value.push({ question_id:diagQuestions.value[diagStep.value].id, answer:val })
  if (diagStep.value < diagQuestions.value.length-1) { diagStep.value++ }
  else {
    try { const r=await studentAPI.submitDiagnostic(diagAnswers.value); profile.value.learning_style=r.data.learning_style } catch {}
    needsDiagnostic.value = false
  }
}
function retakeDiag() { diagAnswers.value=[]; diagStep.value=0; needsDiagnostic.value=true; currentSection.value='chat' }

// ========== Chat ==========
function startNewConv() { currentConvId.value=null; messages.value=[] }
async function loadConv(id) {
  currentConvId.value=id
  try { const r=await aiAPI.getMessages(id); messages.value=r.data.messages||[]; scroll() } catch {}
}
async function sendMsg(text) {
  const m = text || chatInput.value.trim()
  if (!m && !attachedFile.value) return
  const displayMsg = m || (attachedFile.value ? `📎 ${attachedFile.value.name}` : '')
  chatInput.value = ''
  messages.value.push({ role:'user', content: displayMsg })
  aiThinking.value = true; scroll()
  try {
    const r = await aiAPI.chat(
      m || 'حلل هذا الملف/الصورة من فضلك',
      currentConvId.value,
      selectedBookId.value || null,
      attachedBase64.value,
      attachedFileText.value
    )
    currentConvId.value = r.data.conversation_id
    messages.value.push({ role:'assistant', content: r.data.reply })
    clearAttach()
    await loadConversations()
  } catch { messages.value.push({ role:'assistant', content:'حدث خطأ.' }) }
  finally { aiThinking.value=false; scroll() }
}

async function onFileAttach(e) {
  const file = e.target.files[0]; if (!file) return
  if (file.size > 4 * 1024 * 1024) { alert('الملف أكبر من 4MB — اختر ملفاً أصغر لأن خوادم الاستضافة تسمح بـ 4 ميجابايت كحد أقصى للتحليل'); e.target.value = ''; return }
  attachedFile.value = file
  attachedBase64.value = null; attachedFileText.value = null
  const fname = file.name.toLowerCase()
  if (file.type.startsWith('image/')) {
    const dataUrl = await _compressImage(file, 1024, 1024, 0.8)
    attachedBase64.value = dataUrl.split(',')[1]
  } else if (fname.endsWith('.txt') || fname.endsWith('.md') || file.type === 'text/plain') {
    const reader = new FileReader()
    reader.onload = ev => { attachedFileText.value = (ev.target.result || '').slice(0, 80000) }
    reader.readAsText(file)
  } else if (fname.endsWith('.pdf') || fname.endsWith('.pptx') || fname.endsWith('.docx')) {
    try {
      const r = await aiAPI.extractFile(file)
      attachedFileText.value = r.data.text || ''
    } catch {
      alert('تعذر قراءة الملف')
      attachedFile.value = null
      e.target.value = ''
    }
  }
}
function clearAttach() { attachedFile.value=null; attachedBase64.value=null; attachedFileText.value=null; if(fileInputEl.value) fileInputEl.value.value='' }
async function deleteConv(id) {
  try { await aiAPI.deleteConversation(id); conversations.value=conversations.value.filter(c=>c.id!==id); if(currentConvId.value===id){currentConvId.value=null;messages.value=[]} } catch {}
}
function scroll() { nextTick(()=>{ if(messagesEl.value) messagesEl.value.scrollTop=messagesEl.value.scrollHeight }) }

// ========== Books ==========
async function loadSummary() {
  summaryLoading.value=true; bookSummary.value=''; bookMessages.value=[]; bookConvId.value=null
  const book=books.value.find(b=>b.id===summaryBookId.value)
  if (book?.summary) { bookSummary.value=book.summary; summaryLoading.value=false; return }
  try { const r=await aiAPI.chat('لخص لي هذا الكتاب بشكل شامل ومفيد للطلاب',null,summaryBookId.value); bookConvId.value=r.data.conversation_id; bookSummary.value=r.data.reply }
  catch { bookSummary.value='تعذر جلب الملخص.' }
  finally { summaryLoading.value=false }
}
function speakSummary() {
  if(isSpeaking.value){window.speechSynthesis.cancel();isSpeaking.value=false;return}
  const u=new SpeechSynthesisUtterance(bookSummary.value); u.lang='ar-SA'; u.onend=()=>{isSpeaking.value=false}
  window.speechSynthesis.speak(u); isSpeaking.value=true
}
function stopSpeech() { window.speechSynthesis.cancel(); isSpeaking.value=false }
async function askBook() {
  if(!bookQ.value.trim()) return; const q=bookQ.value; bookQ.value=''
  bookMessages.value.push({role:'user',content:q})
  try { const r=await aiAPI.chat(q,bookConvId.value,summaryBookId.value); bookConvId.value=r.data.conversation_id; bookMessages.value.push({role:'assistant',content:r.data.reply}) }
  catch { bookMessages.value.push({role:'assistant',content:'حدث خطأ.'}) }
  nextTick(()=>{ if(bookMsgsEl.value) bookMsgsEl.value.scrollTop=bookMsgsEl.value.scrollHeight })
}

// ========== Games ==========
async function startGame() {
  gameLoading.value=true
  try {
    const r=await studentAPI.createGame({game_type:gameType.value,subject:gameSubject.value,topic:gameTopic.value})
    activeGame.value=r.data; activeGameId.value=r.data.id
    mcqIdx.value=0; mcqSel.value=null; mcqAnswered.value=false; mcqCorrect.value=0
    gameFinished.value=false; cardIdx.value=0; cardFlipped.value=false
    matchScore.value=null; selectedTerm.value=null; matchedTerms.value=[]; matchedDefs.value=[]
    if(gameType.value==='matching'){
      shuffledTerms.value=[...activeGame.value.items].sort(()=>Math.random()-.5)
      shuffledDefs.value=[...activeGame.value.items].sort(()=>Math.random()-.5)
    }
  } catch { alert('فشل توليد اللعبة') }
  finally { gameLoading.value=false }
}
function mcqPick(key) {
  if(mcqAnswered.value) return; mcqSel.value=key; mcqAnswered.value=true
  if(key===activeGame.value.items[mcqIdx.value].answer) mcqCorrect.value++
}
function mcqNext() {
  if(mcqIdx.value<activeGame.value.items.length-1){mcqIdx.value++;mcqSel.value=null;mcqAnswered.value=false}
  else{gameScore.value=Math.round(mcqCorrect.value/activeGame.value.items.length*100);gameFinished.value=true;if(activeGameId.value)studentAPI.updateGameScore(activeGameId.value,gameScore.value).catch(()=>{})}
}
function pickTerm(i) { selectedTerm.value=i }
function pickDef(di) {
  if(selectedTerm.value===null) return
  if(shuffledTerms.value[selectedTerm.value].term===shuffledDefs.value[di].term){
    matchedTerms.value.push(selectedTerm.value); matchedDefs.value.push(di)
    if(matchedTerms.value.length===shuffledTerms.value.length){matchScore.value=100;if(activeGameId.value)studentAPI.updateGameScore(activeGameId.value,100).catch(()=>{})}
  }
  selectedTerm.value=null
}
function resetGame() { activeGame.value=null; activeGameId.value=null; gameFinished.value=false; matchScore.value=null }

// ========== Homework ==========
function openHwSubmit(hw) { hwModal.value=hw; hwContent.value='' }
async function doHwSubmit() { try { await studentAPI.submitHomework(hwModal.value.id,hwContent.value); hwModal.value=null } catch {} }

// ========== Tests ==========
async function startTest(id) {
  try { activeTest.value=(await studentAPI.getTest(id)).data; tQIdx.value=0; tAnswers.value={}; testDone.value=false; tResult.value=null } catch {}
}
async function doSubmitTest() {
  try { const r=await studentAPI.submitTest(activeTest.value.id,tAnswers.value); tResult.value=r.data; testDone.value=true } catch {}
}

// ========== Worksheets ==========
async function openWs(id) { try { activeWs.value=(await studentAPI.getWorksheet(id)).data } catch {} }

// ========== Image ==========
async function genImage() {
  imgLoading.value=true; imgError.value=''; genImg.value=null
  try { const r=await aiAPI.generateImage(imgPrompt.value); if(r.data.success) genImg.value=r.data.image; else imgError.value=r.data.message }
  catch { imgError.value='حدث خطأ' }
  finally { imgLoading.value=false }
}

// ========== Video ==========
async function genVideo() {
  vidLoading.value=true; vidScript.value=''
  try {
    const r = await studentAPI.generateVideo({ topic: vidTopic.value, subject: vidSubject.value, duration_seconds: vidSeconds.value })
    vidScript.value = r.data.script
  } catch { vidScript.value = 'تعذر توليد السكريبت.' }
  finally { vidLoading.value = false }
}

// ========== Chat Quick Gen ==========
const chatGenMode = ref(null)    // null | 'image' | 'video'
const chatImgPrompt = ref('')
const chatGenLoading = ref(false)

async function doChatGenImage() {
  if (!chatImgPrompt.value.trim()) return
  chatGenLoading.value = true
  try {
    const r = await aiAPI.generateImage(chatImgPrompt.value)
    if (r.data.success && r.data.image) {
      genImg.value = r.data.image
      messages.value.push({ role: 'assistant', content: `🖼️ **صورة: ${chatImgPrompt.value}**\n\n[الصورة تعرض أدناه في منطقة الإرفاق]` })
      // أرسل الصورة مباشرة في الشات
      chatInput.value = ''
      const prevBase64 = attachedBase64.value
      attachedBase64.value = r.data.image
      await sendMsg(`🖼️ صورة مولّدة: ${chatImgPrompt.value}`)
      chatImgPrompt.value = ''
      chatGenMode.value = null
    } else {
      messages.value.push({ role: 'assistant', content: `❌ تعذر توليد الصورة: ${r.data.message || ''}` })
    }
  } catch { messages.value.push({ role: 'assistant', content: '❌ خطأ في توليد الصورة' }) }
  finally { chatGenLoading.value = false }
}

async function doChatGenVideo() {
  if (!vidTopic.value.trim()) return
  vidLoading.value = true
  chatGenMode.value = null
  messages.value.push({ role: 'user', content: `🎬 ولّد سكريبت فيديو: ${vidTopic.value}` })
  try {
    const r = await studentAPI.generateVideo({ topic: vidTopic.value, subject: vidSubject.value, duration_seconds: vidSeconds.value })
    messages.value.push({ role: 'assistant', content: r.data.script })
  } catch { messages.value.push({ role: 'assistant', content: 'تعذر توليد السكريبت.' }) }
  finally { vidLoading.value = false; scroll() }
}

function formatVidDur(secs) {
  const m=Math.floor(secs/60); const s=secs%60
  if(m===0) return `${s} ثانية`
  if(s===0) return `${m} ${m===1?'دقيقة':'دقائق'}`
  return `${m} ${m===1?'دقيقة':'دقائق'} و${s} ثانية`
}

// ========== Settings ==========
function setTheme(t) { appSettings.value.theme=t; saveSettings() }
async function saveSettings() { try { await studentAPI.updateSettings(appSettings.value) } catch {} }

function selectAvatar(id) {
  appSettings.value.avatar_url = id
  saveSettings()
}
async function saveHobbies() { appSettings.value.hobbies=hobbiesInput.value.split(/[,،]/).map(h=>h.trim()).filter(Boolean); await saveSettings() }

// 🧠 Tutor Personality
const tutorPersonalities = ref([])
async function loadTutorPersonalities() {
  try { tutorPersonalities.value = (await studentAPI.getTutorPersonalities()).data || [] } catch {}
}
async function chooseTutorPersonality(key) {
  try {
    await studentAPI.setTutorPersonality(key)
    appSettings.value.tutor_personality = key
  } catch {}
}
async function changePass() {
  passMsg.value=''
  try { await authAPI.changePassword(oldPass.value,newPass.value); passMsg.value='✅ تم تغيير كلمة المرور بنجاح'; oldPass.value=''; newPass.value='' }
  catch(e) { passMsg.value=e.response?.data?.detail||'خطأ' }
}
async function sendCpl() {
  try { await studentAPI.submitComplaint(cpl.value); cplMsg.value='✅ تم الإرسال!'; cpl.value={type:'complaint',title:'',content:''} }
  catch { cplMsg.value='خطأ' }
}
async function handleLogout() { await auth.logout(); router.push('/login') }

function copyText(t) {
  navigator.clipboard?.writeText(t).catch(() => {})
}
function fmt(t) {
  if(!t) return ''
  return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/\*(.*?)\*/g,'<em>$1</em>')
    .replace(/`(.*?)`/g,'<code>$1</code>').replace(/\n/g,'<br>')
}
function fmtDate(d) { return d ? new Date(d).toLocaleDateString('ar-SA') : '' }
</script>

<style scoped>
.hub { display:flex; height:100vh; overflow:hidden; font-family:'Segoe UI','Cairo',sans-serif; direction:rtl; background:var(--bg1); }

.sidebar { width:240px;min-width:240px;background:var(--sidebar-bg);border-left:var(--sidebar-border);display:flex;flex-direction:column;transition:width .25s,min-width .25s;overflow:hidden;backdrop-filter:var(--sidebar-blur);position:relative;z-index:10; }
.sidebar.collapsed { width:64px;min-width:64px; }
.sidebar-header { padding:16px;cursor:pointer;border-bottom:1px solid var(--border); }
.brand { display:flex;align-items:center;gap:12px; }
.brand-icon { width:36px;height:36px;min-width:36px;background:var(--brand-gradient);border-radius:var(--radius-sm);display:flex;align-items:center;justify-content:center;font-weight:900;font-size:18px;color:var(--brand-text); }
.brand-name { font-size:18px;font-weight:800;color:var(--text); }
.sidebar-nav { flex:1;padding:8px;overflow-y:auto; }
.nav-item { display:flex;align-items:center;gap:12px;width:100%;padding:10px 12px;border-radius:10px;background:none;border:none;color:var(--text2);cursor:pointer;font-size:14px;font-weight:500;transition:all .15s;text-align:right;white-space:nowrap; }
.nav-item:hover { background:var(--nav-hover-bg);color:var(--text); }
.nav-item.active { background:var(--nav-active-bg);color:var(--accent);box-shadow:none; }
.nav-icon { font-size:18px;min-width:20px; }
.sidebar-footer { padding:12px;border-top:1px solid var(--border);display:flex;flex-direction:column;gap:8px; }
.streak-row { display:flex;gap:12px;justify-content:center;font-size:13px;color:var(--text2); }
.streak-mini { text-align:center;font-size:13px;color:var(--text2); }
.logout-btn { display:flex;align-items:center;justify-content:center;gap:8px;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.2);color:#f87171;border-radius:8px;padding:8px;cursor:pointer;font-size:13px;transition:background .15s;width:100%; }
.logout-btn:hover { background:rgba(239,68,68,.2); }

.main-content { flex:1;display:flex;flex-direction:column;background:transparent;overflow:hidden;position:relative;z-index:10; }
.top-bar { display:flex;align-items:center;justify-content:space-between;padding:14px 24px;border-bottom:var(--topbar-border);background:var(--topbar-bg);backdrop-filter:var(--sidebar-blur); }
.section-title { font-size:18px;font-weight:700;color:var(--text);margin:0; }
.user-chip { display:flex;align-items:center;gap:10px;color:var(--text2);font-size:14px; }
.avatar { width:34px;height:34px;background:var(--btn-gradient);border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;color:var(--btn-text);font-size:15px; }
.section-body { flex:1;overflow-y:auto; }
.section-body.pad { padding:24px; }

.card { background:var(--card);border:1px solid var(--border);border-radius:16px;padding:24px;margin-bottom:16px;backdrop-filter:blur(10px);transition:box-shadow .2s; }
.card:hover { box-shadow:var(--glow); }
.card h3 { color:var(--text);margin:0 0 20px;font-size:17px; }

/* Diagnostic */
.diag-wrap { display:flex;align-items:center;justify-content:center;height:100%;background:var(--bg1); }
.diag-card { background:var(--bg2);border:1px solid var(--border);border-radius:20px;padding:40px;max-width:520px;width:90%;text-align:center; }
.diag-card h3 { color:var(--text);font-size:22px;margin:0 0 8px; }
.diag-step { color:var(--text2);margin:0 0 24px; }
.q-text { color:var(--text);font-size:17px;margin:0 0 20px;font-weight:600; }
.q-options,.col-gap { display:flex;flex-direction:column;gap:12px; }
.q-opt { background:var(--bg3);border:1px solid var(--border);color:var(--text);border-radius:12px;padding:14px 20px;cursor:pointer;font-size:15px;transition:all .15s;text-align:right; }
.q-opt:hover { background:rgba(99,102,241,.2);border-color:var(--accent); }

/* Chat */
.chat-layout { display:flex;height:100%;overflow:hidden; }
.conv-panel { width:210px;min-width:210px;background:var(--bg2);border-left:var(--sidebar-border);display:flex;flex-direction:column;padding:12px;gap:8px; }
.new-conv-btn { background:var(--accent);color:var(--btn-text);border:none;border-radius:var(--radius-sm);padding:10px;cursor:pointer;font-size:13px;font-weight:600; }
.conv-list { flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:4px; }
.conv-item { display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-radius:8px;cursor:pointer;transition:background .15s;color:var(--text2);font-size:13px; }
.conv-item:hover,.conv-item.active { background:rgba(99,102,241,.15);color:var(--text); }
.conv-title { flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
.del-conv { background:none;border:none;color:var(--text2);cursor:pointer;padding:2px 6px;border-radius:4px;opacity:0;font-size:12px; }
.conv-item:hover .del-conv { opacity:1; }
.no-conv { color:var(--text2);font-size:12px;text-align:center;padding:16px 0; }
.book-sel { display:flex;flex-direction:column;gap:6px; }
.book-sel label { color:var(--text2);font-size:12px; }
.book-sel select { background:var(--bg3);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:8px;font-size:12px; }
.chat-area { flex:1;display:flex;flex-direction:column;overflow:hidden; }
.messages { flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:12px; }
.messages.mini { max-height:280px; }
.chat-welcome { display:flex;flex-direction:column;align-items:center;padding:48px 20px; }
.chat-welcome h3 { color:var(--text);font-size:22px;margin:0 0 8px; }
.chat-welcome p { color:var(--text2);margin:0 0 24px; }
.quick-btns { display:flex;flex-wrap:wrap;gap:8px;justify-content:center; }
.quick-btn { background:var(--bg2);border:1px solid var(--border);color:var(--text2);border-radius:20px;padding:8px 16px;cursor:pointer;font-size:13px;transition:all .15s; }
.quick-btn:hover { border-color:var(--accent);color:var(--accent); }
.msg { display:flex; }
.msg.user { justify-content:flex-start; }
.msg.assistant { justify-content:flex-end; }
.msg-bubble { display:flex;align-items:flex-start;gap:10px;max-width:72%;flex-direction:row-reverse; }
.msg.user .msg-bubble { flex-direction:row; }
.msg-icon { font-size:18px;flex-shrink:0;margin-top:4px; }
.msg-text { background:var(--bg2);border:1px solid var(--border);border-radius:14px;padding:12px 16px;color:var(--text);font-size:14px;line-height:1.6; }
.msg.user .msg-text { background:rgba(99,102,241,.2);border-color:rgba(99,102,241,.3); }
.dots { display:flex;gap:4px;padding:12px 16px;align-items:center; }
.dots span { width:8px;height:8px;background:var(--text2);border-radius:50%;animation:bounce 1s infinite; }
.dots span:nth-child(2){animation-delay:.15s}.dots span:nth-child(3){animation-delay:.3s}
@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
.input-row { display:flex;gap:10px;padding:14px 20px;border-top:1px solid var(--border);background:var(--bg2);align-items:flex-end; }
.input-row textarea,.input-row input { flex:1;background:var(--bg3);border:1px solid var(--border);color:var(--text);border-radius:12px;padding:12px 16px;font-size:14px;resize:none;font-family:inherit;text-align:right; }
.input-row textarea:focus,.input-row input:focus { outline:none;border-color:var(--accent); }
.send-btn { background:var(--accent);color:var(--btn-text);border:none;border-radius:var(--radius-sm);width:44px;height:44px;cursor:pointer;font-size:18px;flex-shrink:0;display:flex;align-items:center;justify-content:center; }
.send-btn:disabled { opacity:.5;cursor:not-allowed; }
.attach-btn { background:var(--bg3);border:1px solid var(--border);color:var(--text2);border-radius:12px;width:44px;height:44px;cursor:pointer;font-size:18px;flex-shrink:0;display:flex;align-items:center;justify-content:center;transition:all .15s; }
.attach-btn:hover { border-color:var(--accent);color:var(--accent);box-shadow:0 0 10px rgba(79,158,255,.2); }
.attach-btn.active { border-color:var(--accent);color:var(--accent);background:var(--nav-active-bg);box-shadow:var(--nav-active-shadow); }
.attach-chip { background:rgba(99,102,241,.15);border:1px solid rgba(99,102,241,.3);color:var(--accent);border-radius:8px;padding:4px 10px;font-size:12px;white-space:nowrap;display:flex;align-items:center;gap:6px; }

/* Chat Quick Gen Bar */
.chat-gen-bar {
  padding: 10px 16px; border-top: 1px solid var(--border);
  background: var(--glass, var(--bg2));
  backdrop-filter: var(--card-blur);
  animation: slideDown 0.2s ease;
}
@keyframes slideDown { from { opacity:0;transform:translateY(-6px); } to { opacity:1;transform:translateY(0); } }
.chat-gen-inner { display:flex;align-items:center;gap:8px;flex-wrap:wrap; }
.gen-label { font-size:13px;font-weight:600;color:var(--accent);white-space:nowrap; }
.gen-input {
  flex:1;min-width:160px;background:var(--input-bg);border:1px solid var(--input-border);
  color:var(--text);border-radius:10px;padding:8px 12px;font-size:13px;font-family:inherit;
  text-align:right;
}
.gen-input:focus { outline:none;border-color:var(--accent);box-shadow:0 0 0 2px rgba(79,158,255,.1); }
.gen-go {
  background:var(--btn-gradient);color:var(--btn-text);border:none;border-radius:10px;
  padding:8px 16px;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap;
  box-shadow:var(--btn-glow);transition:all .2s;
}
.gen-go:hover:not(:disabled) { filter:brightness(1.1);transform:translateY(-1px); }
.gen-go:disabled { opacity:.5;cursor:not-allowed; }
.gen-close { background:none;border:none;color:var(--text2);cursor:pointer;font-size:16px;padding:4px; }
.gen-close:hover { color:var(--text); }

/* Books */
.summary-box { background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:20px;margin-bottom:16px; }
.summary-acts { display:flex;gap:8px;margin-bottom:12px; }
.summary-text { color:var(--text2);line-height:1.8;font-size:14px;white-space:pre-wrap; }

/* Games */
.game-header { display:flex;justify-content:space-between;align-items:center;margin-bottom:20px; }
.q-cnt { background:var(--bg3);color:var(--text2);border-radius:20px;padding:4px 14px;font-size:13px; }
.opts-grid { display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px; }
.opt { background:var(--bg2);border:2px solid var(--border);color:var(--text);border-radius:12px;padding:14px 16px;cursor:pointer;font-size:14px;text-align:right;transition:all .15s; }
.opt:hover:not(:disabled) { border-color:var(--accent);background:rgba(99,102,241,.1); }
.opt.selected { border-color:var(--accent);background:rgba(99,102,241,.2); }
.opt.correct { border-color:#22c55e;background:rgba(34,197,94,.15); }
.opt.wrong { border-color:#ef4444;background:rgba(239,68,68,.15); }
.expl { margin-top:16px;padding:16px;background:var(--bg3);border-radius:12px; }
.expl p { color:var(--text);margin:0 0 6px; }
.result-box { text-align:center;padding:32px; }
.result-box h2 { color:var(--accent);font-size:28px;margin:0 0 8px; }
.match-grid { display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:16px; }
.match-btn { display:block;width:100%;margin-bottom:8px;background:var(--bg2);border:2px solid var(--border);color:var(--text);border-radius:10px;padding:12px;cursor:pointer;font-size:13px;text-align:right;transition:all .15s; }
.match-btn:hover:not(:disabled) { border-color:var(--accent); }
.match-btn.selected { border-color:var(--accent);background:rgba(99,102,241,.2); }
.match-btn.matched { border-color:#22c55e;background:rgba(34,197,94,.1);opacity:.7; }
.flashcard { width:100%;max-width:480px;height:200px;cursor:pointer;perspective:1000px;position:relative;margin:0 auto 20px; }
.card-f,.card-b { position:absolute;width:100%;height:100%;background:var(--bg2);border:2px solid var(--border);border-radius:16px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;backface-visibility:hidden;transition:transform .5s; }
.card-f { transform:rotateY(0); }
.card-b { transform:rotateY(180deg);background:rgba(99,102,241,.15);border-color:var(--accent); }
.flashcard.flipped .card-f { transform:rotateY(-180deg); }
.flashcard.flipped .card-b { transform:rotateY(0); }
.card-f p,.card-b p { color:var(--text);font-size:17px;text-align:center;margin:0; }
.card-nav { display:flex;align-items:center;gap:20px;color:var(--text2);justify-content:center;margin-bottom:12px; }

/* Lists */
.list-col { display:flex;flex-direction:column;gap:12px; }
.list-item { display:flex;justify-content:space-between;align-items:center;padding:16px;background:var(--bg2);border:1px solid var(--border);border-radius:12px; }
.list-item.clickable { cursor:pointer;transition:border-color .15s; }
.list-item.clickable:hover { border-color:var(--accent); }
.list-item h4 { color:var(--text);margin:0 0 6px; }
.meta-row { display:flex;gap:10px;flex-wrap:wrap; }
.meta-row span { color:var(--text2);font-size:12px; }
.test-nav { display:flex;gap:10px;margin-top:16px; }

/* Modal */
.modal-bg { position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:100; }
.modal-box { background:var(--bg2);border:1px solid var(--border);border-radius:16px;padding:28px;width:90%;max-width:520px; }
.modal-box h3 { color:var(--text);margin:0 0 16px; }

/* Progress */
.stats-grid { display:grid;grid-template-columns:repeat(3,1fr);gap:16px; }
.stat-card { background:var(--card);border:1px solid var(--border);border-radius:16px;padding:24px;text-align:center; }
.stat-n { font-size:22px;font-weight:800;color:var(--text);margin-bottom:6px; }
.stat-l { color:var(--text2);font-size:13px; }

/* Settings */
.settings-grid { display:grid;grid-template-columns:1fr 1fr;gap:16px; }
.avatar-section{display:flex;align-items:center;gap:14px;margin-bottom:16px;}
.av-preview{width:60px;height:60px;border-radius:50%;object-fit:cover;border:2px solid var(--border);}
.av-overlay{position:absolute;inset:0;border-radius:50%;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;font-size:18px;opacity:0;transition:opacity .15s;}
.avatar-section>div:first-child:hover .av-overlay{opacity:1;}
.av-big{width:60px;height:60px;min-width:60px;background:var(--btn-gradient);border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:26px;color:var(--btn-text);}
.avatar-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:12px 0;}
.avatar-option{cursor:pointer;border-radius:50%;padding:4px;border:3px solid transparent;transition:all 0.2s;display:flex;align-items:center;justify-content:center;}
.avatar-option:hover{border-color:var(--accent);transform:scale(1.1);}
.avatar-option.selected{border-color:var(--accent);box-shadow:0 0 12px var(--accent);}
.info-row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border);color:var(--text2);font-size:13px;}
.info-row b{color:var(--text);}
.info-row { display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border);color:var(--text2);font-size:14px; }
.info-row b { color:var(--text); }
.theme-row { display:flex;gap:8px;margin-bottom:4px; }
.t-btn { flex:1;background:var(--bg2);border:2px solid var(--border);color:var(--text2);border-radius:10px;padding:8px;cursor:pointer;font-size:12px;transition:all .15s; }
.t-btn.active { border-color:var(--accent);color:var(--accent);background:rgba(99,102,241,.15); }

/* Common */
.inp { width:100%;box-sizing:border-box;background:var(--bg2);border:1px solid var(--border);color:var(--text);border-radius:10px;padding:12px 14px;font-size:14px;font-family:inherit;text-align:right; }
.inp:focus { outline:none;border-color:var(--accent); }
select.inp { cursor:pointer; }
textarea.inp { resize:vertical; }
.row-gap { display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px; }
.btn-p { background:var(--btn-gradient);color:var(--btn-text);border:none;border-radius:var(--radius-sm);padding:12px 20px;cursor:pointer;font-size:14px;font-weight:700;transition:opacity .15s; }
.btn-p:hover:not(:disabled) { opacity:.85; }
.btn-p:disabled { opacity:.5;cursor:not-allowed; }
.btn-o { background:transparent;border:1px solid var(--border);color:var(--text2);border-radius:10px;padding:12px 20px;cursor:pointer;font-size:14px;transition:border-color .15s; }
.btn-o:hover { border-color:var(--accent);color:var(--accent); }
.btn-s { background:var(--bg3);border:1px solid var(--border);color:var(--text2);border-radius:8px;padding:8px 14px;cursor:pointer;font-size:13px;transition:all .15s; }
.btn-s:hover { border-color:var(--accent);color:var(--accent); }
.btn-s.danger { background:rgba(239,68,68,.1);border-color:rgba(239,68,68,.3);color:#f87171; }
.empty { text-align:center;padding:48px;color:var(--text2);font-size:15px; }
code { background:var(--bg3);border-radius:4px;padding:2px 6px;font-size:13px; }
@media(max-width:768px){.sidebar{position:fixed;top:0;right:0;height:100vh;width:80vw;max-width:300px;transform:translateX(100%);transition:transform .25s ease;z-index:1001;box-shadow:-4px 0 24px rgba(0,0,0,.5);overflow-y:auto;background:#0b1226 !important;backdrop-filter:none !important;-webkit-backdrop-filter:none !important}.sidebar.open{transform:translateX(0)}.sidebar .nav-item,.sidebar .nav-icon{color:#cbd5e1 !important}.sidebar .nav-item.active{color:#5b9dff !important;background:rgba(91,157,255,.15) !important}.sidebar .nav-label,.sidebar .brand-name,.sidebar .streak-row,.sidebar .streak-mini{color:#e6edf3 !important}.opts-grid,.match-grid,.stats-grid,.settings-grid{grid-template-columns:1fr}.conv-panel{display:none}}
</style>

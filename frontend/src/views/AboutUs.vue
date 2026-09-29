<template>
  <div class="about-page">
    <nav class="navbar">
      <div class="brand">
        <div class="b-icon">M</div>
        <span class="b-name">Morix</span>
      </div>
      <div class="nav-links">
        <router-link to="/login" class="nav-btn">تسجيل الدخول</router-link>
      </div>
    </nav>

    <!-- Hero -->
    <section class="hero">
      <div class="hero-content">
        <div class="hero-badge">🚀 منصة التعليم الذكي</div>
        <h1 class="hero-title">مرحباً بك في <span class="grad">Morix</span></h1>
        <p class="hero-sub">منصة تعليمية متكاملة تجمع بين الذكاء الاصطناعي وأساليب التعلم الحديثة لتحقيق أفضل تجربة تعليمية.</p>
        <router-link to="/login" class="cta-btn">ابدأ الآن ←</router-link>
      </div>
      <div class="hero-visual">
        <div class="float-card" style="top:10%;right:5%">🤖 AI Chat</div>
        <div class="float-card" style="top:40%;right:-5%">📊 Analytics</div>
        <div class="float-card" style="top:70%;right:10%">🎮 Games</div>
        <div class="visual-circle"></div>
      </div>
    </section>

    <!-- Features -->
    <section class="features">
      <h2 class="sec-title">ما يميز Morix</h2>
      <div class="feat-grid">
        <div v-for="f in features" :key="f.title" class="feat-card">
          <div class="feat-icon">{{ f.icon }}</div>
          <h3>{{ f.title }}</h3>
          <p>{{ f.desc }}</p>
        </div>
      </div>
    </section>

    <!-- Roles -->
    <section class="roles">
      <h2 class="sec-title">من يستخدم Morix؟</h2>
      <div class="roles-grid">
        <div v-for="r in roles" :key="r.title" class="role-card">
          <div class="role-icon">{{ r.icon }}</div>
          <h3>{{ r.title }}</h3>
          <ul>
            <li v-for="item in r.items" :key="item">{{ item }}</li>
          </ul>
        </div>
      </div>
    </section>

    <!-- How it works -->
    <section class="howto">
      <h2 class="sec-title">كيف تعمل المنصة؟</h2>
      <div class="steps-row">
        <div v-for="(step, i) in steps" :key="i" class="step">
          <div class="step-num">{{ i + 1 }}</div>
          <div class="step-icon">{{ step.icon }}</div>
          <h3>{{ step.title }}</h3>
          <p>{{ step.desc }}</p>
        </div>
      </div>
    </section>

    <!-- CTA -->
    <section class="cta-sec">
      <h2>جاهز للبدء؟</h2>
      <p>سجّل الدخول الآن وابدأ رحلتك التعليمية مع Morix</p>
      <router-link to="/login" class="cta-btn">تسجيل الدخول ←</router-link>
    </section>

    <footer class="footer">
      <p>© 2026 Morix Platform — منصة التعلم الذكي</p>
    </footer>
  </div>
</template>

<script setup>
const features = [
  { icon: '🤖', title: 'ذكاء اصطناعي متقدم', desc: 'مساعد AI يتحدث بلهجتك ويرد عليك بأسلوبك — خليجي، مصري، شامي، أو فصحى.' },
  { icon: '🎯', title: 'تشخيص أسلوب التعلم', desc: 'نحلل أسلوبك في التعلم (بصري، سمعي، حركي) ونكيّف المحتوى بناءً على ذلك.' },
  { icon: '🎮', title: 'تعلم بالألعاب', desc: 'MCQ، مطابقة، وبطاقات تعليمية — تعلم وانت تلعب بمواد من منهجك الدراسي.' },
  { icon: '🔥', title: 'نظام الـ Streaks والنجوم', desc: 'احصل على 50 نجمة كل يوم تسجّل فيه دخولك وحافظ على سلسلة أيامك.' },
  { icon: '📊', title: 'لوحة تحكم متكاملة', desc: 'المدير يرى إحصائيات كاملة، المعلم يتابع طلابه، والطالب يتابع تقدمه.' },
  { icon: '📄', title: 'توليد محتوى بالـ AI', desc: 'واجبات، اختبارات، أوراق عمل، عروض PowerPoint، وسكريبتات فيديو — كلها بالذكاء الاصطناعي.' },
  { icon: '📎', title: 'دعم الصور والملفات', desc: 'أرسل صورة أو ملف في الشات والـ AI يحللها ويجاوب عليها.' },
  { icon: '🌐', title: 'متعدد اللغات', desc: 'عربي، إنجليزي، ألماني، فرنسي، صيني، إسباني — الـ AI يتكيف تلقائياً.' },
]

const roles = [
  {
    icon: '🏫', title: 'المدير',
    items: ['إعداد المدرسة وإنشاء الحسابات', 'استعراض إحصائيات الطلاب والمعلمين', 'تصدير الحسابات بملف CSV', 'إدارة كتب المنهج']
  },
  {
    icon: '🛡️', title: 'المشرف الإداري',
    items: ['رفع ملف Excel لإنشاء حسابات الطلاب', 'إعادة تعيين كلمات مرور الطلاب', 'تفعيل/تعطيل الحسابات', 'متابعة الطلاب في مدرسته']
  },
  {
    icon: '👨‍🏫', title: 'المعلم',
    items: ['إنشاء واجبات واختبارات بالـ AI', 'توليد أوراق عمل وعروض PowerPoint', 'متابعة تقدم الطلاب', 'مساعد AI لتحضير الدروس']
  },
  {
    icon: '👨‍🎓', title: 'الطالب',
    items: ['شات AI يتحدث بلهجتك', 'مراجعات وملخصات فورية', 'ألعاب تعليمية تفاعلية', 'متابعة التقدم والنجوم']
  },
]

const steps = [
  { icon: '🏫', title: 'إعداد المدرسة', desc: 'المدير يسجّل المدرسة ويرفع بيانات الطلاب والمعلمين' },
  { icon: '🔑', title: 'توزيع الحسابات', desc: 'كل طالب ومعلم يحصل على حساب بإيميل وكلمة مرور خاصة' },
  { icon: '🎯', title: 'اختبار التشخيص', desc: 'الطالب يجيب على 5 أسئلة لتحديد أسلوب تعلمه' },
  { icon: '🚀', title: 'التعلم الذكي', desc: 'AI يتكيف مع كل طالب ويقدم محتوى مخصصاً لأسلوبه' },
]
</script>

<style scoped>
.about-page { min-height:100vh; background:#0f172a; font-family:'Segoe UI','Cairo',sans-serif; direction:rtl; color:#f1f5f9; }

/* Navbar */
.navbar { display:flex; align-items:center; justify-content:space-between; padding:16px 48px; border-bottom:1px solid rgba(255,255,255,.08); position:sticky; top:0; background:rgba(15,23,42,.95); backdrop-filter:blur(12px); z-index:50; }
.brand { display:flex; align-items:center; gap:12px; }
.b-icon { width:36px; height:36px; background:linear-gradient(135deg,#6366f1,#8b5cf6); border-radius:10px; display:flex; align-items:center; justify-content:center; font-weight:900; font-size:18px; color:#fff; }
.b-name { font-size:20px; font-weight:800; color:#fff; }
.nav-btn { background:rgba(99,102,241,.15); border:1px solid rgba(99,102,241,.3); color:#a5b4fc; border-radius:10px; padding:8px 20px; text-decoration:none; font-size:14px; transition:all .15s; }
.nav-btn:hover { background:rgba(99,102,241,.3); color:#fff; }

/* Hero */
.hero { display:flex; align-items:center; justify-content:space-between; padding:80px 48px; min-height:calc(100vh - 70px); position:relative; overflow:hidden; }
.hero-content { flex:1; max-width:560px; }
.hero-badge { display:inline-block; background:rgba(99,102,241,.15); border:1px solid rgba(99,102,241,.3); color:#a5b4fc; border-radius:20px; padding:6px 16px; font-size:13px; margin-bottom:24px; }
.hero-title { font-size:52px; font-weight:900; line-height:1.15; margin:0 0 20px; }
.grad { background:linear-gradient(135deg,#6366f1,#a78bfa); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
.hero-sub { color:#94a3b8; font-size:18px; line-height:1.7; margin:0 0 36px; }
.cta-btn { display:inline-block; background:linear-gradient(135deg,#6366f1,#8b5cf6); color:#fff; border-radius:14px; padding:14px 32px; font-size:16px; font-weight:700; text-decoration:none; transition:opacity .15s; }
.cta-btn:hover { opacity:.88; }
.hero-visual { flex:1; position:relative; height:400px; }
.visual-circle { position:absolute; width:300px; height:300px; background:radial-gradient(circle,rgba(99,102,241,.25),transparent 70%); border-radius:50%; top:50%; left:50%; transform:translate(-50%,-50%); }
.float-card { position:absolute; background:rgba(30,41,59,.9); border:1px solid rgba(255,255,255,.1); border-radius:12px; padding:10px 18px; font-size:14px; color:#f1f5f9; white-space:nowrap; backdrop-filter:blur(10px); animation:float 3s ease-in-out infinite; }
.float-card:nth-child(2) { animation-delay:.5s; }
.float-card:nth-child(3) { animation-delay:1s; }
@keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }

/* Sections */
.features,.roles,.howto,.cta-sec { padding:80px 48px; }
.sec-title { font-size:32px; font-weight:800; text-align:center; margin:0 0 48px; }

/* Features */
.feat-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:20px; }
.feat-card { background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.08); border-radius:16px; padding:24px; transition:border-color .15s; }
.feat-card:hover { border-color:rgba(99,102,241,.4); }
.feat-icon { font-size:32px; margin-bottom:14px; }
.feat-card h3 { color:#f1f5f9; font-size:15px; margin:0 0 10px; }
.feat-card p { color:#94a3b8; font-size:13px; line-height:1.7; margin:0; }

/* Roles */
.roles { background:rgba(255,255,255,.02); }
.roles-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:20px; }
.role-card { background:rgba(99,102,241,.06); border:1px solid rgba(99,102,241,.15); border-radius:16px; padding:24px; }
.role-icon { font-size:36px; margin-bottom:14px; }
.role-card h3 { color:#f1f5f9; font-size:16px; margin:0 0 14px; }
.role-card ul { padding-right:16px; margin:0; }
.role-card li { color:#94a3b8; font-size:13px; line-height:2; }

/* Steps */
.steps-row { display:flex; gap:24px; justify-content:center; flex-wrap:wrap; }
.step { flex:1; min-width:200px; max-width:240px; text-align:center; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.08); border-radius:16px; padding:32px 20px; position:relative; }
.step-num { position:absolute; top:-14px; right:50%; transform:translateX(50%); background:linear-gradient(135deg,#6366f1,#8b5cf6); color:#fff; width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:13px; }
.step-icon { font-size:36px; margin-bottom:14px; }
.step h3 { color:#f1f5f9; font-size:15px; margin:0 0 8px; }
.step p { color:#94a3b8; font-size:13px; margin:0; }

/* CTA */
.cta-sec { text-align:center; background:linear-gradient(135deg,rgba(99,102,241,.1),rgba(139,92,246,.1)); border-radius:24px; margin:0 48px; }
.cta-sec h2 { font-size:36px; margin:0 0 14px; }
.cta-sec p { color:#94a3b8; font-size:16px; margin:0 0 28px; }

/* Footer */
.footer { text-align:center; padding:32px; color:#475569; font-size:13px; border-top:1px solid rgba(255,255,255,.06); margin-top:48px; }

@media(max-width:1024px) { .feat-grid,.roles-grid { grid-template-columns:repeat(2,1fr) } }
@media(max-width:768px) { .hero { flex-direction:column; padding:48px 24px; }.hero-visual{display:none} .hero-title{font-size:36px} .feat-grid,.roles-grid{grid-template-columns:1fr} .features,.roles,.howto,.cta-sec{padding:48px 24px} .steps-row{flex-direction:column;align-items:center} .navbar{padding:14px 20px} .cta-sec{margin:0 20px} }
</style>

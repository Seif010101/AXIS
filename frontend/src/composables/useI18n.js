// نظام الترجمة - Morix Platform (قاموس ثابت + أعلام SVG مُضمَّنة — بدون موارد خارجية)
import { ref, computed, watch } from 'vue'

// أعلام SVG مدمجة كـ data-URI — لا تعتمد على أي CDN خارجي (تعمل بدون VPN)
const _flag = (inner) =>
  'data:image/svg+xml;utf8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 40">${inner}</svg>`
  )

const FLAGS = {
  // السعودية — أخضر (يمثّل العربية)
  sa: _flag('<rect width="60" height="40" fill="#006C35"/>'),
  // بريطانيا — Union Jack مبسّط
  gb: _flag('<rect width="60" height="40" fill="#012169"/><path d="M0 0 60 40M60 0 0 40" stroke="#fff" stroke-width="8"/><path d="M0 0 60 40M60 0 0 40" stroke="#C8102E" stroke-width="4"/><path d="M30 0V40M0 20H60" stroke="#fff" stroke-width="13"/><path d="M30 0V40M0 20H60" stroke="#C8102E" stroke-width="8"/>'),
  // الصين — أحمر بنجمة صفراء
  cn: _flag('<rect width="60" height="40" fill="#DE2910"/><path d="M12 6l2.2 6.8H21l-5.5 4 2.1 6.8L12 19.6 6.4 23.6l2.1-6.8L3 12.8h6.8z" fill="#FFDE00"/>'),
  // ألمانيا — أسود/أحمر/ذهبي
  de: _flag('<rect width="60" height="40" fill="#000"/><rect width="60" height="26.7" y="13.3" fill="#D00"/><rect width="60" height="13.3" y="26.7" fill="#FFCE00"/>'),
  // إسبانيا — أحمر/أصفر/أحمر
  es: _flag('<rect width="60" height="40" fill="#AA151B"/><rect width="60" height="20" y="10" fill="#F1BF00"/>'),
  // فرنسا — أزرق/أبيض/أحمر
  fr: _flag('<rect width="20" height="40" fill="#0055A4"/><rect width="20" height="40" x="20" fill="#fff"/><rect width="20" height="40" x="40" fill="#EF4135"/>'),
}

export const LANGUAGES = {
  ar: { code: 'ar', name: 'العربية',  flag: '🇸🇦', flagImg: FLAGS.sa, dir: 'rtl' },
  en: { code: 'en', name: 'English',  flag: '🇬🇧', flagImg: FLAGS.gb, dir: 'ltr' },
  zh: { code: 'zh', name: '中文',      flag: '🇨🇳', flagImg: FLAGS.cn, dir: 'ltr' },
  de: { code: 'de', name: 'Deutsch',  flag: '🇩🇪', flagImg: FLAGS.de, dir: 'ltr' },
  es: { code: 'es', name: 'Español',  flag: '🇪🇸', flagImg: FLAGS.es, dir: 'ltr' },
  fr: { code: 'fr', name: 'Français', flag: '🇫🇷', flagImg: FLAGS.fr, dir: 'ltr' },
}

// ════════════════════════════════════════
//  Static translation dictionary
// ════════════════════════════════════════
const STATIC = {
  // ── App ──────────────────────────────
  app_name:    { ar:'موريكس',          en:'Morix',                     zh:'莫瑞克斯',        de:'Morix',                      es:'Morix',                    fr:'Morix' },
  tagline:     { ar:'منصة التعلم الذكي', en:'Smart Learning Platform',   zh:'智能学习平台',    de:'Intelligente Lernplattform', es:'Plataforma de Aprendizaje Inteligente', fr:"Plateforme d'Apprentissage Intelligent" },

  // ── Roles ────────────────────────────
  role_owner:   { ar:'مالك',     en:'Owner',   zh:'所有者', de:'Besitzer',   es:'Propietario',    fr:'Propriétaire' },
  role_manager: { ar:'مدير',     en:'Manager', zh:'经理',   de:'Manager',    es:'Gerente',        fr:'Gérant' },
  role_admin:   { ar:'إداري',    en:'Admin',   zh:'管理员', de:'Verwalter',  es:'Administrador',  fr:'Administrateur' },
  role_teacher: { ar:'معلم',     en:'Teacher', zh:'教师',   de:'Lehrer',     es:'Profesor',       fr:'Enseignant' },
  role_student: { ar:'طالب',     en:'Student', zh:'学生',   de:'Schüler',    es:'Estudiante',     fr:'Étudiant' },

  // ── Common buttons ───────────────────
  save:         { ar:'حفظ',          en:'Save',        zh:'保存',   de:'Speichern',       es:'Guardar',    fr:'Enregistrer' },
  cancel:       { ar:'إلغاء',        en:'Cancel',      zh:'取消',   de:'Abbrechen',       es:'Cancelar',   fr:'Annuler' },
  delete_btn:   { ar:'حذف',          en:'Delete',      zh:'删除',   de:'Löschen',         es:'Eliminar',   fr:'Supprimer' },
  edit:         { ar:'تعديل',        en:'Edit',        zh:'编辑',   de:'Bearbeiten',      es:'Editar',     fr:'Modifier' },
  add_btn:      { ar:'إضافة',        en:'Add',         zh:'添加',   de:'Hinzufügen',      es:'Añadir',     fr:'Ajouter' },
  search:       { ar:'بحث',          en:'Search',      zh:'搜索',   de:'Suchen',          es:'Buscar',     fr:'Rechercher' },
  search_ph:    { ar:'بحث...',        en:'Search...',   zh:'搜索...', de:'Suchen...',       es:'Buscar...',  fr:'Rechercher...' },
  loading:      { ar:'جاري التحميل...', en:'Loading...', zh:'加载中...', de:'Wird geladen...', es:'Cargando...', fr:'Chargement...' },
  send:         { ar:'إرسال',        en:'Send',        zh:'发送',   de:'Senden',          es:'Enviar',     fr:'Envoyer' },
  logout:       { ar:'تسجيل خروج',   en:'Logout',      zh:'退出',   de:'Abmelden',        es:'Cerrar sesión', fr:'Déconnexion' },
  logout_btn:   { ar:'خروج',         en:'Logout',      zh:'退出',   de:'Abmelden',        es:'Salir',      fr:'Sortir' },
  login:        { ar:'تسجيل الدخول', en:'Login',       zh:'登录',   de:'Anmelden',        es:'Iniciar sesión', fr:'Connexion' },
  back:         { ar:'رجوع',         en:'Back',        zh:'返回',   de:'Zurück',          es:'Volver',     fr:'Retour' },
  confirm:      { ar:'تأكيد',        en:'Confirm',     zh:'确认',   de:'Bestätigen',      es:'Confirmar',  fr:'Confirmer' },
  upload_btn:   { ar:'رفع',          en:'Upload',      zh:'上传',   de:'Hochladen',       es:'Subir',      fr:'Télécharger' },
  download_btn: { ar:'تحميل',        en:'Download',    zh:'下载',   de:'Herunterladen',   es:'Descargar',  fr:'Télécharger' },
  copy_btn:     { ar:'نسخ',          en:'Copy',        zh:'复制',   de:'Kopieren',        es:'Copiar',     fr:'Copier' },
  refresh_btn:  { ar:'تحديث',        en:'Refresh',     zh:'刷新',   de:'Aktualisieren',   es:'Actualizar', fr:'Actualiser' },
  start_btn:    { ar:'ابدأ',         en:'Start',       zh:'开始',   de:'Starten',         es:'Iniciar',    fr:'Commencer' },
  generate_btn: { ar:'توليد',        en:'Generate',    zh:'生成',   de:'Generieren',      es:'Generar',    fr:'Générer' },
  analyze_btn:  { ar:'تحليل',        en:'Analyze',     zh:'分析',   de:'Analysieren',     es:'Analizar',   fr:'Analyser' },
  post_btn:     { ar:'نشر',          en:'Post',        zh:'发布',   de:'Posten',          es:'Publicar',   fr:'Publier' },
  close_btn:    { ar:'إغلاق',        en:'Close',       zh:'关闭',   de:'Schließen',       es:'Cerrar',     fr:'Fermer' },
  create_ai:    { ar:'إنشاء بالـ AI', en:'Create with AI', zh:'用AI创建', de:'Mit KI erstellen', es:'Crear con IA', fr:'Créer avec IA' },
  generating:   { ar:'جاري التوليد...', en:'Generating...', zh:'生成中...', de:'Wird generiert...', es:'Generando...', fr:'Génération...' },
  uploading:    { ar:'جاري الرفع...', en:'Uploading...', zh:'上传中...', de:'Hochladen...', es:'Subiendo...', fr:'Chargement...' },
  retry_btn:    { ar:'إعادة',        en:'Retry',       zh:'重试',   de:'Wiederholen',     es:'Reintentar', fr:'Réessayer' },
  submit_btn:   { ar:'تسليم',        en:'Submit',      zh:'提交',   de:'Einreichen',      es:'Enviar',     fr:'Soumettre' },
  view_btn:     { ar:'عرض',          en:'View',        zh:'查看',   de:'Ansehen',         es:'Ver',        fr:'Voir' },
  reset_btn:    { ar:'تصفير',        en:'Reset',       zh:'重置',   de:'Zurücksetzen',    es:'Reiniciar',  fr:'Réinitialiser' },
  pause_btn:    { ar:'إيقاف',        en:'Pause',       zh:'暂停',   de:'Pausieren',       es:'Pausar',     fr:'Pause' },
  broadcast_now:{ ar:'بث الآن',      en:'Broadcast Now', zh:'立即广播', de:'Jetzt senden', es:'Transmitir ahora', fr:'Diffuser maintenant' },
  get_consultation: { ar:'احصل على استشارة', en:'Get Consultation', zh:'获取咨询', de:'Beratung erhalten', es:'Obtener consulta', fr:'Obtenir une consultation' },
  calculate_btn:{ ar:'احسب',         en:'Calculate',   zh:'计算',   de:'Berechnen',       es:'Calcular',   fr:'Calculer' },
  download_csv: { ar:'تحميل CSV',    en:'Download CSV', zh:'下载CSV', de:'CSV herunterladen', es:'Descargar CSV', fr:'Télécharger CSV' },
  generate_plan:{ ar:'ولّد الخطة',   en:'Generate Plan', zh:'生成计划', de:'Plan generieren', es:'Generar plan', fr:'Générer le plan' },
  convert_btn:  { ar:'حوّل',         en:'Convert',     zh:'转换',   de:'Konvertieren',    es:'Convertir',  fr:'Convertir' },
  compose_msg:  { ar:'اكتب الرسالة', en:'Compose Message', zh:'撰写消息', de:'Nachricht verfassen', es:'Redactar mensaje', fr:'Rédiger le message' },
  generate_report: { ar:'ولّد التقرير', en:'Generate Report', zh:'生成报告', de:'Bericht generieren', es:'Generar informe', fr:'Générer le rapport' },
  get_advice:   { ar:'احصل على نصيحة', en:'Get Advice', zh:'获取建议', de:'Ratschlag holen', es:'Obtener consejo', fr:'Obtenir un conseil' },
  simplify_btn: { ar:'بسّط',         en:'Simplify',    zh:'简化',   de:'Vereinfachen',    es:'Simplificar',fr:'Simplifier' },
  suggest_methods: { ar:'اقترح طرقاً', en:'Suggest Methods', zh:'建议方法', de:'Methoden vorschlagen', es:'Sugerir métodos', fr:'Suggérer des méthodes' },

  // ── Settings ─────────────────────────
  settings:      { ar:'الإعدادات',   en:'Settings',    zh:'设置',   de:'Einstellungen',  es:'Configuración', fr:'Paramètres' },
  profile:       { ar:'الملف الشخصي',en:'Profile',     zh:'个人资料',de:'Profil',         es:'Perfil',     fr:'Profil' },
  appearance:    { ar:'المظهر',       en:'Appearance',  zh:'外观',   de:'Aussehen',       es:'Apariencia', fr:'Apparence' },
  theme:         { ar:'الثيم',        en:'Theme',       zh:'主题',   de:'Thema',          es:'Tema',       fr:'Thème' },
  theme_dark:    { ar:'داكن',         en:'Dark',        zh:'深色',   de:'Dunkel',         es:'Oscuro',     fr:'Sombre' },
  theme_light:   { ar:'فاتح',         en:'Light',       zh:'浅色',   de:'Hell',           es:'Claro',      fr:'Clair' },
  theme_library: { ar:'مكتبة',        en:'Library',     zh:'图书馆', de:'Bibliothek',     es:'Biblioteca', fr:'Bibliothèque' },
  choose_avatar: { ar:'اختر صورتك الرمزية', en:'Choose your avatar', zh:'选择头像', de:'Avatar auswählen', es:'Elige tu avatar', fr:'Choisissez votre avatar' },
  language:      { ar:'اللغة',        en:'Language',    zh:'语言',   de:'Sprache',        es:'Idioma',     fr:'Langue' },
  notifications: { ar:'الإشعارات',   en:'Notifications',zh:'通知',  de:'Benachrichtigungen', es:'Notificaciones', fr:'Notifications' },
  notifications_enabled: { ar:'تفعيل الإشعارات', en:'Enable notifications', zh:'启用通知', de:'Benachrichtigungen aktivieren', es:'Activar notificaciones', fr:'Activer les notifications' },
  account_info:  { ar:'معلومات الحساب', en:'Account Info', zh:'账户信息', de:'Kontoinformationen', es:'Información de cuenta', fr:'Informations du compte' },
  full_name:     { ar:'الاسم',        en:'Name',        zh:'姓名',   de:'Name',           es:'Nombre',     fr:'Nom' },
  email:         { ar:'البريد الإلكتروني', en:'Email', zh:'电子邮件', de:'E-Mail',        es:'Correo electrónico', fr:'E-mail' },
  password:      { ar:'كلمة المرور', en:'Password',    zh:'密码',   de:'Passwort',       es:'Contraseña', fr:'Mot de passe' },
  upload_avatar: { ar:'رفع صورة من الجهاز', en:'Upload avatar', zh:'上传头像', de:'Avatar hochladen', es:'Subir avatar', fr:'Télécharger un avatar' },
  saved:         { ar:'✅ تم الحفظ', en:'✅ Saved',    zh:'✅ 已保存', de:'✅ Gespeichert', es:'✅ Guardado', fr:'✅ Enregistré' },
  change_password: { ar:'تغيير كلمة المرور', en:'Change password', zh:'更改密码', de:'Passwort ändern', es:'Cambiar contraseña', fr:'Changer le mot de passe' },
  difficulty:    { ar:'الصعوبة',     en:'Difficulty',  zh:'难度',   de:'Schwierigkeit',  es:'Dificultad', fr:'Difficulté' },
  difficulty_easy:   { ar:'سهل',    en:'Easy',         zh:'简单',   de:'Leicht',         es:'Fácil',      fr:'Facile' },
  difficulty_medium: { ar:'متوسط',  en:'Medium',       zh:'中等',   de:'Mittel',         es:'Medio',      fr:'Moyen' },
  difficulty_hard:   { ar:'صعب',    en:'Hard',         zh:'困难',   de:'Schwer',         es:'Difícil',    fr:'Difficile' },
  hobbies_label: { ar:'الهوايات والاهتمامات', en:'Hobbies & Interests', zh:'爱好与兴趣', de:'Hobbys und Interessen', es:'Aficiones e intereses', fr:"Loisirs et intérêts" },
  grade_label:   { ar:'الصف',        en:'Grade',       zh:'年级',   de:'Klasse',         es:'Grado',      fr:'Classe' },
  subject_label: { ar:'المادة',      en:'Subject',     zh:'科目',   de:'Fach',           es:'Materia',    fr:'Matière' },
  topic_label:   { ar:'الموضوع',     en:'Topic',       zh:'主题',   de:'Thema',          es:'Tema',       fr:'Thème' },

  // ── Status ───────────────────────────
  active_label:    { ar:'نشط',       en:'Active',      zh:'活跃',   de:'Aktiv',          es:'Activo',     fr:'Actif' },
  inactive_label:  { ar:'معطل',      en:'Inactive',    zh:'停用',   de:'Inaktiv',        es:'Inactivo',   fr:'Inactif' },
  pending_label:   { ar:'معلق',      en:'Pending',     zh:'待处理', de:'Ausstehend',     es:'Pendiente',  fr:'En attente' },
  enable_btn:      { ar:'تفعيل',     en:'Enable',      zh:'启用',   de:'Aktivieren',     es:'Activar',    fr:'Activer' },
  disable_btn:     { ar:'تعطيل',     en:'Disable',     zh:'停用',   de:'Deaktivieren',   es:'Desactivar', fr:'Désactiver' },
  configured:      { ar:'معدّة',     en:'Configured',  zh:'已配置', de:'Konfiguriert',   es:'Configurado',fr:'Configuré' },
  awaiting_setup:  { ar:'بانتظار الإعداد', en:'Awaiting Setup', zh:'待设置', de:'Warten auf Einrichtung', es:'En espera de configuración', fr:"En attente de configuration" },
  under_review:    { ar:'قيد المراجعة', en:'Under Review', zh:'审核中', de:'In Bearbeitung', es:'En revisión', fr:"En cours d'examen" },
  resolved_label:  { ar:'محلول',     en:'Resolved',    zh:'已解决', de:'Gelöst',         es:'Resuelto',   fr:'Résolu' },
  not_specified:   { ar:'غير محدد',  en:'Not specified',zh:'未指定', de:'Nicht angegeben',es:'No especificado', fr:'Non spécifié' },

  // ── Navigation ────────────────────────
  student_chat:    { ar:'المحادثة',  en:'Chat',        zh:'聊天',   de:'Chat',           es:'Chat',       fr:'Discussion' },
  books:           { ar:'ملخص الكتاب', en:'Books',     zh:'书籍',   de:'Bücher',         es:'Libros',     fr:'Livres' },
  games:           { ar:'الألعاب',   en:'Games',       zh:'游戏',   de:'Spiele',         es:'Juegos',     fr:'Jeux' },
  homework:        { ar:'الواجبات',  en:'Homework',    zh:'作业',   de:'Hausaufgaben',   es:'Tarea',      fr:'Devoirs' },
  tests:           { ar:'الاختبارات',en:'Tests',       zh:'考试',   de:'Tests',          es:'Exámenes',   fr:'Tests' },
  worksheets:      { ar:'أوراق العمل',en:'Worksheets', zh:'练习册', de:'Arbeitsblätter', es:'Hojas de trabajo', fr:'Feuilles de travail' },
  image_gen:       { ar:'توليد صور', en:'Image Generation', zh:'生成图片', de:'Bild generieren', es:'Generar imagen', fr:'Générer image' },
  video_script:    { ar:'سكريبت فيديو', en:'Video Script', zh:'视频脚本', de:'Videoskript', es:'Guion de video', fr:'Script vidéo' },
  leaderboard:     { ar:'لوحة المتصدرين', en:'Leaderboard', zh:'排行榜', de:'Bestenliste', es:'Clasificación', fr:'Classement' },
  daily_challenge: { ar:'التحدي اليومي', en:'Daily Challenge', zh:'每日挑战', de:'Tägliche Herausforderung', es:'Desafío diario', fr:'Défi quotidien' },
  pomodoro:        { ar:'بومودورو',  en:'Pomodoro',    zh:'番茄钟', de:'Pomodoro',       es:'Pomodoro',   fr:'Pomodoro' },
  mood:            { ar:'مزاجي اليوم', en:'My Mood',   zh:'我的心情', de:'Meine Stimmung', es:'Mi ánimo',  fr:'Mon humeur' },
  reflection:      { ar:'التأمل اليومي', en:'Daily Reflection', zh:'每日反思', de:'Tägliche Reflexion', es:'Reflexión diaria', fr:'Réflexion quotidienne' },
  digital_library: { ar:'المكتبة الرقمية', en:'Digital Library', zh:'数字图书馆', de:'Digitale Bibliothek', es:'Biblioteca digital', fr:'Bibliothèque numérique' },
  notebook:        { ar:'دفتري الذكي', en:'Smart Notebook', zh:'智能笔记本', de:'Intelligentes Notizbuch', es:'Cuaderno inteligente', fr:'Carnet intelligent' },
  progress:        { ar:'تقدمي',     en:'My Progress', zh:'我的进度', de:'Mein Fortschritt', es:'Mi progreso', fr:'Mes progrès' },
  overview:        { ar:'نظرة عامة', en:'Overview',    zh:'概览',   de:'Übersicht',      es:'Resumen',    fr:'Aperçu' },
  students:        { ar:'الطلاب',    en:'Students',    zh:'学生们', de:'Schüler',        es:'Estudiantes',fr:'Étudiants' },
  ppt_generator:   { ar:'توليد PPT', en:'PPT Generator',zh:'PPT生成器', de:'PPT Generator', es:'Generador PPT', fr:'Générateur PPT' },
  ai_assistant:    { ar:'مساعد AI',  en:'AI Assistant',zh:'AI助手', de:'KI-Assistent',   es:'Asistente IA',fr:'Assistant IA' },
  lesson_plan:     { ar:'خطة درس',   en:'Lesson Plan', zh:'课程计划',de:'Unterrichtsplan',es:'Plan de lección', fr:'Plan de cours' },
  multimedia:      { ar:'محول الوسائط', en:'Multimedia',zh:'多媒体',  de:'Multimedia',     es:'Multimedia', fr:'Multimédia' },
  activity:        { ar:'تصميم أنشطة', en:'Activity Design', zh:'活动设计', de:'Aktivitätsdesign', es:'Diseño de actividades', fr:"Conception d'activités" },
  compose:         { ar:'صياغة رسائل', en:'Compose Messages', zh:'撰写消息', de:'Nachrichten verfassen', es:'Redactar mensajes', fr:'Rédiger des messages' },
  smart_feedback:  { ar:'تقارير ذكية', en:'Smart Reports', zh:'智能报告', de:'Intelligente Berichte', es:'Informes inteligentes', fr:'Rapports intelligents' },
  insights:        { ar:'تحليل الأداء', en:'Performance Analysis', zh:'绩效分析', de:'Leistungsanalyse', es:'Análisis de rendimiento', fr:'Analyse de performance' },
  simplify:        { ar:'تبسيط المحتوى', en:'Simplify Content', zh:'简化内容', de:'Inhalt vereinfachen', es:'Simplificar contenido', fr:'Simplifier le contenu' },
  differentiate:   { ar:'تعلم متمايز', en:'Differentiated Learning', zh:'差异化学习', de:'Differenziertes Lernen', es:'Aprendizaje diferenciado', fr:'Apprentissage différencié' },
  coach:           { ar:'مدرب تربوي', en:'Educational Coach', zh:'教育教练', de:'Bildungscoach', es:'Coach educativo', fr:'Coach éducatif' },
  research:        { ar:'أبحاث تربوية', en:'Educational Research', zh:'教育研究', de:'Bildungsforschung', es:'Investigación educativa', fr:'Recherche éducative' },
  prompt_library:  { ar:'مكتبة قوالب', en:'Prompt Library', zh:'提示词库', de:'Prompt-Bibliothek', es:'Biblioteca de prompts', fr:'Bibliothèque de prompts' },
  school_pulse:    { ar:'نبض المدرسة', en:'School Pulse', zh:'学校脉搏', de:'Schulpuls', es:'Pulso escolar', fr:"Pouls de l'école" },
  announcements:   { ar:'الإعلانات', en:'Announcements', zh:'公告',   de:'Ankündigungen',  es:'Anuncios',   fr:'Annonces' },
  incident_report: { ar:'تقرير حادثة AI', en:'AI Incident Report', zh:'AI事故报告', de:'KI-Vorfallbericht', es:'Informe de incidente IA', fr:"Rapport d'incident IA" },
  platform_pulse:  { ar:'نبض المنصة', en:'Platform Pulse', zh:'平台脉搏', de:'Plattform-Puls', es:'Pulso de plataforma', fr:"Pouls de la plateforme" },
  ai_cost:         { ar:'تكلفة AI',  en:'AI Cost',     zh:'AI成本', de:'KI-Kosten',      es:'Costo IA',   fr:'Coût IA' },
  churn_risk:      { ar:'مخاطر الإلغاء', en:'Churn Risk', zh:'流失风险', de:'Abwanderungsrisiko', es:'Riesgo de abandono', fr:'Risque de désabonnement' },
  broadcast:       { ar:'بث رسالة', en:'Broadcast',    zh:'广播消息', de:'Nachricht senden', es:'Difusión',  fr:'Diffusion' },
  manager_hub:     { ar:'لوحة المدير', en:'Manager Hub', zh:'经理中心', de:'Manager-Hub', es:'Panel del gerente', fr:'Hub gestionnaire' },
  admin_hub:       { ar:'لوحة المشرف', en:'Admin Hub', zh:'管理员中心', de:'Admin-Hub', es:'Panel del admin', fr:'Hub admin' },
  teacher_hub:     { ar:'لوحة المعلم', en:'Teacher Hub', zh:'教师中心', de:'Lehrer-Hub', es:'Panel del profesor', fr:'Hub enseignant' },
  student_hub:     { ar:'لوحة الطالب', en:'Student Hub', zh:'学生中心', de:'Schüler-Hub', es:'Panel del estudiante', fr:'Hub étudiant' },

  // ── Manager ───────────────────────────
  schools:          { ar:'المدارس',     en:'Schools',      zh:'学校',   de:'Schulen',        es:'Escuelas',   fr:'Écoles' },
  accounts:         { ar:'الحسابات',   en:'Accounts',     zh:'账户',   de:'Konten',         es:'Cuentas',    fr:'Comptes' },
  statistics:       { ar:'الإحصائيات', en:'Statistics',   zh:'统计',   de:'Statistiken',    es:'Estadísticas',fr:'Statistiques' },
  upload_excel:     { ar:'رفع Excel',  en:'Upload Excel', zh:'上传Excel',de:'Excel hochladen',es:'Subir Excel', fr:'Importer Excel' },
  add_school:       { ar:'إضافة مدرسة', en:'Add School',  zh:'添加学校',de:'Schule hinzufügen',es:'Añadir escuela',fr:'Ajouter école' },
  school_name:      { ar:'اسم المدرسة', en:'School Name', zh:'学校名称',de:'Schulname',      es:'Nombre de escuela',fr:"Nom d'école" },
  branch:           { ar:'الفرع',      en:'Branch',       zh:'分校',   de:'Filiale',        es:'Sucursal',   fr:'Filiale' },
  ministry_code:    { ar:'كود الوزارة', en:'Ministry Code',zh:'部委代码',de:'Ministeriumscode',es:'Código ministerio',fr:'Code ministère' },
  complaints:       { ar:'الشكاوى',    en:'Complaints',   zh:'投诉',   de:'Beschwerden',    es:'Quejas',     fr:'Plaintes' },
  all_users:        { ar:'كل المستخدمين',en:'All Users',  zh:'所有用户',de:'Alle Benutzer',  es:'Todos los usuarios',fr:'Tous les utilisateurs' },
  school_management:{ ar:'إدارة المدارس',en:'School Management',zh:'学校管理',de:'Schulverwaltung',es:'Gestión de escuelas',fr:'Gestion des écoles' },
  add_new_school:   { ar:'إضافة مدرسة جديدة',en:'Add New School',zh:'添加新学校',de:'Neue Schule hinzufügen',es:'Añadir nueva escuela',fr:'Ajouter une école' },
  registered_schools:{ar:'المدارس المسجلة',en:'Registered Schools',zh:'注册学校',de:'Registrierte Schulen',es:'Escuelas registradas',fr:'Écoles enregistrées' },
  no_schools_yet:   { ar:'لا توجد مدارس بعد.',en:'No schools yet.',zh:'暂无学校。',de:'Noch keine Schulen.',es:'Aún no hay escuelas.',fr:"Pas encore d'écoles." },
  actions_label:    { ar:'إجراءات',    en:'Actions',      zh:'操作',   de:'Aktionen',       es:'Acciones',   fr:'Actions' },
  generated_accounts:{ar:'الحسابات المُولَّدة',en:'Generated Accounts',zh:'生成的账户',de:'Generierte Konten',es:'Cuentas generadas',fr:'Comptes générés' },
  curriculum_books: { ar:'كتب المنهج', en:'Curriculum Books',zh:'课程书籍',de:'Lehrpläne',  es:'Libros de currículum',fr:'Livres de programme' },
  add_new_book:     { ar:'إضافة كتاب جديد',en:'Add New Book',zh:'添加新书',de:'Neues Buch hinzufügen',es:'Añadir nuevo libro',fr:'Ajouter un nouveau livre' },
  add_book:         { ar:'إضافة الكتاب',en:'Add Book',    zh:'添加书籍',de:'Buch hinzufügen',es:'Añadir libro',fr:'Ajouter le livre' },
  no_books_yet:     { ar:'لا توجد كتب بعد.',en:'No books yet.',zh:'暂无书籍。',de:'Noch keine Bücher.',es:'Aún no hay libros.',fr:"Pas encore de livres." },
  school_health:    { ar:'صحة المدارس', en:'School Health',zh:'学校健康',de:'Schulgesundheit',es:'Salud escolar',fr:'Santé des écoles' },
  strategic_advisor:{ ar:'المستشار الاستراتيجي',en:'Strategic Advisor',zh:'战略顾问',de:'Strategischer Berater',es:'Asesor estratégico',fr:'Conseiller stratégique' },
  smart_asst:       { ar:'مساعد المدير الذكي',en:'Smart Assistant',zh:'智能助手',de:'Intelligenter Assistent',es:'Asistente inteligente',fr:'Assistant intelligent' },
  no_accounts_yet:  { ar:'لا توجد حسابات بعد.',en:'No accounts yet.',zh:'暂无账户。',de:'Noch keine Konten.',es:'Aún no hay cuentas.',fr:"Pas encore de comptes." },

  // ── Student hub ───────────────────────
  new_chat:         { ar:'+محادثة جديدة', en:'+ New Chat', zh:'+ 新对话', de:'+ Neues Gespräch', es:'+ Nueva conversación', fr:'+ Nouvelle discussion' },
  no_conversations: { ar:'لا توجد محادثات', en:'No conversations', zh:'无对话', de:'Keine Gespräche', es:'Sin conversaciones', fr:'Aucune discussion' },
  no_book:          { ar:'بدون',          en:'None',        zh:'无',     de:'Kein',           es:'Ninguno',    fr:'Aucun' },
  how_can_i_help:   { ar:'كيف يمكنني مساعدتك اليوم؟', en:'How can I help you today?', zh:'今天我能帮你什么？', de:'Wie kann ich dir heute helfen?', es:'¿Cómo puedo ayudarte hoy?', fr:"Comment puis-je vous aider aujourd'hui?" },
  type_question:    { ar:'اكتب سؤالك...', en:'Type your question...', zh:'输入您的问题...', de:'Ihre Frage eingeben...', es:'Escribe tu pregunta...', fr:'Tapez votre question...' },
  book_label:       { ar:'📖 كتاب:',     en:'📖 Book:',    zh:'📖 书籍：',de:'📖 Buch:',       es:'📖 Libro:',  fr:'📖 Livre:' },
  select_book:      { ar:'اختر كتاباً...',en:'Select a book...',zh:'选择一本书...', de:'Buch auswählen...', es:'Seleccionar libro...', fr:'Choisir un livre...' },
  summarize_book:   { ar:'لخص الكتاب',   en:'Summarize Book',zh:'总结书籍', de:'Buch zusammenfassen', es:'Resumir libro', fr:'Résumer le livre' },
  listen_btn:       { ar:'استمع',        en:'Listen',      zh:'收听',   de:'Anhören',        es:'Escuchar',   fr:'Écouter' },
  stop_audio:       { ar:'إيقاف',        en:'Stop',        zh:'停止',   de:'Stopp',          es:'Detener',    fr:'Arrêter' },
  ask_about_book:   { ar:'اسأل عن الكتاب',en:'Ask about the book',zh:'询问书籍内容',de:'Über das Buch fragen',es:'Preguntar sobre el libro',fr:'Poser une question sur le livre' },
  educational_games:{ ar:'الألعاب التعليمية',en:'Educational Games',zh:'教育游戏',de:'Lernspiele',es:'Juegos educativos',fr:'Jeux éducatifs' },
  multiple_choice:  { ar:'اختيار من متعدد',en:'Multiple Choice',zh:'多选题',de:'Multiple Choice',es:'Opción múltiple',fr:'Choix multiple' },
  matching:         { ar:'مطابقة المصطلحات',en:'Term Matching',zh:'术语匹配',de:'Begriffe zuordnen',es:'Emparejar términos',fr:'Associer les termes' },
  flashcards_label: { ar:'بطاقات تعليمية',en:'Flashcards',zh:'闪卡',de:'Lernkarten',es:'Tarjetas de aprendizaje',fr:"Cartes d'apprentissage" },
  start_game:       { ar:'ابدأ اللعبة', en:'Start Game',  zh:'开始游戏',de:'Spiel starten', es:'Iniciar juego',fr:'Démarrer le jeu' },
  past_games:       { ar:'ألعابي السابقة',en:'My Past Games',zh:'我的历史游戏',de:'Meine früheren Spiele',es:'Mis juegos anteriores',fr:'Mes jeux précédents' },
  next_btn:         { ar:'التالي ▶',    en:'Next ▶',      zh:'下一个 ▶',de:'Weiter ▶',      es:'Siguiente ▶',fr:'Suivant ▶' },
  finish_btn:       { ar:'إنهاء 🏁',    en:'Finish 🏁',   zh:'完成 🏁', de:'Beenden 🏁',    es:'Finalizar 🏁',fr:'Terminer 🏁' },
  excellent:        { ar:'ممتاز!',      en:'Excellent!',  zh:'优秀！', de:'Ausgezeichnet!', es:'¡Excelente!', fr:'Excellent!' },
  good_keep_going:  { ar:'جيد! استمر!', en:'Good! Keep going!', zh:'不错！继续！', de:'Gut! Weiter so!', es:'¡Bien! ¡Continúa!', fr:'Bien ! Continue !' },
  try_again:        { ar:'حاول مرة أخرى!',en:'Try again!',zh:'再试一次！',de:'Nochmal versuchen!',es:'¡Inténtalo de nuevo!',fr:'Réessaie !' },
  no_homework:      { ar:'لا توجد واجبات حالياً',en:'No homework currently',zh:'目前没有作业',de:'Derzeit keine Hausaufgaben',es:'Sin tareas actualmente',fr:'Aucun devoir pour le moment' },
  no_tests:         { ar:'لا توجد اختبارات',en:'No tests',zh:'没有测试',de:'Keine Tests',es:'Sin exámenes',fr:'Aucun test' },
  no_worksheets:    { ar:'لا توجد أوراق عمل',en:'No worksheets',zh:'没有练习册',de:'Keine Arbeitsblätter',es:'Sin hojas de trabajo',fr:'Aucune feuille de travail' },
  your_answer:      { ar:'إجابتك هنا...',en:'Your answer here...',zh:'在此输入答案...',de:'Deine Antwort hier...',es:'Tu respuesta aquí...',fr:'Votre réponse ici...' },
  generate_image:   { ar:'توليد الصورة',en:'Generate Image',zh:'生成图片',de:'Bild generieren',es:'Generar imagen',fr:"Générer l'image" },
  video_topic:      { ar:'موضوع الفيديو',en:'Video Topic',zh:'视频主题',de:'Videothema',es:'Tema del video',fr:'Sujet de la vidéo' },
  generate_script:  { ar:'توليد السكريبت',en:'Generate Script',zh:'生成脚本',de:'Skript generieren',es:'Generar guion',fr:'Générer le script' },
  school_heroes:    { ar:'أبطال مدرستك — أفضل 10 طلاب',en:'School Heroes — Top 10 Students',zh:'学校英雄 — 前10名',de:'Schulhelden — Top 10',es:'Héroes de la escuela — Top 10',fr:"Héros de l'école — Top 10" },
  you_label:        { ar:'(أنت)',       en:'(You)',        zh:'(你)',   de:'(Du)',           es:'(Tú)',       fr:'(Vous)' },
  answered_challenge:{ ar:'أجبت على تحدي اليوم!',en:"You answered today's challenge!",zh:'你已完成今日挑战！',de:'Du hast die heutige Herausforderung beantwortet!',es:'¡Respondiste el desafío de hoy!',fr:"Vous avez répondu au défi du jour!" },
  come_back_tomorrow:{ ar:'عد غداً لتحدي جديد 🌅',en:'Come back tomorrow 🌅',zh:'明天再来 🌅',de:'Komm morgen wieder 🌅',es:'Vuelve mañana 🌅',fr:'Revenez demain 🌅' },
  focus_time:       { ar:'وقت التركيز',en:'Focus Time',   zh:'专注时间',de:'Fokuszeit',     es:'Tiempo de enfoque',fr:'Temps de concentration' },
  break_time:       { ar:'استراحة',    en:'Break',        zh:'休息',   de:'Pause',          es:'Descanso',   fr:'Pause' },
  how_feeling:      { ar:'كيف تشعر اليوم؟',en:'How are you feeling today?',zh:'今天感觉如何？',de:'Wie fühlst du dich heute?',es:'¿Cómo te sientes hoy?',fr:"Comment vous sentez-vous aujourd'hui?" },
  write_reflection: { ar:'اكتب تأملك هنا...',en:'Write your reflection here...',zh:'在此写下您的反思...',de:'Schreibe deine Reflexion hier...',es:'Escribe tu reflexión aquí...',fr:'Écrivez votre réflexion ici...' },
  save_stars:       { ar:'احفظ + 3 نجوم',en:'Save + 3 Stars',zh:'保存 + 3颗星',de:'Speichern + 3 Sterne',es:'Guardar + 3 Estrellas',fr:'Enregistrer + 3 Étoiles' },
  free_library:     { ar:'المكتبة الرقمية المجانية',en:'Free Digital Library',zh:'免费数字图书馆',de:'Kostenlose digitale Bibliothek',es:'Biblioteca digital gratuita',fr:'Bibliothèque numérique gratuite' },
  total_stars:      { ar:'إجمالي النجوم',en:'Total Stars',zh:'总星数',de:'Gesamtsterne',es:'Estrellas totales',fr:'Étoiles totales' },
  ai_conversations: { ar:'محادثات AI', en:'AI Conversations',zh:'AI对话',de:'KI-Gespräche',es:'Conversaciones IA',fr:'Discussions IA' },
  completed_games:  { ar:'ألعاب مكتملة',en:'Completed Games',zh:'完成的游戏',de:'Abgeschlossene Spiele',es:'Juegos completados',fr:'Jeux complétés' },
  consecutive_days: { ar:'أيام متتالية',en:'Consecutive Days',zh:'连续天数',de:'Aufeinanderfolgende Tage',es:'Días consecutivos',fr:'Jours consécutifs' },
  learning_style:   { ar:'أسلوب التعلم',en:'Learning Style',zh:'学习风格',de:'Lernstil',es:'Estilo de aprendizaje',fr:"Style d'apprentissage" },
  visual:           { ar:'بصري',      en:'Visual',       zh:'视觉型', de:'Visuell',        es:'Visual',     fr:'Visuel' },
  auditory:         { ar:'سمعي',      en:'Auditory',     zh:'听觉型', de:'Auditiv',        es:'Auditivo',   fr:'Auditif' },
  kinesthetic:      { ar:'حركي',      en:'Kinesthetic',  zh:'动觉型', de:'Kinästhetisch',  es:'Kinestésico',fr:'Kinesthésique' },
  complaint_suggestion: { ar:'شكوى / اقتراح',en:'Complaint / Suggestion',zh:'投诉 / 建议',de:'Beschwerde / Vorschlag',es:'Queja / Sugerencia',fr:'Plainte / Suggestion' },
  upload_file:      { ar:'رفع ملف',   en:'Upload File',  zh:'上传文件',de:'Datei hochladen',es:'Subir archivo',fr:'Télécharger un fichier' },
  ask_about_file:   { ar:'اسأل عن الملف',en:'Ask about the file',zh:'询问文件内容',de:'Über die Datei fragen',es:'Preguntar sobre el archivo',fr:'Poser une question sur le fichier' },
  generate_content: { ar:'ولّد محتوى',en:'Generate Content',zh:'生成内容',de:'Inhalt generieren',es:'Generar contenido',fr:'Générer du contenu' },
  extracting_text:  { ar:'جاري استخراج النص...',en:'Extracting text...',zh:'提取文字中...',de:'Text wird extrahiert...',es:'Extrayendo texto...',fr:'Extraction du texte...' },
  comprehensive_summary: { ar:'ملخص شامل',en:'Comprehensive Summary',zh:'全面摘要',de:'Umfassende Zusammenfassung',es:'Resumen completo',fr:'Résumé complet' },
  mind_map:         { ar:'خريطة ذهنية',en:'Mind Map',zh:'思维导图',de:'Mindmap',es:'Mapa mental',fr:'Carte mentale' },
  review_questions: { ar:'أسئلة مراجعة',en:'Review Questions',zh:'复习题',de:'Übungsfragen',es:'Preguntas de repaso',fr:'Questions de révision' },
  key_points:       { ar:'النقاط الجوهرية',en:'Key Points',zh:'关键要点',de:'Schlüsselpunkte',es:'Puntos clave',fr:'Points clés' },
  podcast_script:   { ar:'سكربت بودكاست',en:'Podcast Script',zh:'播客脚本',de:'Podcast-Skript',es:'Guion de podcast',fr:'Script de podcast' },
  view_submissions: { ar:'عرض التسليمات',en:'View Submissions',zh:'查看提交',de:'Einreichungen ansehen',es:'Ver entregas',fr:'Voir les soumissions' },
  no_students:      { ar:'لا يوجد طلاب',en:'No students',zh:'没有学生',de:'Keine Schüler',es:'Sin estudiantes',fr:'Aucun étudiant' },
  no_data:          { ar:'لا توجد بيانات',en:'No data',zh:'无数据',de:'Keine Daten',es:'Sin datos',fr:'Aucune donnée' },
  reset_password:   { ar:'إعادة تعيين كلمة مرور',en:'Reset Password',zh:'重置密码',de:'Passwort zurücksetzen',es:'Restablecer contraseña',fr:'Réinitialiser le mot de passe' },
  active_today:     { ar:'نشط اليوم', en:'Active Today', zh:'今日活跃',de:'Heute aktiv',  es:'Activo hoy', fr:"Actif aujourd'hui" },
  active_weekly:    { ar:'نشط أسبوعياً',en:'Active Weekly',zh:'每周活跃',de:'Wöchentlich aktiv',es:'Activo semanalmente',fr:'Actif hebdomadaire' },
  no_complaints:    { ar:'لا توجد شكاوى',en:'No complaints',zh:'没有投诉',de:'Keine Beschwerden',es:'Sin quejas',fr:'Aucune plainte' },
  no_schools_at_risk:{ ar:'لا توجد مدارس في خطر الإلغاء حالياً',en:'No schools at churn risk',zh:'目前没有流失风险的学校',de:'Keine Schulen mit Abwanderungsrisiko',es:'Sin escuelas en riesgo',fr:"Aucune école à risque" },
  broadcast_message:{ ar:'بث رسالة لكل المنصة',en:'Broadcast to All Platform',zh:'向全平台广播',de:'An alle senden',es:'Transmitir a toda la plataforma',fr:'Diffuser à toute la plateforme' },

  // ── Login ─────────────────────────────
  try_demo:         { ar:'جرّب بيانات تجريبية:', en:'Try demo credentials:', zh:'试用演示账号：', de:'Demo-Zugangsdaten:', es:'Prueba las credenciales demo:', fr:'Essayez les identifiants démo :' },
  all_rights:       { ar:'جميع الحقوق محفوظة.', en:'All rights reserved.', zh:'版权所有。', de:'Alle Rechte vorbehalten.', es:'Todos los derechos reservados.', fr:'Tous droits réservés.' },
  login_button:     { ar:'تسجيل الدخول →', en:'Login →', zh:'登录 →', de:'Anmelden →', es:'Iniciar sesión →', fr:'Connexion →' },
  login_error:      { ar:'الإيميل أو كلمة المرور غلط', en:'Invalid email or password', zh:'邮箱或密码错误', de:'Ungültige E-Mail oder Passwort', es:'Email o contraseña inválidos', fr:'Email ou mot de passe invalide' },

  // ── Login page navbar ─────────────────
  features_nav:     { ar:'المميزات',    en:'Features',    zh:'功能特色', de:'Funktionen',     es:'Características', fr:'Fonctionnalités' },
  roles_nav:        { ar:'لمن نحن',    en:'Who We Are',  zh:'用户角色', de:'Für wen',         es:'¿Para quién?',    fr:'Pour qui' },
  stats_nav:        { ar:'الأرقام',    en:'Stats',       zh:'数据统计', de:'Statistiken',     es:'Estadísticas',    fr:'Statistiques' },
  start_now:        { ar:'ابدأ الآن', en:'Start Now',   zh:'立即开始', de:'Jetzt starten',   es:'Empieza ahora',   fr:'Commencer' },
  hero_title_1:     { ar:'تعلّم بذكاء', en:'Learn Smarter', zh:'智能学习', de:'Intelligent lernen', es:'Aprende con inteligencia', fr:'Apprenez intelligemment' },
  hero_title_2:     { ar:'مع الذكاء الاصطناعي', en:'with AI', zh:'借助人工智能', de:'mit KI', es:'con IA', fr:"avec l'IA" },
  hero_sub:         { ar:'موريكس — منصة تعليمية متكاملة تجمع بين الذكاء الاصطناعي والتعليم الشخصي.', en:'Morix — A comprehensive educational platform combining AI and personalized learning.', zh:'Morix — 结合AI与个性化教育的综合学习平台。', de:'Morix — Eine umfassende Lernplattform, die KI und personalisiertes Lernen verbindet.', es:'Morix — Plataforma educativa integral que combina IA y aprendizaje personalizado.', fr:"Morix — Plateforme éducative complète alliant l'IA et l'apprentissage personnalisé." },
  start_journey:    { ar:'ابدأ رحلتك التعليمية', en:'Start Your Learning Journey', zh:'开始您的学习之旅', de:'Starte deine Lernreise', es:'Comienza tu viaje educativo', fr:'Commencez votre parcours éducatif' },
  join_thousands:   { ar:'سجّل دخولك وانضم إلى آلاف الطلاب والمعلمين', en:'Login and join thousands of students and teachers', zh:'登录并加入数以千计的学生和教师', de:'Melde dich an und werde Teil einer wachsenden Gemeinschaft', es:'Inicia sesión y únete a miles de estudiantes y profesores', fr:"Connectez-vous et rejoignez des milliers d'étudiants et d'enseignants" },
  footer_tagline:   { ar:'منصة التعلم الذكي', en:'Smart Learning Platform', zh:'智能学习平台', de:'Intelligente Lernplattform', es:'Plataforma de Aprendizaje Inteligente', fr:"Plateforme d'Apprentissage Intelligent" },

  // ── Login page — hero & misc ──────────
  hero_badge:       { ar:'🚀 منصة التعلم الذكي #1', en:'🚀 #1 Smart Learning Platform', zh:'🚀 #1 智能学习平台', de:'🚀 #1 Intelligente Lernplattform', es:'🚀 Plataforma de Aprendizaje #1', fr:"🚀 Plateforme d'Apprentissage #1" },
  hero_for:         { ar:'للطلاب، المعلمين، والمدارس.', en:'For students, teachers, and schools.', zh:'面向学生、教师和学校。', de:'Für Schüler, Lehrer und Schulen.', es:'Para estudiantes, profesores y escuelas.', fr:'Pour les étudiants, enseignants et écoles.' },
  discover_more:    { ar:'اكتشف المزيد ↓', en:'Discover More ↓', zh:'了解更多 ↓', de:'Mehr erfahren ↓', es:'Descubre más ↓', fr:'En savoir plus ↓' },

  // Float cards
  fc_ai:            { ar:'مساعد AI', en:'AI Assistant', zh:'AI助手', de:'KI-Assistent', es:'Asistente IA', fr:'Assistant IA' },
  fc_games:         { ar:'ألعاب تعليمية', en:'Educational Games', zh:'教育游戏', de:'Lernspiele', es:'Juegos educativos', fr:'Jeux éducatifs' },
  fc_analytics:     { ar:'تحليل الأداء', en:'Analytics', zh:'成绩分析', de:'Analyse', es:'Análisis', fr:'Analytique' },
  fc_leaderboard:   { ar:'لوحة المتصدرين', en:'Leaderboard', zh:'排行榜', de:'Bestenliste', es:'Clasificación', fr:'Classement' },

  // Stats
  stat_students:    { ar:'طالب نشط', en:'Active Students', zh:'活跃学生', de:'Aktive Schüler', es:'Estudiantes activos', fr:'Étudiants actifs' },
  stat_teachers:    { ar:'معلم محترف', en:'Pro Teachers', zh:'专业教师', de:'Professionelle Lehrer', es:'Profesores', fr:'Enseignants pro' },
  stat_schools_lbl: { ar:'مدرسة', en:'Schools', zh:'学校', de:'Schulen', es:'Escuelas', fr:'Écoles' },
  stat_satisfaction:{ ar:'رضا المستخدمين', en:'User Satisfaction', zh:'用户满意度', de:'Zufriedenheit', es:'Satisfacción', fr:'Satisfaction' },

  // Features section
  feat_tag:         { ar:'✨ المميزات', en:'✨ Features', zh:'✨ 功能特色', de:'✨ Funktionen', es:'✨ Características', fr:'✨ Fonctionnalités' },
  feat_title:       { ar:'كل ما تحتاجه في مكان واحد', en:'Everything You Need in One Place', zh:'所需一切尽在一处', de:'Alles was du brauchst', es:'Todo en un solo lugar', fr:'Tout en un seul endroit' },
  feat_sub:         { ar:'منصة شاملة مدعومة بأحدث تقنيات الذكاء الاصطناعي', en:'A comprehensive platform powered by the latest AI', zh:'由最新AI技术驱动的综合平台', de:'Eine umfassende KI-Plattform', es:'Plataforma integral con la última IA', fr:"Plateforme complète alimentée par l'IA" },

  feat_ai_t:        { ar:'مساعد AI ذكي', en:'Smart AI Assistant', zh:'智能AI助手', de:'KI-Assistent', es:'Asistente IA', fr:'Assistant IA' },
  feat_ai_d:        { ar:'محادثات تعليمية مدعومة بـ Gemini AI مع إمكانية رفع الملفات والصور', en:'Educational chats powered by Gemini AI with file & image upload', zh:'Gemini AI教育对话，支持文件和图片', de:'Bildungschats mit Gemini AI, Datei- und Bild-Upload', es:'Chats educativos con Gemini AI y soporte de archivos', fr:'Discussions éducatives Gemini AI avec fichiers et images' },
  feat_games_t:     { ar:'ألعاب تعليمية', en:'Educational Games', zh:'教育游戏', de:'Lernspiele', es:'Juegos educativos', fr:'Jeux éducatifs' },
  feat_games_d:     { ar:'اختبارات MCQ وبطاقات تعليمية ومطابقة المفاهيم بشكل تفاعلي ممتع', en:'MCQ quizzes, flashcards, and concept matching — fun & interactive', zh:'MCQ测验、闪卡和概念匹配', de:'MCQ-Quiz, Lernkarten und Konzeptzuordnung', es:'Cuestionarios MCQ, tarjetas y emparejamiento interactivo', fr:'Quiz MCQ, cartes et association de concepts' },
  feat_perf_t:      { ar:'تحليل الأداء', en:'Performance Analytics', zh:'成绩分析', de:'Leistungsanalyse', es:'Análisis de rendimiento', fr:'Analyse de performance' },
  feat_perf_d:      { ar:'رسوم بيانية وإحصاءات مفصلة لتتبع تقدم الطلاب وتحديد نقاط الضعف', en:'Charts and statistics to track progress and identify weaknesses', zh:'图表和统计数据跟踪学生进度', de:'Diagramme und Statistiken zum Lernfortschritt', es:'Gráficos y estadísticas para seguir el progreso', fr:'Graphiques et statistiques de progression' },
  feat_books_t:     { ar:'ملخصات الكتب', en:'Book Summaries', zh:'书籍摘要', de:'Buchzusammenfassungen', es:'Resúmenes de libros', fr:'Résumés de livres' },
  feat_books_d:     { ar:'رفع الكتب وتوليد ملخصات ذكية وأسئلة تفاعلية بضغطة واحدة', en:'Upload books and generate smart summaries with one click', zh:'上传书籍一键生成智能摘要', de:'Bücher hochladen und Zusammenfassungen generieren', es:'Sube libros y genera resúmenes inteligentes', fr:'Téléchargez des livres et générez des résumés' },
  feat_points_t:    { ar:'نظام النقاط', en:'Points System', zh:'积分系统', de:'Punktesystem', es:'Sistema de puntos', fr:'Système de points' },
  feat_points_d:    { ar:'نجوم ومتصدرون وتحديات يومية لتحفيز الطلاب على الاستمرار', en:'Stars, leaderboards, and daily challenges to keep students motivated', zh:'星星、排行榜和每日挑战激励学习', de:'Sterne, Bestenlisten und tägliche Herausforderungen', es:'Estrellas, clasificaciones y desafíos diarios', fr:'Étoiles, classements et défis quotidiens' },
  feat_hw_t:        { ar:'واجبات واختبارات', en:'Homework & Tests', zh:'作业和考试', de:'Hausaufgaben & Tests', es:'Tareas y exámenes', fr:'Devoirs et tests' },
  feat_hw_d:        { ar:'إنشاء وتوزيع الواجبات والاختبارات وتصحيحها تلقائياً بالذكاء الاصطناعي', en:'Create, distribute, and auto-grade homework & tests with AI', zh:'创建分发作业考试AI自动批改', de:'Hausaufgaben und Tests automatisch korrigieren', es:'Crea y corrige automáticamente tareas con IA', fr:'Créez et corrigez automatiquement devoirs et tests' },
  feat_ppt_t:       { ar:'توليد PPT وصور', en:'PPT & Image Gen', zh:'PPT和图片生成', de:'PPT & Bilder', es:'Generación PPT', fr:'Génération PPT' },
  feat_ppt_d:       { ar:'توليد عروض تقديمية وصور تعليمية بالذكاء الاصطناعي في ثوانٍ', en:'Generate presentations and educational images with AI in seconds', zh:'AI秒速生成演示文稿和教育图片', de:'Präsentationen mit KI in Sekunden erstellen', es:'Genera presentaciones con IA en segundos', fr:'Générez des présentations avec l\'IA en secondes' },
  feat_langs_t:     { ar:'٦ لغات', en:'6 Languages', zh:'6种语言', de:'6 Sprachen', es:'6 idiomas', fr:'6 langues' },
  feat_langs_d:     { ar:'دعم كامل للعربية والإنجليزية والصينية والألمانية والإسبانية والفرنسية', en:'Full support for Arabic, English, Chinese, German, Spanish & French', zh:'支持阿拉伯语英语中文德语西班牙语法语', de:'Arabisch, Englisch, Chinesisch, Deutsch, Spanisch & Französisch', es:'Árabe, inglés, chino, alemán, español y francés', fr:'Arabe, anglais, chinois, allemand, espagnol et français' },
  feat_pomo_t:      { ar:'بومودورو ذكي', en:'Smart Pomodoro', zh:'智能番茄钟', de:'Pomodoro', es:'Pomodoro inteligente', fr:'Pomodoro intelligent' },
  feat_pomo_d:      { ar:'مؤقت دراسة مدمج مع تتبع جلسات التركيز وتقنيات التعلم الفعّال', en:'Built-in study timer with focus tracking and effective learning techniques', zh:'内置学习计时器跟踪专注时段', de:'Lerntimer mit Fokus-Tracking', es:'Temporizador de estudio con seguimiento de enfoque', fr:'Minuteur avec suivi de concentration' },

  // Roles section
  roles_tag:        { ar:'👥 لمن نحن', en:'👥 Who We Serve', zh:'👥 服务对象', de:'👥 Für wen', es:'👥 ¿Para quién?', fr:'👥 Pour qui' },
  roles_title:      { ar:'منصة لكل أدوار التعليم', en:'A Platform for Every Education Role', zh:'面向所有教育角色的平台', de:'Für alle Bildungsrollen', es:'Para todos los roles educativos', fr:'Pour tous les rôles éducatifs' },
  role_mgr_t:       { ar:'مدير المدرسة', en:'School Manager', zh:'学校管理者', de:'Schulleiter', es:'Director', fr:"Directeur d'école" },
  role_mgr_1:       { ar:'إنشاء وإدارة المدارس', en:'Create & manage schools', zh:'创建管理学校', de:'Schulen verwalten', es:'Crear y gestionar escuelas', fr:'Créer et gérer des écoles' },
  role_mgr_2:       { ar:'رفع بيانات الطلاب Excel', en:'Upload student data via Excel', zh:'Excel上传学生数据', de:'Schülerdaten per Excel', es:'Subir datos vía Excel', fr:'Importer via Excel' },
  role_mgr_3:       { ar:'المستشار الاستراتيجي AI', en:'AI Strategic Advisor', zh:'AI战略顾问', de:'KI-Strategieberater', es:'Asesor estratégico IA', fr:'Conseiller stratégique IA' },
  role_mgr_4:       { ar:'إدارة الكتب والمحتوى', en:'Manage books & content', zh:'管理书籍内容', de:'Bücher verwalten', es:'Gestionar contenido', fr:'Gérer le contenu' },
  role_adm_t:       { ar:'المشرف الإداري', en:'School Admin', zh:'学校管理员', de:'Verwalter', es:'Administrador', fr:'Administrateur' },
  role_adm_1:       { ar:'متابعة الطلاب والأنشطة', en:'Monitor students & activities', zh:'监控学生活动', de:'Schüler überwachen', es:'Seguimiento de estudiantes', fr:'Suivi des étudiants' },
  role_adm_2:       { ar:'إعلانات المدرسة', en:'School announcements', zh:'学校公告', de:'Schulankündigungen', es:'Anuncios escolares', fr:'Annonces scolaires' },
  role_adm_3:       { ar:'تقارير الحوادث بالذكاء', en:'AI incident reports', zh:'AI事故报告', de:'KI-Vorfallsberichte', es:'Informes de incidentes IA', fr:"Rapports d'incidents IA" },
  role_adm_4:       { ar:'لوحة صحة المدرسة', en:'School health dashboard', zh:'学校健康仪表板', de:'Schul-Dashboard', es:'Panel de salud escolar', fr:'Tableau de bord scolaire' },
  role_tch_t:       { ar:'المعلم', en:'Teacher', zh:'教师', de:'Lehrer', es:'Profesor', fr:'Enseignant' },
  role_tch_1:       { ar:'توليد خطط الدروس AI', en:'AI lesson plan generation', zh:'AI生成教案', de:'KI-Unterrichtsplanung', es:'Planes de lección con IA', fr:'Plans de cours IA' },
  role_tch_2:       { ar:'إنشاء واجبات واختبارات', en:'Create homework & tests', zh:'创建作业考试', de:'Hausaufgaben erstellen', es:'Crear tareas y exámenes', fr:'Créer devoirs et tests' },
  role_tch_3:       { ar:'دفتر ذكي لتحليل الملفات', en:'Smart notebook for file analysis', zh:'智能笔记本分析文件', de:'Intelligentes Notizbuch', es:'Cuaderno inteligente', fr:'Carnet intelligent' },
  role_tch_4:       { ar:'تقارير أداء الطلاب', en:'Student performance reports', zh:'学生成绩报告', de:'Leistungsberichte', es:'Informes de rendimiento', fr:'Rapports de performance' },
  role_std_t:       { ar:'الطالب', en:'Student', zh:'学生', de:'Schüler', es:'Estudiante', fr:'Étudiant' },
  role_std_1:       { ar:'محادثات AI مخصصة', en:'Personalized AI chats', zh:'个性化AI对话', de:'Personalisierte KI-Chats', es:'Chats IA personalizados', fr:'Discussions IA personnalisées' },
  role_std_2:       { ar:'ألعاب وتحديات يومية', en:'Games & daily challenges', zh:'游戏和每日挑战', de:'Spiele & Herausforderungen', es:'Juegos y desafíos diarios', fr:'Jeux et défis quotidiens' },
  role_std_3:       { ar:'ملخصات الكتب التفاعلية', en:'Interactive book summaries', zh:'互动书籍摘要', de:'Interaktive Zusammenfassungen', es:'Resúmenes interactivos', fr:'Résumés interactifs' },
  role_std_4:       { ar:'تتبع التقدم والنجوم', en:'Progress & star tracking', zh:'进度和星星追踪', de:'Fortschritts-Tracking', es:'Seguimiento de progreso', fr:'Suivi des progrès' },

  // Login features list
  lf_multilang:     { ar:'واجهة متعددة اللغات (٦ لغات)', en:'Multilingual interface (6 languages)', zh:'多语言界面（6种语言）', de:'Mehrsprachig (6 Sprachen)', es:'Multilingüe (6 idiomas)', fr:'Multilingue (6 langues)' },
  lf_themes:        { ar:'نظام ثيمات متعدد (داكن / فاتح / مكتبة)', en:'Multiple themes (Dark / Light / Library)', zh:'多主题（深色/浅色/图书馆）', de:'Mehrere Themes (Dunkel/Hell/Bibliothek)', es:'Temas (Oscuro / Claro / Biblioteca)', fr:'Thèmes (Sombre / Clair / Bibliothèque)' },
  lf_security:      { ar:'حماية كاملة للبيانات', en:'Complete data protection', zh:'完整的数据保护', de:'Datenschutz', es:'Protección de datos', fr:'Protection des données' },
  lf_instant:       { ar:'وصول فوري بعد تسجيل الدخول', en:'Instant access after login', zh:'登录后即时访问', de:'Sofortiger Zugang', es:'Acceso instantáneo', fr:'Accès instantané' },

  // ── Subjects ──────────────────────────
  select_subject:   { ar:'اختر المادة *', en:'Select Subject *', zh:'选择科目 *', de:'Fach wählen *', es:'Seleccionar materia *', fr:'Choisir la matière *' },
  book_title_ph:    { ar:'عنوان الكتاب *', en:'Book Title *', zh:'书名 *', de:'Buchtitel *', es:'Título del libro *', fr:'Titre du livre *' },
  subj_arabic:      { ar:'اللغة العربية', en:'Arabic', zh:'阿拉伯语', de:'Arabisch', es:'Árabe', fr:'Arabe' },
  subj_english:     { ar:'اللغة الإنجليزية', en:'English', zh:'英语', de:'Englisch', es:'Inglés', fr:'Anglais' },
  subj_math:        { ar:'الرياضيات', en:'Mathematics', zh:'数学', de:'Mathematik', es:'Matemáticas', fr:'Mathématiques' },
  subj_science:     { ar:'العلوم', en:'Science', zh:'科学', de:'Naturwissenschaft', es:'Ciencias', fr:'Sciences' },
  subj_physics:     { ar:'الفيزياء', en:'Physics', zh:'物理', de:'Physik', es:'Física', fr:'Physique' },
  subj_chemistry:   { ar:'الكيمياء', en:'Chemistry', zh:'化学', de:'Chemie', es:'Química', fr:'Chimie' },
  subj_biology:     { ar:'الأحياء', en:'Biology', zh:'生物', de:'Biologie', es:'Biología', fr:'Biologie' },
  subj_history:     { ar:'التاريخ', en:'History', zh:'历史', de:'Geschichte', es:'Historia', fr:'Histoire' },
  subj_geography:   { ar:'الجغرافيا', en:'Geography', zh:'地理', de:'Geografie', es:'Geografía', fr:'Géographie' },
  subj_islamic:     { ar:'التربية الإسلامية', en:'Islamic Studies', zh:'伊斯兰教育', de:'Islamkunde', es:'Estudios islámicos', fr:'Études islamiques' },
  subj_computer:    { ar:'الحاسب الآلي', en:'Computer Science', zh:'计算机', de:'Informatik', es:'Informática', fr:'Informatique' },
  subj_art:         { ar:'التربية الفنية', en:'Art', zh:'艺术', de:'Kunst', es:'Arte', fr:'Art' },
  subj_pe:          { ar:'التربية البدنية', en:'Physical Education', zh:'体育', de:'Sport', es:'Educación física', fr:'Éducation physique' },
  subj_other:       { ar:'أخرى', en:'Other', zh:'其他', de:'Sonstige', es:'Otro', fr:'Autre' },

  // ── Grades ────────────────────────────
  select_grade:     { ar:'اختر الصف', en:'Select Grade', zh:'选择年级', de:'Klasse wählen', es:'Seleccionar grado', fr:'Choisir la classe' },
  grade_1:          { ar:'الصف الأول', en:'Grade 1', zh:'一年级', de:'1. Klasse', es:'1.° Grado', fr:'1ère année' },
  grade_2:          { ar:'الصف الثاني', en:'Grade 2', zh:'二年级', de:'2. Klasse', es:'2.° Grado', fr:'2ème année' },
  grade_3:          { ar:'الصف الثالث', en:'Grade 3', zh:'三年级', de:'3. Klasse', es:'3.° Grado', fr:'3ème année' },
  grade_4:          { ar:'الصف الرابع', en:'Grade 4', zh:'四年级', de:'4. Klasse', es:'4.° Grado', fr:'4ème année' },
  grade_5:          { ar:'الصف الخامس', en:'Grade 5', zh:'五年级', de:'5. Klasse', es:'5.° Grado', fr:'5ème année' },
  grade_6:          { ar:'الصف السادس', en:'Grade 6', zh:'六年级', de:'6. Klasse', es:'6.° Grado', fr:'6ème année' },
  grade_7:          { ar:'الصف السابع', en:'Grade 7', zh:'七年级', de:'7. Klasse', es:'7.° Grado', fr:'7ème année' },
  grade_8:          { ar:'الصف الثامن', en:'Grade 8', zh:'八年级', de:'8. Klasse', es:'8.° Grado', fr:'8ème année' },
  grade_9:          { ar:'الصف التاسع', en:'Grade 9', zh:'九年级', de:'9. Klasse', es:'9.° Grado', fr:'9ème année' },
  grade_10:         { ar:'الصف العاشر', en:'Grade 10', zh:'十年级', de:'10. Klasse', es:'10.° Grado', fr:'10ème année' },
  grade_11:         { ar:'الصف الحادي عشر', en:'Grade 11', zh:'十一年级', de:'11. Klasse', es:'11.° Grado', fr:'11ème année' },
  grade_12:         { ar:'الصف الثاني عشر', en:'Grade 12', zh:'十二年级', de:'12. Klasse', es:'12.° Grado', fr:'12ème année' },
}

// ════════════════════════════════════════
//  Google Translate cache (localStorage)
// ════════════════════════════════════════
let _gtCache = null
function getGTCache() {
  if (!_gtCache) {
    try { _gtCache = JSON.parse(localStorage.getItem('morix_gt_cache') || '{}') }
    catch { _gtCache = {} }
  }
  return _gtCache
}
function saveGTCache() {
  try { localStorage.setItem('morix_gt_cache', JSON.stringify(_gtCache)) } catch {}
}

/**
 * Translate any Arabic string using Google Translate (free API)
 * Results are cached in localStorage — called only when key is missing from STATIC
 */
export async function googleTranslate(text, targetLang) {
  if (!text || targetLang === 'ar') return text
  const cache = getGTCache()
  const cacheKey = `${targetLang}||${text}`
  if (cache[cacheKey]) return cache[cacheKey]
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ar&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`
    const res = await fetch(url)
    const data = await res.json()
    const result = (data[0] || []).flatMap(x => x?.[0] || '').join('').trim()
    if (result) {
      cache[cacheKey] = result
      saveGTCache()
    }
    return result || text
  } catch { return text }
}

// ════════════════════════════════════════
//  Reactive state
// ════════════════════════════════════════
const currentLang = ref(localStorage.getItem('morix_lang') || 'ar')

function applyDir(lang) {
  const meta = LANGUAGES[lang] || LANGUAGES.ar
  document.documentElement.setAttribute('lang', meta.code)
  document.documentElement.setAttribute('dir', meta.dir)
}
applyDir(currentLang.value)

watch(currentLang, (val) => {
  localStorage.setItem('morix_lang', val)
  applyDir(val)
})

// ════════════════════════════════════════
//  Public composable
// ════════════════════════════════════════
export function useI18n() {
  const lang = currentLang
  const dir  = computed(() => LANGUAGES[lang.value]?.dir || 'rtl')

  /** Sync translation — checks STATIC dict, then GT cache, then returns Arabic */
  function t(key, fallback) {
    const entry = STATIC[key]
    if (entry) return entry[lang.value] || entry.ar || fallback || key
    // Check raw Google Translate cache for this Arabic source
    const cache = getGTCache()
    const source = fallback || key
    if (lang.value !== 'ar') {
      const cached = cache[`${lang.value}||${source}`]
      if (cached) return cached
    }
    return source
  }

  /** Async translation — for strings not in STATIC, calls Google Translate */
  async function tAsync(arabicText) {
    if (!arabicText || lang.value === 'ar') return arabicText
    const cache = getGTCache()
    const cacheKey = `${lang.value}||${arabicText}`
    if (cache[cacheKey]) return cache[cacheKey]
    return await googleTranslate(arabicText, lang.value)
  }

  function setLang(newLang) {
    if (LANGUAGES[newLang]) lang.value = newLang
  }

  return { t, tAsync, lang, dir, setLang, languages: LANGUAGES }
}

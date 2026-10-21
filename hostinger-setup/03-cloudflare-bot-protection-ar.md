# حماية الموقع من الروبوتات عبر Cloudflare (والاستضافة على Hostinger)

الحماية في طبقتين:

1. **عند Cloudflare (قبل أن يصل الطلب لـ Hostinger):** Bot Fight Mode وقواعد WAF وحدّ معدّل الطلبات. تمنع الماسحات والروبوتات المعروفة.
2. **داخل التطبيق:** Cloudflare Turnstile في صفحة تسجيل الدخول. السيرفر يتحقق من الرمز عند Cloudflare **قبل** فحص كلمة المرور. بهذا لا يقدر الروبوت أن يجرّب كلمات مرور، ولا أن يقفل حساب طالب حقيقي بمحاولات خاطئة.

> كل الخطوات تعمل على **خطة Cloudflare المجانية**.

---

## الخطوة 1: ربط الدومين بـ Cloudflare

1. أنشئ حسابًا على <https://dash.cloudflare.com> ثم اضغط **Add a domain** واكتب دومين المنصة واختر الخطة **Free**.
2. Cloudflare سيقرأ سجلات DNS الحالية. تأكد أن سجل `A` (أو `CNAME`) للدومين و`www` يشير إلى عنوان Hostinger، وأن السحابة **برتقالية (Proxied)**.
3. Cloudflare سيعطيك **اسمَي خوادم (Nameservers)**.
4. في **Hostinger hPanel ← Domains ←** اختر الدومين **← DNS / Nameservers ← Change nameservers**، واختر الإدخال اليدوي وضع اسمَي خوادم Cloudflare.
5. انتظر حتى يرسل لك Cloudflare أن الدومين أصبح **Active** (عادة دقائق، وقد تصل إلى 24 ساعة).

### قبل تغيير الـ Nameservers

- **فعّل شهادة SSL في Hostinger أولًا** (hPanel ← Security ← SSL). نحتاجها لوضع Full (strict).
- **أوقف CDN الخاص بـ Hostinger** إن كان مفعّلًا (hPanel ← Performance ← CDN). وجود CDN مع Cloudflare معًا يسبب تعارضًا.

## الخطوة 2: إعدادات SSL

في Cloudflare **← SSL/TLS ← Overview**:

| الإعداد                                 | القيمة                                                                                                                   |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Encryption mode                         | **Full (strict)**. إن ظهر خطأ 526 فالشهادة على Hostinger غير صالحة: أصلحها ثم ارجع لـ strict. استخدم **Full** مؤقتًا فقط |
| Edge Certificates ← Always Use HTTPS    | **On**                                                                                                                   |
| Edge Certificates ← Minimum TLS Version | **TLS 1.2**                                                                                                              |

> التطبيق نفسه يرسل HSTS في الإنتاج، فلا داعي لتفعيله من Cloudflare أيضًا.

## الخطوة 3: كشف الروبوتات على مستوى الدومين (Bot Fight Mode)

في Cloudflare **← Security ← Settings**، صفِّ بـ **Bot traffic**:

| الإعداد                         | القيمة                 | ملاحظة                                                                 |
| ------------------------------- | ---------------------- | ---------------------------------------------------------------------- |
| **Bot fight mode**              | **On**                 | يتحدّى الروبوتات المعروفة. الروبوتات الموثّقة (مثل Googlebot) لا تتأثر |
| **Block AI bots** (إن ظهر عندك) | **Block on all pages** | يمنع زواحف الذكاء الاصطناعي من نسخ محتوى المنصة                        |

وفي نفس الصفحة (**Security ← Settings**):

| الإعداد                 | القيمة         |
| ----------------------- | -------------- |
| Security level          | **Medium**     |
| Browser integrity check | **On**         |
| Challenge passage       | **30 minutes** |

> ⚠️ **تنبيه عن Bot Fight Mode:** لا يمكن استثناء أي مسار منه بقواعد WAF. إذا استعملت خدمة مراقبة (Uptime) على `/api/health` وصار يظهر لها تحدٍّ، فأوقفه أو استعمل مراقبة من داخل Hostinger. المتصفحات العادية للطلاب والمعلمين لا تتأثر.

## الخطوة 4: قواعد WAF المخصّصة (Custom rules)

في Cloudflare **← Security ← Security rules ← Create rule ← Custom rules**. الخطة المجانية تسمح بـ 5 قواعد. أنشئ القواعد الثلاث التالية، كل واحدة عبر **Edit expression** والصق التعبير كما هو:

### القاعدة 1: حظر الماسحات (مسارات ووردبريس والملفات الحساسة)

المنصة ليست ووردبريس، فأي طلب لهذه المسارات هو روبوت يبحث عن ثغرات.

```
(http.request.uri.path contains "/wp-") or
(http.request.uri.path contains "xmlrpc.php") or
(http.request.uri.path contains "/.env") or
(http.request.uri.path contains "/.git") or
(http.request.uri.path contains "phpmyadmin") or
(http.request.uri.path contains "/cgi-bin")
```

**Action:** `Block`

### القاعدة 2: حظر طلبات API بلا متصفح (User-Agent فارغ)

```
(starts_with(http.request.uri.path, "/api/") and http.user_agent eq "")
```

**Action:** `Block`

### القاعدة 3 (اختيارية): تحدٍّ لتسجيل الدخول من خارج دولة المدارس

إذا كانت كل المدارس في الإمارات مثلًا (`AE`). عدّل رموز الدول حسب حاجتك، مثل `{"AE" "SA" "JO"}`:

```
(http.request.uri.path eq "/login" and not ip.src.country in {"AE"})
```

**Action:** `Managed Challenge`. لا تختر Block: الطالب المسافر سيرى فحصًا بسيطًا ثم يكمل.

> ❌ **لا تضع** Managed Challenge على `/api/auth/*`. تلك طلبات يرسلها الموقع في الخلفية، ولا يستطيع المستخدم حل التحدي فيها، فيفشل تسجيل الدخول.

## الخطوة 5: حدّ معدّل الطلبات على تسجيل الدخول (Rate limiting)

في Cloudflare **← Security ← Security rules ← Create rule ← Rate limiting rules** (الخطة المجانية: قاعدة واحدة).

| الحقل           | القيمة                                                                                   |
| --------------- | ---------------------------------------------------------------------------------------- |
| Expression      | `(http.request.uri.path eq "/api/auth/sign-in/email" and http.request.method eq "POST")` |
| Characteristics | IP                                                                                       |
| Requests        | **30**                                                                                   |
| Period          | **10 seconds**                                                                           |
| Action          | **Block**                                                                                |
| Duration        | **10 seconds**                                                                           |

> الرقم 30 كبير عن قصد: **صف كامل في المدرسة يخرج للإنترنت بنفس الـ IP**. التطبيق عنده حدوده الخاصة أيضًا: 60 محاولة في الدقيقة لكل IP، وقفل الحساب 15 دقيقة بعد محاولات خاطئة متكررة.

## الخطوة 6: Cloudflare Turnstile في صفحة تسجيل الدخول

1. في Cloudflare **← Turnstile ← Add widget**.
2. **Widget name:** اسم المنصة (مثلًا `Platform Login`).
3. **Hostnames:** أضف الدومين، مثل `example.com`، و`www.example.com` إن كنت تستخدمه.
4. **Widget Mode:** `Managed` (موصى به: يظهر مربع التحقق، ومعظم المستخدمين يمرّون تلقائيًا بدون نقر).
5. **Pre-clearance:** `No`.
6. اضغط **Create**، وانسخ **Site Key** و**Secret Key**.

### متغيرات البيئة على Hostinger

في **hPanel ← Websites ←** موقع Node.js **← Settings / Environment variables** أضف:

```env
TURNSTILE_SITE_KEY=0x4AAAAAAA...........   # Site Key من Cloudflare
TURNSTILE_SECRET_KEY=0x4AAAAAAA.........   # Secret Key — لا تشاركه مع أحد
TRUST_CLOUDFLARE_IP=1                      # لأن الدومين يمر عبر Cloudflare (السحابة البرتقالية)
```

ثم أعد نشر التطبيق أو أعد تشغيله (**Redeploy / Restart**).

- **يجب وضع المفتاحين معًا أو تركهما فارغين معًا.** إن وُضع واحد فقط فلن يقبل التطبيق أن يبدأ، وستظهر لك رسالة واضحة بالسبب.
- **`TRUST_CLOUDFLARE_IP=1`**: بدون هذا الخيار يرى التطبيق كل الزوار بعنوان IP خوادم Cloudflare، فتختلط حدود المحاولات بين الجميع. فعّله **فقط** بعد أن تصبح السحابة برتقالية. السبب: من يصل للسيرفر مباشرة بدون Cloudflare يستطيع تزوير هذا الرأس (header). هذا يؤثر على عدّاد الـ IP فقط، وحدود الحساب نفسه تبقى تعمل.
- إن تركت المفاتيح فارغة فالتطبيق يعمل بدون فحص الروبوتات. هذا مناسب للتطوير المحلي.

### التطوير المحلي (اختياري)

Cloudflare يوفر مفاتيح اختبار تنجح دائمًا. ضعها في `.env.local`:

```env
TURNSTILE_SITE_KEY=1x00000000000000000000AA
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
```

## الخطوة 7: إعدادات تتعارض مع حماية الصفحات (CSP)

التطبيق يرسل سياسة CSP تمنع تشغيل أي سكربت لا يحمل رمز الصفحة (nonce). بعض ميزات Cloudflare تحقن سكربتات في الصفحة، فأوقفها:

| الإعداد                       | المكان                                          | القيمة                                                     |
| ----------------------------- | ----------------------------------------------- | ---------------------------------------------------------- |
| **Rocket Loader**             | Speed ← Settings ← Content Optimization         | **Off** (يعيد كتابة سكربتات الصفحة فتتوقف)                 |
| **Email Address Obfuscation** | Security ← Settings (صفِّ بـ Client-side abuse) | **Off** (يحقن سكربتًا، والمنصة لا تعرض إيميلات عامة أصلًا) |

> أما Bot Fight Mode وTurnstile فيعملان مع هذه السياسة: Cloudflare يقرأ الـ nonce من ترويسة الصفحة ويضعه على سكربتاته، وسياسة التطبيق تسمح بـ `challenges.cloudflare.com`.

**علامة المشكلة:** إذا ظهرت الصفحة بلا تنسيق تفاعلي (الأزرار لا تستجيب)، افتح أدوات المطوّر في المتصفح ← Console. إن وجدت `Content Security Policy` فالسبب إعداد من الجدول أعلاه.

## الخطوة 8: التأكد أن كل شيء يعمل

1. **افتح `/login`:** يجب أن يظهر مربع Cloudflare فوق زر الدخول، ويبقى الزر مكتوبًا عليه «جارٍ التحقق من أنك لست روبوتًا…» حتى يكتمل الفحص.
2. **جرّب كروبوت** (من أي جهاز عليه curl). النتيجة المتوقعة `403` مع `BOT_CHECK_FAILED`:
   ```bash
   curl -i -X POST https://example.com/api/auth/sign-in/email \
     -H "Content-Type: application/json" -H "Origin: https://example.com" \
     -d '{"email":"test@example.com","password":"x"}'
   ```
   وإذا رجعت صفحة Cloudflare (403 أو 503) بدل رد التطبيق، فهذا يعني أن Bot Fight Mode أوقف الطلب قبل أن يصل للسيرفر. هذا نجاح أيضًا.
3. **جرّب مسار ماسح:** افتح `https://example.com/wp-login.php`. يجب أن تظهر صفحة حظر من Cloudflare.
4. **راقب:** Cloudflare **← Security ← Analytics ← Events** يعرض ما تم حظره وسببه. **Turnstile ← Analytics** يعرض نسبة النجاح.

## إن واجهتك مشكلة

| العَرَض                                  | السبب والحل                                                                                                                        |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| مربع Turnstile لا يظهر                   | الدومين غير مضاف في **Hostnames** في إعدادات الـ widget، أو `TURNSTILE_SITE_KEY` خطأ                                               |
| «فحص الأمان غير متاح الآن» عند كل محاولة | `TURNSTILE_SECRET_KEY` خطأ أو لا يطابق الـ Site Key. راجع سجلات التطبيق في Hostinger وابحث عن `turnstile verification unavailable` |
| خطأ 526                                  | شهادة SSL على Hostinger غير صالحة مع وضع Full (strict)                                                                             |
| «محاولات كثيرة من هذه الشبكة» في المدرسة | ارفع رقم Requests في قاعدة Rate limiting، وتأكد أن `TRUST_CLOUDFLARE_IP=1`                                                         |
| حلقة إعادة توجيه (Too many redirects)    | وضع SSL على **Flexible**. غيّره إلى **Full (strict)**                                                                              |

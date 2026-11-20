# NoonDealsNow — المرحلة الثانية V9: إصلاح QA لصفحات الهبوط والـSchema

## النطاق

هذا التحديث لا يغير أكواد الخصم، ولا يحذف المقالات، ولا يغيّر slugs القائمة، ولا يضبط Cloudflare أو DNS أو نظام التوليد والنشر.

## الإصلاحات

1. اختبار صفحات الهبوط يستعمل صفحة التجارة الحقيقية بدلاً من HTML فارغ، حتى يفحص `Organization` و`WebSite` و`CollectionPage` و`BreadcrumbList` و`FAQPage` معًا ويتأكد من عدم تكرارهم.
2. اختبار الحد الأدنى للمحتوى يتبع مواصفات الصفحة الحالية (من 1800 إلى 2500 كلمة مفيدة)، بدلاً من شرط 5000 كلمة القديم الذي تعارض مع نسخة المحتوى الخامسة.
3. التأكد من ظهور كل سؤال وجواب في الـFAQ للمستخدم بالنص نفسه المرسل في JSON-LD؛ تم توحيد النصين في مصدر واحد.
4. معالجة 6 روابط موجودة في sitemap لبراند `americanTourister` وموديلاته في السعودية والإمارات؛ هذه المسارات كانت تفشل في التوجيه لأن حرف `T` كبير.
5. تحديث شروط GitHub Actions لتطابق مصدر المحتوى الحالي وتستمر في رفض أي تدهور فعلي في الروابط أو الـSchema أو الجودة.

## نتائج الاختبار المحلي (2026-11-20)

- `node landing-quality-selftest.mjs`: **PASS** — 296 مسارًا؛ 296 HTML فريدًا؛ 296 seed فريدًا؛ 296 تخصصًا؛ حد المحتوى الفعلي 2040 إلى 2319 كلمة؛ 3 صور لكل صفحة.
- تنفيذ خطوة `Audit every commerce landing route` نفسها من Workflow: **PASS**.
- تنفيذ خطوة `Static architecture checks` نفسها من Workflow: **PASS**.
- تنفيذ خطوة `Source and quality invariants` نفسها من Workflow: **PASS**.
- `node --test --test-reporter=tap tests/*.test.mjs`: **620/620 PASS**.
- `wrangler deploy --dry-run --config wrangler.new-account-production.jsonc`: **PASS** — بدون نشر فعلي.

## ما زال مفتوحًا — مرحلة Cloudflare التالية

في فحص النسخة الحية، الدومين `https://noondealsnow.com/` كان يرد `HTTP 429 / error code: 1027`، ونفس الأمر للمدونة و`robots.txt` و`sitemap.xml`. نشر Worker الحساب الجديد في GitHub لا يربط الدومين تلقائيًا (`workers_dev:false`, دون DNS cutover). هذه الملفات لا تتدخل في الدومين أو الجدولة، لذلك لا تُعتبر تحسينات V9 مثبتة على النسخة الحية قبل نشرها والتحقق من زوال 429.

لا تغيّر إعدادات DNS أو تُفعّل Cron الحساب الجديد قبل مراجعة روابط Durable Objects وR2 ومسار النشر الفعلي.

import {isAdmin} from './admin-runtime.js';

const html=x=>new Response(x,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-robots-tag':'noindex,nofollow'}});

function login(){return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>دخول الإدارة</title><style>body{margin:0;font-family:Tahoma,Arial;background:#111827;display:grid;place-items:center;min-height:100vh}.box{width:min(420px,92%);background:#fff;border-radius:22px;padding:28px;box-shadow:0 24px 70px #0005}input{width:100%;box-sizing:border-box;padding:13px;margin:7px 0 14px;border:1px solid #cbd5e1;border-radius:12px}button{width:100%;padding:13px;border:0;border-radius:12px;background:#111;color:#fff;font-weight:800;cursor:pointer}.err{color:#b91c1c}</style></head><body><form class="box" id="loginForm"><h1>NoonDealsNow Admin</h1><p>متابعة التوليد وتعديل المقالات.</p><label>البريد</label><input id="loginEmail" type="email" required><label>كلمة المرور</label><input id="loginPassword" type="password" required><button>دخول</button><p class="err" id="loginMsg"></p></form><script>const $=id=>document.getElementById(id);$('loginForm').onsubmit=async e=>{e.preventDefault();const r=await fetch('/api/admin/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:$('loginEmail').value,password:$('loginPassword').value})});if(r.ok)location='/admin';else $('loginMsg').textContent='بيانات الدخول غير صحيحة'}</script></body></html>`}

function dashboard(){return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NoonDealsNow • لوحة التحكم</title><style>body{margin:0;font-family:Tahoma,Arial;background:#f6f7fb;color:#111827}.top{background:#111827;color:#fff;padding:20px}.w{width:min(1280px,94%);margin:auto}.grid{display:grid;grid-template-columns:repeat(6,1fr);gap:12px;margin:20px 0}.card,.panel{background:#fff;border:1px solid #e5e7eb;border-radius:18px;padding:16px;box-shadow:0 8px 22px #0f172a0b}.n{font-size:25px;font-weight:900;margin-top:6px}.sub{font-size:12px;color:#64748b;margin-top:6px}.row{display:flex;gap:10px;flex-wrap:wrap}.row>div{min-width:180px}button{padding:10px 14px;border:0;border-radius:10px;background:#6d28d9;color:#fff;font-weight:800;cursor:pointer}.danger{background:#b91c1c}.ok{background:#047857}.badge{display:inline-block;padding:5px 9px;border-radius:999px;background:#ede9fe;color:#5b21b6;font-size:12px;font-weight:800}input,select,textarea{width:100%;box-sizing:border-box;padding:10px;border:1px solid #cbd5e1;border-radius:9px;margin:6px 0 10px}input[readonly]{background:#f1f5f9;color:#475569}textarea{min-height:340px;font-family:monospace;direction:ltr}table{width:100%;border-collapse:collapse;font-size:13px}th,td{padding:9px;border-bottom:1px solid #e5e7eb;text-align:right}.scroll{overflow:auto;max-height:560px}pre{white-space:pre-wrap;background:#0f172a;color:#d1fae5;padding:14px;border-radius:12px;max-height:360px;overflow:auto}.statusLine{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.seoGrid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:14px 0}.seoCheck{border:1px solid #e5e7eb;border-radius:14px;padding:12px;background:#f8fafc}.seoCheck b{display:block;margin-bottom:6px}.seoCheck .yes{color:#047857}.seoCheck .no{color:#b91c1c}.seoLinks{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.seoLinks a{padding:8px 10px;border-radius:9px;border:1px solid #dbe3ec;background:#fff;color:#334155;text-decoration:none;font-size:12px;font-weight:800}.adminNav{position:sticky;top:0;z-index:50;background:#fff;border-bottom:1px solid #e5e7eb;box-shadow:0 8px 18px #0f172a0a}.adminNav .w{display:flex;gap:8px;align-items:center;overflow:auto;padding:9px 0}.adminNav a{white-space:nowrap;padding:8px 11px;border-radius:999px;background:#f1f5f9;color:#334155;text-decoration:none;font-size:12px;font-weight:900}.adminNav a:hover{background:#ede9fe;color:#5b21b6}.panel{scroll-margin-top:64px}@media(max-width:700px){.aiV2KeyGrid{grid-template-columns:1fr!important}}@media(max-width:900px){.seoGrid{grid-template-columns:1fr 1fr}}@media(max-width:520px){.seoGrid{grid-template-columns:1fr}}@media(max-width:1050px){.grid{grid-template-columns:repeat(3,1fr)}}@media(max-width:700px){.grid{grid-template-columns:1fr 1fr}}@media(max-width:480px){.grid{grid-template-columns:1fr}}</style></head><body><header class="top"><div class="w"><h1>NoonCoupons Control Center</h1><div>Workers AI + Gemini + Groq · R2 · Quality Gate ≥95 · 1-minute scheduler</div></div></header><nav class="adminNav" aria-label="أقسام لوحة الإدارة"><div class="w"><a href="#generatorPanel">المولد</a><a href="#aiV2Panel">Gemini / Groq</a><a href="#seoHealthPanel">SEO Health</a><a href="#seoSettingsPanel">SEO Settings</a><a href="#seoDropsPanel">GSC Drops</a><a href="#conversionEventsPanel">Conversions</a><a href="#qualityPanel">الجودة</a><a href="#articlesPanel">المقالات</a></div></nav><main class="w"><section class="grid"><div class="card">إجمالي المقالات على R2<div class="n" id="metricArticles">-</div><div class="sub" id="metricCountFresh">R2 actual HTML · جارٍ التحديث</div></div><div class="card">المسجل في نظام النشر<div class="n" id="metricTracked">-</div><div class="sub">Tracked published</div></div><div class="card">المؤهل بعد الـAudit<div class="n" id="metricQualified">-</div><div class="sub" id="metricQualifiedSub">Discovery manifest</div></div><div class="card">المقالات العربية<div class="n" id="metricArabic">-</div><div class="sub">Published Arabic</div></div><div class="card">المقالات الإنجليزية<div class="n" id="metricEnglish">-</div><div class="sub">Controlled English</div></div><div class="card">R2 غير متتبع<div class="n" id="metricUntracked">-</div><div class="sub">Audit estimate · لا حذف تلقائي</div></div><div class="card">تنظيف الأكواد<div class="n" id="metricCouponMigration">-</div><div class="sub" id="metricCouponMigrationSub">R2 migration</div></div><div class="card">المنشور آليًا<div class="n" id="metricGenerated">-</div><div class="sub">Workers AI</div></div><div class="card">الفشل<div class="n" id="metricFailed">-</div><div class="sub">Quality/runtime failures</div></div><div class="card">آخر تشغيل<div class="n" id="metricLast">-</div><div class="sub">UTC runtime</div></div><div class="card">Workers AI<div class="n" id="metricAI">-</div><div class="sub" id="metricAIUsage">-</div></div><div class="card">آخر نجاح<div class="n" id="metricProvider" style="font-size:16px;word-break:break-word">-</div><div class="sub" id="metricVersion">-</div></div></section><section class="panel" id="generatorPanel"><h2>المولد</h2><div class="statusLine"><span class="badge" id="policyBadge">Loading...</span><span class="badge" id="r2Badge">R2 -</span><span class="badge" id="qualityBadge">Quality -</span><span class="badge" id="fallbackBadge">Fallback -</span></div><div class="row"><button class="ok" id="resumeBtn">تشغيل</button><button class="danger" id="pauseBtn" disabled title="التوليد مضبوط على تشغيل دائم">التوليد دائم</button><button id="generateBtn">توليد الآن</button><button id="refreshCountBtn">تحديث العدد الآن</button><button id="logoutBtn">خروج</button></div><pre id="generatorStatus">Loading...</pre></section><section class="panel" id="aiV2Panel" aria-label="لوحة تشغيل Gemini وGroq">
<h2>إدارة توليد Gemini وGroq والنشر على المدونة</h2>
<p class="sub">النظام المستقل عن مولد Workers AI. الحالة مبنية على تقرير GitHub الفعلي والكوتة المحفوظة في R2، وليست مجرد نجاح تشغيل GitHub. لا نعرض المفاتيح السرية كاملة.</p>
<div id="aiV2HealthBar" role="status" aria-live="polite" style="padding:17px;border:1px solid #cbd5e1;border-radius:14px;background:#f1f5f9;font-weight:900;font-size:16px;margin:14px 0">جارٍ فحص حالة التوليد الفعلية...</div>
<div class="seoGrid" id="aiV2Kpis">
  <div class="seoCheck"><b>Gemini · مفاتيح محملة</b><span class="n" id="aiV2GeminiCount">—</span><div class="sub" id="aiV2GeminiQuota">غير مقاس</div></div>
  <div class="seoCheck"><b>Groq · مفاتيح محملة</b><span class="n" id="aiV2GroqCount">—</span><div class="sub" id="aiV2GroqQuota">غير مقاس</div></div>
  <div class="seoCheck"><b>المنشور المؤكد آخر ساعة</b><span class="n" id="aiV2VerifiedHour">—</span><div class="sub">من دفتر المقالات المؤكدة فقط</div></div>
  <div class="seoCheck"><b>آخر تقرير / مفتاح مُختار</b><span id="aiV2RecentKey">—</span><div class="sub" id="aiV2LastChecked">—</div></div>
</div>
<div class="row" style="align-items:end">
<div style="min-width:240px"><label for="aiV2Interval">الفاصل الزمني لتشغيل المجدول</label><select id="aiV2Interval"><option value="1">كل دقيقة</option><option value="5">كل 5 دقائق</option><option value="10">كل 10 دقائق</option><option value="15">كل 15 دقيقة</option><option value="30">كل 30 دقيقة</option><option value="60">كل ساعة</option></select></div>
<div><button class="ok" id="aiV2StartBtn" type="button">بدء / استئناف التوليد</button></div>
<div><button class="danger" id="aiV2StopBtn" type="button">إيقاف التوليد</button></div>
<div><button id="aiV2SaveIntervalBtn" type="button">حفظ الفاصل</button></div>
<div><button id="aiV2RunNowBtn" type="button">إعادة تشغيل توليد الآن</button></div>
<div><button id="aiV2RefreshBtn" type="button">تحديث الحالة</button></div>
</div>
<p class="sub">زر التشغيل يحفظ طلب التشغيل فقط؛ تفعيل مجدول Cloudflare، صلاحيات GitHub، توافر كوتة AI ونجاح النشر تُفحص منفصلة. لا يتم تجاوز فحص الجودة أو حصة المفاتيح.</p>
<div class="seoGrid aiV2KeyGrid" style="grid-template-columns:repeat(2,minmax(0,1fr))">
<div class="seoCheck"><h3>مفاتيح Gemini</h3><p class="sub">الخانات الحالية في GitHub أولًا، ثم مفاتيح الإضافة المشفرة. المعرّفات الظاهرة مختصرة وليست المفاتيح الحقيقية.</p><div id="aiV2GeminiKeys" style="overflow:auto;max-height:340px">جارٍ التحميل...</div></div>
<div class="seoCheck"><h3>مفاتيح Groq</h3><p class="sub">الخانات الحالية في GitHub أولًا، ثم مفاتيح الإضافة المشفرة. حالة الانتظار مبنية على سجل الكوتة إن توفر.</p><div id="aiV2GroqKeys" style="overflow:auto;max-height:340px">جارٍ التحميل...</div></div>
</div>
<h3>إضافة مفتاح واحد أو مجموعة مفاتيح Bulk</h3>
<p class="sub">الصق مفتاحًا في كل سطر، أو اختر ملف TXT/CSV/JSON. عند الحفظ تُشفَّر المفاتيح بمفتاح GitHub العام قبل رفعها إلى Actions Secrets جديدة دون استبدال مفاتيحك القديمة. يُمنع عرض القيم بعد الحفظ.</p>
<div class="row"><div style="flex:1"><label for="aiV2Provider">مزود المفاتيح</label><select id="aiV2Provider"><option value="gemini">Gemini</option><option value="groq">Groq</option></select></div>
<div style="flex:2"><label for="aiV2GithubToken">GitHub Fine-grained PAT (Secrets read/write + Actions read/write)</label><input type="password" id="aiV2GithubToken" autocomplete="off" spellcheck="false" placeholder="يُستخدم في الطلب الآمن فقط ولا يُحفظ في قاعدة البيانات"></div></div>
<label for="aiV2BulkKeys">مفتاح واحد أو مجموعة مفاتيح</label>
<textarea id="aiV2BulkKeys" style="min-height:155px" spellcheck="false" autocomplete="off" placeholder="Gemini: AIza... أو AQ....&#10;Groq: gsk_...&#10;مفتاح جديد في كل سطر"></textarea>
<div class="row" style="align-items:center">
<div><label for="aiV2KeyFile">رفع ملف مفاتيح</label><input id="aiV2KeyFile" type="file" accept=".txt,.csv,.json,text/plain,application/json" style="max-width:220px"></div>
<div><button class="ok" type="button" id="aiV2ImportBtn">حفظ المفاتيح مشفرة على GitHub</button></div>
<div><button type="button" id="aiV2LoadSecretsBtn">عرض خانات GitHub الحالية</button></div>
<div><button type="button" id="aiV2ClearTokenBtn">مسح رمز GitHub</button></div>
</div>
<p class="sub">ملاحظة: GitHub لا يسمح باسترجاع القيمة الأصلية لأي Secret محفوظ مسبقًا. ستظهر أسماء الخانات وحالة وجودها، بالإضافة إلى معرّفات آمنة للمفاتيح التي رصدتها تشغيلات GitHub. لو رمز GitHub غير متاح، استخدم رابط إدارة المفاتيح.</p>
<div class="seoLinks"><a href="https://github.com/ramyadamface1-stack/nooncoupons/settings/secrets/actions" target="_blank" rel="noopener noreferrer">GitHub · Actions Secrets</a><a href="https://github.com/ramyadamface1-stack/nooncoupons/actions/workflows/noondealsnow-ai-v2.yml" target="_blank" rel="noopener noreferrer">سجلات التوليد والنشر</a></div>
<div id="aiV2ActionMessage" role="status" aria-live="polite" class="sub" style="font-weight:800;margin:12px 0"></div>
<details><summary style="cursor:pointer">التقرير الفني (بدون مفاتيح سرية)</summary><pre id="aiV2Status">جارٍ تحميل التقرير...</pre></details>
</section><section class="panel" id="seoHealthPanel"><h2>SEO / AEO Health</h2><p class="sub">فحص آمن للحالة الحية بدون تعديل canonical أو Schema من البانل.</p><div class="seoGrid"><div class="seoCheck"><b>robots.txt</b><span id="seoRobots">-</span></div><div class="seoCheck"><b>Sitemap</b><span id="seoSitemap">-</span></div><div class="seoCheck"><b>llms.txt</b><span id="seoLlms">-</span></div><div class="seoCheck"><b>IndexNow</b><span id="seoIndexNow">-</span></div><div class="seoCheck"><b>Research</b><span id="seoResearch">-</span></div><div class="seoCheck"><b>Glossary</b><span id="seoGlossary">-</span></div><div class="seoCheck"><b>Countries Hub</b><span id="seoCountries">-</span></div><div class="seoCheck"><b>Approved coupons</b><span id="seoCodes">-</span></div><div class="seoCheck"><b>Full Corpus Audit</b><span id="seoCorpusAudit">-</span></div><div class="seoCheck"><b>Discovery Manifest</b><span id="seoDiscovery">-</span></div><div class="seoCheck"><b>Audit Archive</b><span id="seoAuditArchive">-</span></div></div><div class="seoLinks"><a href="/robots.txt" target="_blank">robots</a><a href="/sitemap.xml" target="_blank">sitemap</a><a href="/llms.txt" target="_blank">llms.txt</a><a href="/research" target="_blank">research</a><a href="/glossary" target="_blank">glossary</a><a href="/countries" target="_blank">countries</a><a href="/golden-keywords" target="_blank">golden keywords</a><a href="/blog/archive" target="_blank">audit archive</a><a href="/admin/seo-settings">SEO Settings</a></div><div class="row" style="margin-top:12px"><button id="refreshSeoBtn">تحديث SEO Health</button></div><pre id="seoOverviewJson">Loading...</pre></section>
<section class="panel" id="seoSettingsPanel"><h2>SEO Settings</h2><p class="sub">إعدادات محفوظة على R2 وتطبق من طبقة الـruntime. Canonical والـOG image يقبلان مسارات داخلية فقط لحماية الدومين.</p>
<div class="row"><div><label>Site name</label><input id="seoSiteName"></div><div><label>Default OG image</label><input id="seoDefaultOg" placeholder="/favicon.svg"></div><div><label>Twitter site</label><input id="seoTwitterSite" placeholder="@account"></div><div><label>Facebook App ID</label><input id="seoFacebookAppId"></div></div>
<div class="row"><div><label>Google verification</label><input id="seoGoogleVerification"></div><div><label>Bing verification</label><input id="seoBingVerification"></div><div><label>Yandex verification</label><input id="seoYandexVerification"></div><div><label>Pinterest verification</label><input id="seoPinterestVerification"></div></div>
<h3>Analytics & Pixels — اختياري</h3><p class="sub">مقفولة افتراضيًا. لا يتم تحميل أي tracker إلا بعد تفعيل Analytics. عند تفعيل Respect DNT لن تُحمّل trackers للمتصفح الذي يرسل Do Not Track.</p>
<div class="row"><div><label><input id="seoAnalyticsEnabled" type="checkbox" style="width:auto"> تفعيل Analytics</label></div><div><label><input id="seoRespectDnt" type="checkbox" style="width:auto" checked> Respect Do Not Track</label></div></div>
<div class="row"><div><label>GA4 Measurement ID</label><input id="seoGa4" placeholder="G-XXXXXXXXXX"></div><div><label>GTM Container ID</label><input id="seoGtm" placeholder="GTM-XXXXXXX"></div><div><label>Meta Pixel ID</label><input id="seoMetaPixel" inputmode="numeric"></div></div>
<div class="row"><div><label>Microsoft Clarity Project ID</label><input id="seoClarity"></div><div><label>Hotjar Site ID</label><input id="seoHotjar" inputmode="numeric"></div><div><label>TikTok Pixel ID</label><input id="seoTiktok"></div></div>
<h3>Organization Schema</h3><div class="row"><div><label>Organization name</label><input id="seoOrgName"></div><div><label>Alternate name</label><input id="seoOrgAlt"></div><div><label>Logo path</label><input id="seoOrgLogo" placeholder="/favicon.svg"></div></div>
<label>SameAs URLs — رابط في كل سطر</label><textarea id="seoOrgSameAs" style="min-height:110px" placeholder="https://www.facebook.com/...&#10;https://x.com/..."></textarea>
<h3>Global JSON-LD</h3><p class="sub">يُحفظ كـJSON حقيقي ويُحقن كـapplication/ld+json فقط؛ لا يسمح بتنفيذ JavaScript.</p><textarea id="seoGlobalJsonLd" style="min-height:180px" placeholder='{"@context":"https://schema.org","@type":"Organization"}'></textarea><div class="row"><button id="previewJsonLdBtn" type="button">معاينة JSON-LD</button><button id="copyJsonLdBtn" type="button">نسخ JSON-LD</button></div><pre id="seoJsonLdPreview">لا يوجد JSON-LD مخصص</pre>
<h3>Custom &lt;head&gt; — Safe Tags</h3><p class="sub">يسمح فقط بـ meta وlink. يتم حذف JavaScript وhttp-equiv refresh وdata: تلقائيًا.</p><textarea id="seoCustomHead" style="min-height:120px" placeholder='<meta name="custom" content="value">&#10;<link rel="preconnect" href="https://example.com">'></textarea>
<h3>robots.txt — قواعد إضافية محمية</h3><p class="sub">القواعد الأساسية وSitemaps الخاصة بالموقع لا يمكن حذفها. Disallow: / مرفوض تلقائيًا.</p><textarea id="seoRobotsExtra" style="min-height:140px" placeholder="# Extra rules&#10;User-agent: ExampleBot&#10;Disallow: /example/"></textarea><div class="row"><button id="previewRobotsBtn" type="button">معاينة robots الحي</button><button id="copyRobotsBtn" type="button">نسخ robots</button><button id="downloadRobotsBtn" type="button">تنزيل robots.txt</button></div><pre id="seoRobotsPreview">اضغط معاينة robots الحي</pre>
<label>Per-route overrides JSON</label><p class="sub">يدعم المسارات الدقيقة وأنماط <code>:param</code> و<code>*</code>، مثل <code>/articles/:slug</code> أو <code>/en/*</code>.</p><textarea id="seoRouteOverrides" style="min-height:220px" placeholder='{"\/coupons":{"title":"...","description":"...","canonical":"\/coupons","robots":"index,follow","ogImage":"\/favicon.svg"}}'></textarea>
<label>301 Redirects JSON</label><textarea id="seoRedirects" style="min-height:150px" placeholder='{"\/old-path":"\/new-path"}'></textarea><p class="sub">Same-origin فقط. مسارات /api و/admin محمية ولا يمكن تحويلها من هنا. يمنع النظام self redirects والدورات المباشرة.</p>
<div class="row"><button id="saveSeoSettingsBtn">حفظ SEO Settings</button><button id="reloadSeoSettingsBtn">إعادة تحميل</button><button id="exportSeoSettingsBtn">تصدير JSON</button><button id="importSeoSettingsBtn">استيراد JSON</button><input id="importSeoSettingsFile" type="file" accept="application/json,.json" hidden></div><pre id="seoSettingsStatus">Loading...</pre></section>
<section class="panel" id="seoDropsPanel"><h2>SEO Drops Report — Google Search Console</h2><p class="sub">البيانات من Search Console المتصل بالمشروع. التقرير لا يخمّن زيارات أو انخفاضات عند غياب rows.</p><div class="seoGrid"><div class="seoCheck"><b>الفترة الحالية</b><span id="gscRange">-</span></div><div class="seoCheck"><b>المقارنة</b><span id="gscCompare">-</span></div><div class="seoCheck"><b>Impressions</b><span id="gscImpressions">-</span></div><div class="seoCheck"><b>Clicks</b><span id="gscClicks">-</span></div></div><div class="row"><button id="refreshGscBtn">تحديث التقرير من Snapshot</button></div><div id="gscMessage" class="sub" style="margin:12px 0"></div><div class="scroll"><table><thead><tr><th>الصفحة/الكلمة</th><th>السبب</th><th>قبل</th><th>الآن</th><th>التغيير</th><th>الإجراء</th></tr></thead><tbody id="gscDropRows"></tbody></table></div><pre id="gscRaw">Loading...</pre></section>
<section class="panel" id="conversionEventsPanel"><h2>Conversion & Social Events</h2><p class="sub">عدادات مجمعة داخل Cloudflare فقط بدون IP أو User ID. استخدمها لمعرفة السوق والكود والموضع والصفحة التي تولّد نية شراء.</p><div class="seoGrid"><div class="seoCheck"><b>Copy Code</b><span id="eventCopy">-</span></div><div class="seoCheck"><b>Shop Click</b><span id="eventShop">-</span></div><div class="seoCheck"><b>فتح Noon</b><span id="eventNoon">-</span></div><div class="seoCheck"><b>السعودية</b><span id="eventSaudi">-</span></div><div class="seoCheck"><b>الإمارات</b><span id="eventUae">-</span></div><div class="seoCheck"><b>WhatsApp Share</b><span id="eventWhatsApp">-</span></div></div><div class="row"><button id="refreshEventsBtn">تحديث Conversion Events</button></div><div class="row" style="margin:12px 0"><div style="flex:1"><b>أفضل الأكواد</b><div id="eventTopCoupons" class="sub">-</div></div><div style="flex:1"><b>أفضل المواضع</b><div id="eventTopPlacements" class="sub">-</div></div></div><div class="scroll"><table><thead><tr><th>المسار</th><th>الإجمالي</th><th>Copy</th><th>Shop</th><th>Noon</th><th>SA</th><th>AE</th><th>آخر حدث</th></tr></thead><tbody id="eventRows"></tbody></table></div><pre id="eventsRaw">Loading...</pre></section>
<section class="panel" id="qualityPanel"><h2>إعدادات الجودة</h2><div class="row"><div style="flex:2"><label>Workers AI model (Cloudflare-only)</label><input id="cfgModel" readonly></div><div style="flex:1"><label>Target words</label><input id="cfgTarget" type="number" min="1500" max="1900"></div><div style="flex:1"><label>Minimum words</label><input id="cfgMin" type="number" min="1500" max="1800"></div><div style="flex:1"><label>Quality threshold</label><input id="cfgQuality" type="number" min="95" max="100"></div></div><button id="saveConfigBtn">حفظ إعدادات الجودة</button></section><section class="panel" id="articlesPanel"><h2>المقالات</h2><div class="scroll"><table><thead><tr><th>العنوان</th><th>الدولة</th><th>الكوبون</th><th>الكلمات</th><th>زيارات فريدة</th><th>الجودة</th><th>تاريخ الإنشاء</th><th>آخر تحديث</th><th>Provider</th><th>Status</th><th>تعديل</th></tr></thead><tbody id="articleRows"></tbody></table></div></section><section class="panel" id="editorPanel" hidden><h2>تعديل المقال</h2><input id="editSlug" readonly><label>العنوان</label><input id="editTitle"><label>Meta description</label><input id="editMeta"><label>Primary keyword</label><input id="editKeyword"><label>Status</label><select id="editStatus"><option value="published">published</option><option value="draft">draft</option><option value="scheduled">scheduled</option></select><label>HTML</label><textarea id="editHtml"></textarea><button id="saveArticleBtn">حفظ المقال</button></section></main><script>
const $=id=>document.getElementById(id);
async function api(path,options={}){const r=await fetch(path,options);if(r.status===401){location='/admin';throw new Error('unauthorized')}const t=await r.text();try{return JSON.parse(t)}catch{return {raw:t}}}
function shortProvider(v){v=String(v||'-');return v.length>42?v.slice(0,40)+'…':v}
function fmtCountTime(v){if(!v)return 'لم يتم العد بعد';try{return new Date(v).toLocaleString('ar-EG',{hour12:true})}catch{return v}}
function fmtArticleDate(v){if(!v)return '-';try{return new Date(v).toLocaleString('ar-EG',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:true})}catch{return String(v)}}
function escHtml(v){return String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}
async function refreshMetrics(freshCount=false){
  const suffix=freshCount?'?fresh=1':'';
  const overview=await api('/api/admin/live-overview'+suffix),d=overview.admin||{},h=overview.health||{},c=overview.contentStats||{};
  $('metricArticles').textContent=c.r2Uploaded??c.total??h.articleCount??d.articleCount??'-';
  $('metricArabic').textContent=c.arabic??'-';
  $('metricEnglish').textContent=c.english??'-';
  const sa=c.storageAudit||{},cm=c.couponMigration||{};
  $('metricTracked').textContent=sa.trackedPublished??c.total??'-';
  $('metricQualified').textContent=sa.auditQualified??(sa.discoveryComplete?0:'جارٍ الفحص');
  $('metricQualifiedSub').textContent=sa.discoveryComplete?('Audit-qualified · '+(sa.auditCoveragePercent??'-')+'% · '+(sa.discoveryShards??0)+' shards'):'لم يكتمل الـFull Corpus Audit بعد';
  $('metricUntracked').textContent=sa.untrackedEstimate??'-';
  $('metricCouponMigration').textContent=cm.done?'مكتمل':(cm.scanned??0);
  $('metricCouponMigrationSub').textContent=cm.done?'تم تنظيف الأكواد القديمة':('Scanned '+(cm.scanned??0)+' · Updated '+(cm.updated??0)+' · Replaced '+(cm.replaced??0));
  const rc=c.r2Count||{};
  $('metricCountFresh').textContent='آخر عد R2: '+fmtCountTime(rc.countedAt||c.generatedAt)+(rc.cached?' · cached':' · fresh')+' · تحديث تلقائي كل 60 ثانية';
  $('metricGenerated').textContent=h.workersAiPublishedTotal??h.status?.published??0;
  $('metricFailed').textContent=h.status?.failed??d.generator?.failed??0;
  $('metricLast').textContent=(h.status?.lastRun||d.generator?.lastRun||'-').slice(11,16)||'-';
  $('metricAI').textContent=h.workersAI?.available?'Ready':h.workersAI?.quotaBlocked?'Quota used':'Paused';
  $('metricAIUsage').textContent=(h.workersAI?.used??0)+'/'+(h.workersAI?.cap??0)+' articles · '+(h.workersAI?.callsUsed??0)+'/'+(h.workersAI?.callCap??0)+' calls';
  $('metricProvider').textContent=shortProvider(h.lastWorkersAiSuccess?.provider||h.status?.lastProvider);
  $('metricVersion').textContent=h.version||'-';
  $('policyBadge').textContent=h.publishPolicy||'-';
  $('r2Badge').textContent=h.r2Ready?'R2 Ready':'R2 Missing';
  $('qualityBadge').textContent='Quality ≥ '+(d.config?.qualityThreshold??95);
  $('fallbackBadge').textContent='Fallback: '+shortProvider(h.workersAI?.fallbackModel||'-');
  $('generatorStatus').textContent=JSON.stringify({contentStats:c,health:h,admin:d},null,2);
  $('cfgModel').value=h.workersAI?.model||d.config?.model||'';$('cfgTarget').value=d.config?.targetWords||1700;$('cfgMin').value=d.config?.minWords||1500;$('cfgQuality').value=d.config?.qualityThreshold||95;
}
async function refreshSeo(){
  const s=await api('/api/admin/seo-overview'),x=s.checks||{};
  const mark=v=>'<span class="'+(v?'yes':'no')+'">'+(v?'جاهز ✓':'مشكلة ✕')+'</span>';
  $('seoRobots').innerHTML=mark(x.robotsPublic&&x.sitemapDeclared);
  $('seoSitemap').innerHTML=mark(x.sitemapHealthy);
  $('seoLlms').innerHTML=mark(x.llmsHealthy);
  $('seoIndexNow').innerHTML=mark(x.indexNowEnabled);
  $('seoResearch').innerHTML=mark(x.researchHealthy);
  $('seoGlossary').innerHTML=mark(x.glossaryHealthy);
  $('seoCountries').innerHTML=mark(x.countriesHealthy);
  $('seoCodes').textContent=(x.approvedCouponCount??'-')+' · '+((x.approvedCoupons||[]).join(', '));
  const ap=x.corpusAuditProgress||{};
  $('seoCorpusAudit').innerHTML=(x.corpusAuditDone?'<span class="yes">مكتمل ✓</span>':'<span>جارٍ الفحص</span>')+' · '+(ap.scanned??0)+' scanned · '+(ap.readFailures??0)+' failures';
  $('seoDiscovery').innerHTML=x.discoveryComplete?('<span class="yes">مكتمل ✓</span> · '+(x.discoveryArticles??0)+' مقالة · '+(x.discoveryShards??0)+' shards'):'<span>بانتظار اكتمال الـAudit</span>';
  $('seoAuditArchive').innerHTML=x.auditArchiveReady?'<span class="yes">جاهز ✓</span>':'<span>غير مفعل بعد</span>';
  $('seoOverviewJson').textContent=JSON.stringify(s,null,2);
}
async function refreshGscDrops(){
  const s=await api('/api/admin/seo-drops'),r=s.effectiveRange||{},p=s.comparisonRange||{},t=s.totals||{};
  $('gscRange').textContent=(r.startDate||'-')+' → '+(r.endDate||'-');
  $('gscCompare').textContent=(p.startDate||'-')+' → '+(p.endDate||'-');
  $('gscImpressions').textContent=t.impressions??0;$('gscClicks').textContent=t.clicks??0;
  $('gscMessage').textContent=s.dataAvailable?'بيانات GSC متاحة.':'GSC متصل، لكن لا توجد rows قابلة للتحليل في الفترة النهائية الحالية.';
  const rows=[...(s.drops||[]),...(s.lowCtrPages||[]),...(s.fallingKeywords||[])];
  $('gscDropRows').innerHTML=rows.length?rows.map(x=>'<tr><td>'+escHtml(x.page||x.query||x.url||'-')+'</td><td>'+escHtml(x.reason||x.type||'-')+'</td><td>'+escHtml(x.previousImpressions??x.previousClicks??'-')+'</td><td>'+escHtml(x.impressions??x.clicks??'-')+'</td><td>'+escHtml(x.change??x.impressionChange??x.clickChange??'-')+'</td><td>'+escHtml(x.action||'راجع المحتوى والـCTR والربط الداخلي')+'</td></tr>').join(''):'<tr><td colspan="6">لا توجد Drops قابلة للتصنيف من بيانات GSC الحالية.</td></tr>';
  $('gscRaw').textContent=JSON.stringify(s,null,2);
}
async function loadSeoSettings(){
  const s=await api('/api/admin/seo-settings');
  $('seoSiteName').value=s.siteName||'Noon Deals Now';
  $('seoDefaultOg').value=s.defaultOgImage||'/favicon.svg';
  $('seoTwitterSite').value=s.twitterSite||'';
  $('seoFacebookAppId').value=s.facebookAppId||'';
  $('seoGoogleVerification').value=s.googleVerification||'';
  $('seoBingVerification').value=s.bingVerification||'';
  $('seoYandexVerification').value=s.yandexVerification||'';
  $('seoPinterestVerification').value=s.pinterestVerification||'';
  $('seoAnalyticsEnabled').checked=Boolean(s.analyticsEnabled);
  $('seoRespectDnt').checked=s.respectDoNotTrack!==false;
  $('seoGa4').value=s.ga4MeasurementId||'';
  $('seoGtm').value=s.gtmContainerId||'';
  $('seoMetaPixel').value=s.metaPixelId||'';
  $('seoClarity').value=s.clarityProjectId||'';
  $('seoHotjar').value=s.hotjarSiteId||'';
  $('seoTiktok').value=s.tiktokPixelId||'';
  $('seoOrgName').value=s.organizationName||'Noon Deals Now';
  $('seoOrgAlt').value=s.organizationAlternateName||'كوبونات نون';
  $('seoOrgLogo').value=s.organizationLogo||'/favicon.svg';
  $('seoOrgSameAs').value=(s.organizationSameAs||[]).join('\\n');
  $('seoGlobalJsonLd').value=s.globalJsonLd?JSON.stringify(s.globalJsonLd,null,2):'';
  $('seoCustomHead').value=s.customHeadHtml||'';
  $('seoRobotsExtra').value=s.robotsExtraRules||'';
  $('seoRouteOverrides').value=JSON.stringify(s.routeOverrides||{},null,2);
  $('seoRedirects').value=JSON.stringify(s.redirects||{},null,2);
  $('seoSettingsStatus').textContent='Loaded '+(s.updatedAt||'defaults')+' · Analytics '+(s.analyticsEnabled?'ON':'OFF')+' · Redirects '+Object.keys(s.redirects||{}).length;
}
async function saveSeoSettings(){
  let routeOverrides={},redirects={};
  try{routeOverrides=JSON.parse($('seoRouteOverrides').value||'{}')}catch{$('seoSettingsStatus').textContent='Per-route JSON غير صالح';return}
  try{redirects=JSON.parse($('seoRedirects').value||'{}')}catch{$('seoSettingsStatus').textContent='Redirects JSON غير صالح';return}
  let globalJsonLd=null;const rawSchema=$('seoGlobalJsonLd').value.trim();if(rawSchema){try{globalJsonLd=JSON.parse(rawSchema)}catch{$('seoSettingsStatus').textContent='Global JSON-LD غير صالح';return}}
  const payload={siteName:$('seoSiteName').value,defaultOgImage:$('seoDefaultOg').value,twitterSite:$('seoTwitterSite').value,facebookAppId:$('seoFacebookAppId').value,googleVerification:$('seoGoogleVerification').value,bingVerification:$('seoBingVerification').value,yandexVerification:$('seoYandexVerification').value,pinterestVerification:$('seoPinterestVerification').value,analyticsEnabled:$('seoAnalyticsEnabled').checked,respectDoNotTrack:$('seoRespectDnt').checked,ga4MeasurementId:$('seoGa4').value,gtmContainerId:$('seoGtm').value,metaPixelId:$('seoMetaPixel').value,clarityProjectId:$('seoClarity').value,hotjarSiteId:$('seoHotjar').value,tiktokPixelId:$('seoTiktok').value,organizationName:$('seoOrgName').value,organizationAlternateName:$('seoOrgAlt').value,organizationLogo:$('seoOrgLogo').value,organizationSameAs:$('seoOrgSameAs').value,globalJsonLd,customHeadHtml:$('seoCustomHead').value,robotsExtraRules:$('seoRobotsExtra').value,routeOverrides,redirects};
  const r=await api('/api/admin/seo-settings',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
  $('seoSettingsStatus').textContent=JSON.stringify(r.settings||r,null,2);
}
async function exportSeoSettings(){
  const s=await api('/api/admin/seo-settings'),blob=new Blob([JSON.stringify(s,null,2)],{type:'application/json'}),a=document.createElement('a');
  a.href=URL.createObjectURL(blob);a.download='noondealsnow-seo-settings.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
function applyImportedSeoSettings(s){
  $('seoSiteName').value=s.siteName||'Noon Deals Now';$('seoDefaultOg').value=s.defaultOgImage||'/favicon.svg';$('seoTwitterSite').value=s.twitterSite||'';$('seoFacebookAppId').value=s.facebookAppId||'';
  $('seoGoogleVerification').value=s.googleVerification||'';$('seoBingVerification').value=s.bingVerification||'';$('seoYandexVerification').value=s.yandexVerification||'';$('seoPinterestVerification').value=s.pinterestVerification||'';
  $('seoAnalyticsEnabled').checked=Boolean(s.analyticsEnabled);$('seoRespectDnt').checked=s.respectDoNotTrack!==false;$('seoGa4').value=s.ga4MeasurementId||'';$('seoGtm').value=s.gtmContainerId||'';$('seoMetaPixel').value=s.metaPixelId||'';$('seoClarity').value=s.clarityProjectId||'';$('seoHotjar').value=s.hotjarSiteId||'';$('seoTiktok').value=s.tiktokPixelId||'';
  $('seoOrgName').value=s.organizationName||'Noon Deals Now';$('seoOrgAlt').value=s.organizationAlternateName||'كوبونات نون';$('seoOrgLogo').value=s.organizationLogo||'/favicon.svg';$('seoOrgSameAs').value=(s.organizationSameAs||[]).join('\\n');$('seoGlobalJsonLd').value=s.globalJsonLd?JSON.stringify(s.globalJsonLd,null,2):'';$('seoCustomHead').value=s.customHeadHtml||'';$('seoRobotsExtra').value=s.robotsExtraRules||'';
  $('seoRouteOverrides').value=JSON.stringify(s.routeOverrides||{},null,2);$('seoRedirects').value=JSON.stringify(s.redirects||{},null,2);$('seoSettingsStatus').textContent='تم تحميل JSON للمعاينة — اضغط حفظ لتطبيقه.';
}
async function importSeoSettingsFile(file){
  if(!file)return;try{const s=JSON.parse(await file.text());applyImportedSeoSettings(s)}catch(e){$('seoSettingsStatus').textContent='ملف JSON غير صالح'}
}
async function refreshConversionEvents(){
  const s=await api('/api/admin/conversion-events'),t=s.totals||{},m=s.markets||{};
  $('eventCopy').textContent=t.copy_code||0;$('eventShop').textContent=t.shop_click||0;$('eventNoon').textContent=t.open_noon||0;$('eventSaudi').textContent=m.SA||0;$('eventUae').textContent=m.AE||0;$('eventWhatsApp').textContent=t.share_whatsapp||0;
  $('eventTopCoupons').textContent=(s.topCoupons||[]).map(x=>x.key+' · '+x.count).join(' | ')||'لا توجد بيانات بعد';
  $('eventTopPlacements').textContent=(s.topPlacements||[]).map(x=>x.key+' · '+x.count).join(' | ')||'لا توجد بيانات بعد';
  $('eventRows').innerHTML=(s.topPaths||[]).map(x=>{const e=x.events||{},mm=x.markets||{};return '<tr><td>'+escHtml(x.path)+'</td><td>'+escHtml(x.total||0)+'</td><td>'+escHtml(e.copy_code||0)+'</td><td>'+escHtml(e.shop_click||0)+'</td><td>'+escHtml(e.open_noon||0)+'</td><td>'+escHtml(mm.SA||0)+'</td><td>'+escHtml(mm.AE||0)+'</td><td>'+escHtml(fmtArticleDate(x.lastAt))+'</td></tr>'}).join('')||'<tr><td colspan="8">لا توجد أحداث مسجلة حتى الآن.</td></tr>';
  $('eventsRaw').textContent=JSON.stringify(s,null,2);
}
function previewJsonLd(){
  const raw=$('seoGlobalJsonLd').value.trim();if(!raw){$('seoJsonLdPreview').textContent='لا يوجد JSON-LD مخصص';return}
  try{$('seoJsonLdPreview').textContent=JSON.stringify(JSON.parse(raw),null,2)}catch{$('seoJsonLdPreview').textContent='JSON غير صالح'}
}
async function copyTextValue(v){try{await navigator.clipboard.writeText(v);return true}catch{return false}}
async function copyJsonLd(){previewJsonLd();await copyTextValue($('seoJsonLdPreview').textContent)}
async function previewRobots(){
  try{const r=await fetch('/robots.txt?admin-preview='+Date.now(),{cache:'no-store'});$('seoRobotsPreview').textContent=await r.text()}catch{$('seoRobotsPreview').textContent='تعذر تحميل robots.txt'}
}
async function copyRobots(){await previewRobots();await copyTextValue($('seoRobotsPreview').textContent)}
async function downloadRobots(){await previewRobots();const blob=new Blob([$('seoRobotsPreview').textContent],{type:'text/plain'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='robots.txt';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
async function refreshArticles(){
  const rows=await api('/api/admin/articles');
  $('articleRows').innerHTML=rows.articles.slice(0,500).map(x=>{
    const words=x.wordCount??x.auditSummary?.wordCount??x.words??'-',created=x.createdAt||x.publishedAt||null,updated=x.updatedAt||created;
    return '<tr><td>'+escHtml(x.title)+'</td><td>'+escHtml(x.country)+'</td><td>'+escHtml(x.coupon)+'</td><td>'+escHtml(words)+'</td><td>'+escHtml(x.uniqueVisits??0)+'</td><td>'+escHtml(x.quality)+'</td><td>'+escHtml(fmtArticleDate(created))+'</td><td>'+escHtml(fmtArticleDate(updated))+'</td><td>'+escHtml(x.provider||'-')+'</td><td>'+escHtml(x.status)+'</td><td><button data-edit="'+encodeURIComponent(x.slug)+'">تعديل</button></td></tr>';
  }).join('');
  document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>edit(b.dataset.edit));
}
const aiV2Legacy={
  gemini:['GEMINI_API_KEY','GEMINI_API_KEYS','GEMINI_API_KEYS_EXTRA'],
  groq:['GROQ_API_KEY','GROQ_API_KEYS','GROQ_API_KEYS_EXTRA']
};
let aiV2GithubMetadata=null;
const aiV2IntervalValue=v=>[1,5,10,15,30,60].includes(v)?v:1;
function aiV2Friendly(status){
 const labels={'quota-wait':'ينتظر تجديد الحصة','provider-wait':'انتظار مؤقت للخدمة',
  'eligible-unverified':'غير محظور — لم يُختبر الآن','unverified':'حالة غير معروفة'};
 return labels[status]||'غير معروف';
}
function aiV2SecretNames(provider){
 const prefix=provider==='gemini'?'NDN_GEMINI_POOL_':'NDN_GROQ_POOL_';
 const names=aiV2Legacy[provider].slice();
 for(let i=1;i<=12;i++)names.push(prefix+String(i).padStart(2,'0'));
 return names;
}
function aiV2SetText(id,value){$(id).textContent=value==null?'—':String(value)}
function aiV2RenderProvider(provider,monitor){
 const target=$(provider==='gemini'?'aiV2GeminiKeys':'aiV2GroqKeys');
 target.replaceChildren();
 const groups=aiV2GithubMetadata?.groups?.[provider]||[];
 const byName=new Map(groups.map(x=>[x.name,x]));
 const entries=Array.isArray(monitor?.entries)?monitor.entries:[];
 for(const name of aiV2SecretNames(provider)){
   const box=document.createElement('div');
   box.style.cssText='padding:9px 0;border-bottom:1px solid #e5e7eb;overflow-wrap:anywhere';
   const heading=document.createElement('div');
   heading.style.fontWeight='800';heading.style.direction='ltr';heading.style.textAlign='left';
   const metadata=byName.get(name);
   heading.textContent=name+'  ·  '+(!metadata?'وجود المفتاح غير محدد':metadata.configured?'موجود في GitHub':'غير موجود');
   box.append(heading);
   const matches=entries.filter(x=>x.source===name);
   if(matches.length){
     for(const item of matches.slice(0,20)){
       const line=document.createElement('div');
       line.className='sub';line.style.direction='ltr';line.style.textAlign='left';
       line.textContent='#'+item.id+' · '+aiV2Friendly(item.status)+(item.resumeAt?' · '+new Date(item.resumeAt).toLocaleString('ar-EG'):'');
       box.append(line);
     }
     if(matches.length>20){const more=document.createElement('small');more.textContent='معرّفات إضافية: '+(matches.length-20);box.append(more)}
   }else{
     const note=document.createElement('div');note.className='sub';
     note.textContent=metadata?.configured?'موجود؛ العدد الدقيق في هذا الـSecret غير قابل للقراءة من GitHub':'لا توجد بيانات تشغيل مؤكدة لهذه الخانة';
     box.append(note);
   }
   target.append(box);
 }
 if(monitor?.counts?.notInspected>0){
   const note=document.createElement('p');note.className='sub';
   note.textContent='مفاتيح أخرى لم تُفحص كوتتها في التقرير الحالي: '+monitor.counts.notInspected;
   target.append(note);
 }
}
function aiV2DescribeQuota(monitor){
 if(!monitor)return 'لم يصل تقرير حالة المفاتيح بعد';
 const c=monitor.counts||{};
 return 'غير محظور: '+(c.eligibleUnverified??'؟')+
   ' · انتظار كوتة: '+(c.quotaWait??'؟')+
   ' · تعطل مؤقت: '+(c.providerWait??'؟')+
   ' · غير محسوم: '+((c.unverified||0)+(c.notInspected||0));
}
async function refreshAiV2(){
 try{
  const [p,m]=await Promise.all([api('/api/admin/ai-v2-control'),api('/api/admin/ai-v2-monitor')]);
  if(p.ok!==true||m.ok!==true)throw Error(p.error||m.error||'monitor_unavailable');
  $('aiV2Interval').value=String(aiV2IntervalValue(p.intervalMinutes));
  const scheduler=m.scheduler||{},verified=m.verified||{},s=m.status||'unknown';
  let message='',kind='normal';
  if(!p.enabled){message='متوقف بأمر الإدارة — لا ينبغي إرسال تشغيلات جديدة';kind='paused'}
  else if(!scheduler.reachable){message='حالة المجدول غير متاحة — لا يمكن تأكيد أن التوليد يعمل';kind='warn'}
  else if(!scheduler.enabled){message='التشغيل مطلوب، لكن مجدول Cloudflare غير مفعل فعليًا: '+(scheduler.controlStatus||'unknown');kind='warn'}
  else if(s==='quota-wait'){message='انتظار تجديد حصة بعض مفاتيح الذكاء الاصطناعي';kind='warn'}
  else if(s==='searching-topic'){message='المجدول يعمل، لكن آخر محاولة لم تجد موضوعًا جاهزًا للتوليد (QUEUE_WINDOW_EMPTY)';kind='warn'}
  else if(s==='published-recently'){message='المجدول يعمل — تم توثيق مقال منشور حديثًا';kind='good'}
  else{message='المجدول يعمل · لم يُؤكد نشر جديد في آخر تقرير';kind='normal'}
  const bar=$('aiV2HealthBar');bar.textContent=message+' · الفاصل المطلوب '+p.intervalMinutes+' دقيقة';
  bar.style.background=kind==='good'?'#ecfdf5':kind==='warn'?'#fffbeb':kind==='paused'?'#fef2f2':'#f1f5f9';
  bar.style.borderColor=kind==='good'?'#86efac':kind==='warn'?'#fcd34d':kind==='paused'?'#fecaca':'#cbd5e1';
  for(const provider of ['gemini','groq']){
    const pm=m.providers?.[provider]||null;
    aiV2SetText(provider==='gemini'?'aiV2GeminiCount':'aiV2GroqCount',pm?.total??'غير معروف');
    aiV2SetText(provider==='gemini'?'aiV2GeminiQuota':'aiV2GroqQuota',aiV2DescribeQuota(pm));
    aiV2RenderProvider(provider,pm);
  }
  aiV2SetText('aiV2VerifiedHour',verified?.lastHour?.total??'غير معلوم');
  const chosen=m.latestSelected;
  aiV2SetText('aiV2RecentKey',chosen?chosen.provider+' #'+chosen.id:'لا يوجد مفتاح مختار في آخر تقرير');
  aiV2SetText('aiV2LastChecked',m.lastReportAt?
    'آخر رصد '+new Date(m.lastReportAt).toLocaleString('ar-EG',{timeZone:'Africa/Cairo'}):'لم يصل تقرير GitHub بعد');
  $('aiV2Status').textContent=JSON.stringify({desired:p,actualScheduler:scheduler,state:s,
    markets:m.markets,providers:m.providers,verified:verified,safety:m.safety},null,2);
 }catch(e){
   $('aiV2HealthBar').textContent='لا يمكن تحديد الحالة الفعلية: '+String(e.message||e);
   $('aiV2HealthBar').style.background='#fef2f2';
   $('aiV2Status').textContent='تعذر فحص مجدول AI V2: '+String(e.message||e);
 }
}
async function updateAiV2(payload){
 $('aiV2ActionMessage').textContent='جارٍ حفظ الطلب...';
 try{
   const result=await api('/api/admin/ai-v2-control',{method:'POST',
     headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
   if(result.ok!==true)throw Error(result.error||'control_update_failed');
   $('aiV2ActionMessage').textContent='تم حفظ طلب التشغيل. سيُفحص المجدول الفعلي عند التحديث.';
   await refreshAiV2();
 }catch(e){$('aiV2ActionMessage').textContent='فشل: '+String(e.message||e)}
}
async function aiV2LoadSecrets(){
 $('aiV2ActionMessage').textContent='جارٍ قراءة أسماء الخانات فقط من GitHub...';
 try{
   const r=await api('/api/admin/ai-v2-keys',{method:'POST',
     headers:{'content-type':'application/json'},body:JSON.stringify({githubToken:$('aiV2GithubToken').value})});
   if(r.ok!==true)throw Error(r.error||'github_secrets_access_failed');
   aiV2GithubMetadata=r;
   $('aiV2ActionMessage').textContent='تمت قراءة أسماء خانات GitHub. قيم المفاتيح مخفية بطبيعتها.';
   await refreshAiV2();
 }catch(e){$('aiV2ActionMessage').textContent='تعذر قراءة GitHub: '+String(e.message||e)}
}
async function aiV2Import(){
 const keys=$('aiV2BulkKeys').value;
 if(!keys.trim()){$('aiV2ActionMessage').textContent='أدخل مفتاحًا واحدًا أو مفاتيح متعددة';return}
 if(!confirm('سيتم رفع المفاتيح إلى GitHub Actions Secrets مشفرة، دون استبدال الخانات القديمة. هل تريد المتابعة؟'))return;
 $('aiV2ActionMessage').textContent='جارٍ الحفظ المشفر...';
 try{
  const payload={provider:$('aiV2Provider').value,keys,githubToken:$('aiV2GithubToken').value};
  const r=await api('/api/admin/ai-v2-key-import',{method:'POST',
    headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
  if(r.ok!==true)throw Error(r.error||'github_import_failed');
  $('aiV2BulkKeys').value='';$('aiV2KeyFile').value='';
  $('aiV2ActionMessage').textContent='حُفظ '+r.addedCount+' مفتاح مشفر في '+r.secretName+
    ' · سيظهر في تشغيل GitHub التالي. صلاحية الكوتة لم تُختبر بعد.';
  await aiV2LoadSecrets();
 }catch(e){$('aiV2ActionMessage').textContent='فشل إضافة المفاتيح: '+String(e.message||e)}
}
async function aiV2ManualRun(){
 if(!confirm('بدء محاولة توليد واحدة على GitHub؟ قد تستهلك حصة Gemini/Groq المجانية إن توفر موضوع جاهز.'))return;
 $('aiV2ActionMessage').textContent='جارٍ تقديم طلب إعادة تشغيل...';
 try{
   const state=await api('/api/admin/ai-v2-control');
   if(state.enabled!==true)await updateAiV2({enabled:true});
   const result=await api('/api/admin/ai-v2-run-now',{method:'POST',
     headers:{'content-type':'application/json'},body:JSON.stringify({githubToken:$('aiV2GithubToken').value})});
   if(result.ok!==true)throw Error(result.error||'dispatch_failed');
   $('aiV2ActionMessage').textContent='GitHub قبل طلب التشغيل، لكن هذا لا يعني أنه نشر مقالًا؛ راجع حالة التقرير.';
   await refreshAiV2();
 }catch(e){$('aiV2ActionMessage').textContent='تعذر إعادة التشغيل: '+String(e.message||e)}
}
async function aiV2OpenFile(file){
 if(!file)return;
 if(file.size>22000){$('aiV2ActionMessage').textContent='الملف كبير جدًا (الحد 22KB)';return}
 try{$('aiV2BulkKeys').value=await file.text();$('aiV2ActionMessage').textContent='تم تحميل الملف محليًا. اضغط الحفظ المشفر لإضافته إلى GitHub.'}
 catch{$('aiV2ActionMessage').textContent='تعذر قراءة الملف'}
}
async function refresh(){await Promise.all([refreshMetrics(false),refreshArticles(),refreshSeo(),loadSeoSettings(),refreshGscDrops(),refreshConversionEvents(),refreshAiV2()])}
async function setGenerator(enabled){await api('/api/admin/generator',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({enabled})});await refreshMetrics(false)}
async function generateNow(){$('generatorStatus').textContent='Generating...';const r=await api('/api/admin/generate-now',{method:'POST'});$('generatorStatus').textContent=JSON.stringify(r,null,2);await Promise.all([refreshMetrics(true),refreshArticles()])}
async function saveConfig(){await api('/api/admin/generator',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({targetWords:+$('cfgTarget').value,minWords:+$('cfgMin').value,qualityThreshold:+$('cfgQuality').value})});await refreshMetrics(false)}
async function edit(slug){const d=await api('/api/admin/article?slug='+slug);$('editSlug').value=d.record.slug;$('editTitle').value=d.record.title;$('editMeta').value=d.record.metaDescription||'';$('editKeyword').value=d.record.primaryKeyword||'';$('editStatus').value=d.record.status;$('editHtml').value=d.html||'';$('editorPanel').hidden=false;$('editorPanel').scrollIntoView({behavior:'smooth'})}
async function saveArticle(){await api('/api/admin/article',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({slug:$('editSlug').value,title:$('editTitle').value,metaDescription:$('editMeta').value,primaryKeyword:$('editKeyword').value,status:$('editStatus').value,html:$('editHtml').value})});alert('تم الحفظ');await Promise.all([refreshMetrics(true),refreshArticles()])}
async function logout(){await api('/api/admin/logout',{method:'POST'});location='/admin'}
$('aiV2StartBtn').onclick=()=>updateAiV2({enabled:true});$('aiV2StopBtn').onclick=()=>updateAiV2({enabled:false});$('aiV2SaveIntervalBtn').onclick=()=>updateAiV2({intervalMinutes:Number($('aiV2Interval').value)});$('aiV2RefreshBtn').onclick=refreshAiV2;$('aiV2RunNowBtn').onclick=aiV2ManualRun;$('aiV2ImportBtn').onclick=aiV2Import;$('aiV2LoadSecretsBtn').onclick=aiV2LoadSecrets;$('aiV2ClearTokenBtn').onclick=()=>{$('aiV2GithubToken').value='';$('aiV2ActionMessage').textContent='تم مسح الرمز من الصفحة'};$('aiV2KeyFile').onchange=e=>aiV2OpenFile(e.target.files?.[0]);$('refreshSeoBtn').onclick=refreshSeo;$('refreshGscBtn').onclick=refreshGscDrops;$('refreshEventsBtn').onclick=refreshConversionEvents;$('saveSeoSettingsBtn').onclick=saveSeoSettings;$('reloadSeoSettingsBtn').onclick=loadSeoSettings;$('exportSeoSettingsBtn').onclick=exportSeoSettings;$('importSeoSettingsBtn').onclick=()=>$('importSeoSettingsFile').click();$('importSeoSettingsFile').onchange=e=>importSeoSettingsFile(e.target.files?.[0]);$('previewJsonLdBtn').onclick=previewJsonLd;$('copyJsonLdBtn').onclick=copyJsonLd;$('previewRobotsBtn').onclick=previewRobots;$('copyRobotsBtn').onclick=copyRobots;$('downloadRobotsBtn').onclick=downloadRobots;$('resumeBtn').onclick=()=>setGenerator(true);$('pauseBtn').onclick=()=>{};$('generateBtn').onclick=generateNow;$('refreshCountBtn').onclick=()=>refreshMetrics(true);$('saveConfigBtn').onclick=saveConfig;$('saveArticleBtn').onclick=saveArticle;$('logoutBtn').onclick=logout;refresh();setInterval(()=>{refreshMetrics(false).catch(()=>{});refreshAiV2().catch(()=>{})},60000);
</script></body></html>`}

export async function renderAdmin(req,env){return (await isAdmin(req,env))?html(dashboard()):html(login())}

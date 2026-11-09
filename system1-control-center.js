// The main NoonDealsNow operator surface. Existing legacy admin remains intact.
// All controls use the already authenticated and CSRF-protected admin API.
import {isAdmin} from './admin-runtime.js';
const pageHeaders={'content-type':'text/html; charset=utf-8','cache-control':'private, no-store','x-robots-tag':'noindex,nofollow','referrer-policy':'same-origin','x-content-type-options':'nosniff'};
export async function renderSystem1(req,env){
 if(!(await isAdmin(req,env)))return new Response(null,{status:302,headers:{location:'/admin','cache-control':'no-store','x-robots-tag':'noindex'}});
 return new Response(SYSTEM1_HTML,{headers:pageHeaders});
}
export const SYSTEM1_HTML=String.raw`<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>SYSTEM1 — مركز التحكم | NoonDealsNow</title>
<style>
:root{font-family:Tahoma,"Segoe UI",Arial,sans-serif;color:#172132;background:#f4f6f9;line-height:1.65}
*{box-sizing:border-box}body{margin:0}button,input,textarea,select{font:inherit}button{cursor:pointer}a{color:#2563eb}
.shell{display:grid;grid-template-columns:240px minmax(0,1fr);min-height:100vh}
aside{position:sticky;top:0;align-self:start;height:100vh;overflow-y:auto;background:#101c30;color:#f8fafc;padding:20px 14px}
.brand{padding:4px 9px 20px;border-bottom:1px solid #344258;margin-bottom:13px}.brand strong{font-size:24px;letter-spacing:.4px}.brand p{font-size:11px;color:#b6c2d2;margin:5px 0}
.navgroup{color:#b4c4d8;font-size:11px;margin:17px 10px 6px}.navbtn{width:100%;display:block;border:0;text-align:right;color:#d7e1ee;background:transparent;border-radius:10px;padding:11px 12px;font-weight:700;margin:2px 0}
.navbtn:hover,.navbtn.active{background:#233b57;color:#fff}.navbtn:focus-visible,.action:focus-visible{outline:3px solid #60a5fa;outline-offset:2px}
.asideBottom{margin-top:22px;padding-top:16px;border-top:1px solid #344258;font-size:12px}.asideBottom a{color:#b8d7ff;display:block;padding:8px}
main{min-width:0;padding:22px max(16px,3vw) 55px;max-width:1510px;width:100%}.header{display:flex;justify-content:space-between;gap:15px;align-items:center;margin-bottom:22px}
h1{font-size:25px;margin:0 0 4px}h2{font-size:21px;margin:0 0 7px}h3{font-size:16px;margin:3px 0 8px}
.dim{color:#657389;font-size:13px}.muted{color:#657389}.section{display:none}.section.active{display:block}
.panel{background:#fff;border:1px solid #dfe6ef;border-radius:15px;padding:18px;margin:13px 0;box-shadow:0 3px 14px #11182705}
.panel>p{margin-top:5px}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:14px 0}
.grid.two{grid-template-columns:repeat(2,minmax(0,1fr))}.stat{background:#fff;border:1px solid #e1e6ef;border-radius:13px;padding:16px;min-width:0}
.stat b{font-size:24px;display:block;color:#14263e}.stat small{font-size:12px;color:#64748b}
.state{border:1px solid #d6dfeb;border-right:4px solid #61738d;border-radius:12px;background:#f8fafc;padding:14px 16px;margin:12px 0;min-height:62px}
.state strong{display:block}.state small{color:#526071}.state.ok{border-right-color:#1b8061;background:#f6fcf9}.state.warn{border-right-color:#bd8b25;background:#fffdf5}.state.stop{border-right-color:#a94646;background:#fff8f8}
.row{display:flex;flex-wrap:wrap;gap:12px;align-items:end}.field{flex:1;min-width:170px}.field.long{flex:2;min-width:250px}
label{display:block;font-size:13px;font-weight:700;margin-bottom:4px}
input,select,textarea{width:100%;border:1px solid #c8d4e3;border-radius:10px;background:white;padding:10px;min-height:43px;color:#122135}
textarea{height:116px;min-height:116px;resize:vertical;direction:ltr;text-align:left}.action{border-radius:10px;background:#162b46;color:#fff;padding:11px 14px;border:0;font-weight:700;min-height:42px}.action.secondary{background:#e9eef5;color:#1d334f}.action.danger{background:#a93434}.action:disabled{opacity:.45;cursor:not-allowed}
.pill{display:inline-block;border:1px solid #d3deea;border-radius:30px;padding:4px 8px;font-size:11px;color:#385473;background:#f8fafc}
.tablewrap{overflow:auto;border:1px solid #e5eaf1;border-radius:12px;margin-top:12px}table{width:100%;border-collapse:collapse;min-width:680px;font-size:12px}
th,td{padding:10px;text-align:right;border-bottom:1px solid #e7edf5;vertical-align:top}th{background:#f8fafc;font-weight:800}tr:last-child td{border-bottom:0}
.data-note{font-size:12px;color:#556579;background:#f5f7fb;padding:10px 12px;border-radius:10px;margin:12px 0}
.tag{font-size:11px;border:1px solid #d2dbe7;border-radius:20px;padding:2px 7px;white-space:nowrap}
.linkrow{display:flex;flex-wrap:wrap;gap:12px}.linkrow a{border:1px solid #d9e3ef;border-radius:9px;padding:9px 11px;text-decoration:none;font-weight:700}
#message{position:fixed;bottom:14px;left:14px;right:14px;max-width:660px;margin:auto;background:#172c46;color:#fff;padding:13px;border-radius:12px;z-index:60;box-shadow:0 12px 35px #0002}#message[hidden]{display:none}
.smalllist>div{padding:9px 0;border-bottom:1px solid #edf1f6;font-size:12px;overflow-wrap:anywhere}.smalllist>div:last-child{border-bottom:0}.ltr{direction:ltr;text-align:left}
.mobileNav{display:none}.subtle{font-size:12px;color:#657389}
@media(max-width:1070px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:780px){.shell{display:block}aside{position:static;height:auto;overflow:visible;padding:11px 12px}.brand{padding:2px 5px 8px;margin:0;border:0}.brand strong{font-size:17px}.brand p,.navgroup,.asideBottom{display:none}.nav{display:flex;overflow:auto;gap:4px}.navbtn{width:auto;white-space:nowrap;font-size:12px;padding:8px 10px}main{padding:14px}.header{align-items:flex-start}h1{font-size:21px}.grid.two,.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:470px){.grid,.grid.two{grid-template-columns:1fr}.panel{padding:13px}.header{flex-direction:column}.row>.field{min-width:100%}}
</style></head><body><div class="shell">
<aside><div class="brand"><strong>SYSTEM1</strong><p>NoonDealsNow · مركز إنتاج ونشر المحتوى</p></div>
<div class="nav" role="tablist" aria-label="أقسام التحكم">
<div class="navgroup">التشغيل والمتابعة</div>
<button type="button" class="navbtn active" data-tab="overview" aria-selected="true" role="tab">نظرة عامة</button>
<button type="button" class="navbtn" data-tab="keywords" aria-selected="false" role="tab">الكلمات المفتاحية</button>
<button type="button" class="navbtn" data-tab="generation" aria-selected="false" role="tab">التوليد والطابور</button>
<button type="button" class="navbtn" data-tab="keys" aria-selected="false" role="tab">Gemini وGroq</button>
<button type="button" class="navbtn" data-tab="quota" aria-selected="false" role="tab">الحصص اليومية</button>
<div class="navgroup">المخزون والنشر</div>
<button type="button" class="navbtn" data-tab="stockpile" aria-selected="false" role="tab">المخزون</button>
<button type="button" class="navbtn" data-tab="publishing" aria-selected="false" role="tab">الجدولة والنشر</button>
<button type="button" class="navbtn" data-tab="quality" aria-selected="false" role="tab">الجودة والتصميمات</button>
<button type="button" class="navbtn" data-tab="articles" aria-selected="false" role="tab">المقالات</button>
<button type="button" class="navbtn" data-tab="diagnostics" aria-selected="false" role="tab">الأخطاء والتحليلات</button>
</div><div class="asideBottom"><a href="/admin/legacy">الإدارة المتقدمة القديمة</a><a href="/blog" target="_blank" rel="noopener">عرض المدونة</a><a href="https://github.com/ramyadamface1-stack/nooncoupons/actions/workflows/noondealsnow-ai-v2.yml" target="_blank" rel="noopener">سجلات GitHub</a></div></aside>
<main><header class="header"><div><h1>SYSTEM1 — مركز التحكم</h1><div class="dim">لوحة واحدة · بيانات إنتاج حقيقية فقط · توقيت القاهرة</div></div><button type="button" class="action secondary" id="refresh">تحديث البيانات</button></header>
<section class="section active" id="view-overview" role="tabpanel">
<h2>نظرة عامة</h2><p class="dim">التوليد والنشر عمليتان منفصلتان؛ نجاح المجدول لا يعني إنتاج مقال أو نشره.</p>
<div class="grid two"><div class="state" id="genState" role="status"><strong>التوليد: جارٍ الفحص</strong><small>يتم التحقق من المجدول وتقارير GitHub</small></div><div class="state" id="pubState" role="status"><strong>النشر: جارٍ الفحص</strong><small>العداد من سجل المقالات المنشورة المؤكدة</small></div></div>
<div class="grid"><div class="stat">نشر مؤكد آخر ساعة<b id="lastHour">—</b><small>R2 verified ledger فقط</small></div><div class="stat">نشر مؤكد آخر 24 ساعة<b id="lastDay">—</b><small>R2 verified ledger فقط</small></div><div class="stat">Gemini مسجل<b id="geminiCount">—</b><small>ليست مفاتيح مؤكد صلاحيتها</small></div><div class="stat">Groq مسجل<b id="groqCount">—</b><small>ليست حصصًا يومية منفصلة</small></div></div>
<div class="grid"><div class="stat">تم توليدها وحفظها خلال 24 ساعة<b id="generatedDay">—</b><small id="generatedDayHint">العدد المستقل غير مقاس بعد</small></div><div class="stat">منشور السعودية خلال 24 ساعة<b id="saPublishedDay">—</b><small>من R2 المؤكد</small></div><div class="stat">منشور الإمارات خلال 24 ساعة<b id="aePublishedDay">—</b><small>من R2 المؤكد</small></div><div class="stat">مخزون READY<b id="readyCount">—</b><small>جرد المقالات الجاهزة الفعلي فقط</small></div></div>
<div class="grid two"><div class="panel"><h3>آخر مقالة منشورة فعلًا</h3><div id="lastArticleSummary" class="smalllist">جارٍ التحميل</div></div><div class="panel"><h3>المقالة التالية ونافذة التشغيل</h3><div id="nextArticleSummary" class="smalllist">جارٍ التحميل</div></div></div>
<div class="panel"><h3>آخر نتيجة فعلية لكل سوق</h3><div id="marketSummary" class="smalllist">جارٍ التحميل</div><p id="lastDataAt" class="subtle"></p></div>
<div class="panel"><h3>الوظائف الأساسية</h3><div class="linkrow"><a href="#generation" data-jump="generation">التحكم في التوليد</a><a href="#keywords" data-jump="keywords">عرض الكلمات الموجودة</a><a href="#keys" data-jump="keys">إدارة المفاتيح</a><a href="#publishing" data-jump="publishing">حالة النشر</a></div></div>
</section>
<section class="section" id="view-keywords" role="tabpanel" hidden>
<h2>الكلمات المفتاحية</h2><p class="dim">فهرس حقيقي لموضوعات طابور GitHub الحالي، مش بيانات حجم بحث مختلقة أو فرص جديدة مؤكدة.</p>
<div class="panel"><div class="row"><div class="field long"><label for="kwSearch">ابحث بالكلمة أو العلامة أو الفئة</label><input id="kwSearch" placeholder="مثال: Samsung أو جوالات"></div><div class="field"><label for="kwMarket">الدولة</label><select id="kwMarket"><option value="ALL">الكل</option><option value="SA">السعودية</option><option value="AE">الإمارات</option></select></div><button class="action secondary" id="kwLoad">بحث</button></div>
<div class="data-note" id="kwNote">الفحص دون استخدام Gemini أو Groq. الأولوية جزئية من 100؛ الطلب الفعلي وفجوة المحتوى «غير مقاسين».</div>
<div class="tablewrap"><table><thead><tr><th>الكلمة / زاوية المقال</th><th>الدولة واللغة</th><th>البراند / التصنيف</th><th>أولوية جزئية</th><th>الحالة</th></tr></thead><tbody id="keywordRows"><tr><td colspan="5">جارٍ القراءة</td></tr></tbody></table></div></div>
<p class="subtle">اعتماد أو تجاهل الكلمات من هذه الشاشة غير مفعل حتى تتصل القرارات بالطابور الدائم؛ لا توجد أزرار شكلية لا تعمل.</p>
</section>
<section class="section" id="view-generation" role="tabpanel" hidden>
<h2>التوليد والطابور</h2><p class="dim">تشغيل GitHub في الخلفية، حتى لو قفلتي المتصفح. الإيقاف اليدوي يحافظ على المهام المحفوظة.</p>
<div class="panel"><h3>التحكم في تشغيل Gemini / Groq</h3><div id="genDetails" class="state">جارٍ القراءة</div>
<div class="row"><button class="action" id="startGeneration">1 — تشغيل / استئناف</button><button class="action secondary" id="runOnce">2 — توليد الآن (GitHub)</button><button class="action danger" id="pauseGeneration">إيقاف مؤقت</button></div>
<p class="subtle">تشغيل محاولة الآن يستخدم رمز GitHub المحفوظ داخل خدمة Cloudflare، ولا يحتاج لصق توكن في المتصفح. يجب أولًا أن يظهر المجدول مفعّلًا. قبول المحاولة لا يعني نشر مقال.</p></div>
<div class="panel"><h3>حالة الطابور</h3><div id="queueDetail" class="smalllist">جارٍ القراءة</div><p class="data-note">وجود آلاف الموضوعات في الملف لا يعني أنها لم تُنجز. لا نعيد توليد مقال مؤكد النشر أو محجوز للفحص.</p></div>
<div class="panel"><h3>مراحل المقالة المطلوبة</h3><p class="subtle">الكلمة → مخطط → كتابة → مراجعة → SEO → 5 تصميمات → روابط → جودة → مخزون READY → موعد النشر. عرض مراحل قديمة مؤكد؛ مخزون READY منفصل غير مثبت حتى تُستكمل البنية.</p></div>
</section>
<section class="section" id="view-keys" role="tabpanel" hidden>
<h2>مفاتيح Gemini وGroq</h2><p class="dim">إضافة مفتاح أو Bulk بطريقة مشفرة داخل GitHub Actions Secrets؛ القيم القديمة لا يمكن استرجاعها من GitHub.</p>
<div class="panel"><div class="row"><button type="button" class="action secondary" id="keysGemini">Gemini</button><button type="button" class="action secondary" id="keysGroq">Groq</button><button type="button" class="action secondary" id="viewGithubSecrets">عرض خانات GitHub</button></div><h3 id="keysTitle">Gemini</h3><div id="keyRows" class="smalllist"></div></div>
<div class="panel"><h3>إضافة آمنة</h3><div class="row"><div class="field"><label for="keyProvider">المزود</label><select id="keyProvider"><option value="gemini">Gemini</option><option value="groq">Groq</option></select></div><div class="field long"><label for="githubToken">رمز GitHub بصلاحية Secrets وActions</label><input id="githubToken" type="password" autocomplete="off" spellcheck="false" placeholder="لا يُحفظ في المتصفح"></div></div>
<label for="keyBulk">مفتاح واحد أو مفاتيح في أسطر منفصلة</label><textarea id="keyBulk" autocomplete="off" spellcheck="false" placeholder="مفتاح واحد لكل سطر"></textarea>
<div class="row"><div class="field"><label for="keyFile">ملف TXT / CSV / JSON بحد أقصى 22KB</label><input id="keyFile" type="file" accept=".txt,.csv,.json,text/plain,application/json"></div><button class="action" id="saveKeys">حفظ مشفر على GitHub</button><button class="action secondary" id="clearKeys">مسح المدخلات الحساسة</button></div>
<p class="subtle">الحفظ وحده لا يثبت صلاحية المفتاح أو حصته؛ اختبار اتصال فعلي بكل مفتاح غير مفعل قبل موافقة مستقلة على استهلاك طلبات API.</p></div>
</section>
<section class="section" id="view-quota" role="tabpanel" hidden>
<h2>الحصص اليومية</h2><div class="grid two"><div class="panel"><h3>Gemini</h3><div id="geminiQuota">جارٍ التحميل</div></div><div class="panel"><h3>Groq</h3><div id="groqQuota">جارٍ التحميل</div></div></div>
<div class="data-note">«غير محظور» لا يعني «متاح مؤكد». حدود RPM/RPD/TPM والحصص المشتركة لا نعرضها كأرقام ما لم يرجع بها المزود؛ السجلات المحفوظة هي المصدر المتاح حاليًا.</div></section>
<section class="section" id="view-stockpile" role="tabpanel" hidden>
<h2>المخزون الاحتياطي</h2><div id="stockState" class="state">جارٍ الفحص</div>
<div class="panel"><h3>مقالات READY / SCHEDULED</h3><p>يجب قياس المخزون المنفصل من R2 قبل عرض رقم أو السماح بتغيير هدف التخزين.</p><p id="stockEvidence" class="data-note">غير مقاس</p></div>
<p class="subtle">هذه المرحلة غير مفعّلة بالكامل في النظام القديم. نشر READY المستحق أثناء توقف التوليد يتطلب مشغلًا ومخزونًا حقيقيين، وليس زرًا شكليًا.</p></section>
<section class="section" id="view-publishing" role="tabpanel" hidden>
<h2>الجدولة والنشر</h2><p class="data-note">التوقيت القابل للتغيير الآن هو فاصل إرسال مهمة التوليد إلى GitHub، وليس فاصل نشر المقالات. موعد المقال التالي لا يتأكد قبل أن تصبح المقالة جاهزة ومجدولة في مخزون مستقل.</p><div class="grid two"><div class="panel"><h3>1 — فاصل تشغيل التوليد</h3><p class="subtle">يتحكم في إرسال مهمة GitHub، وليس فاصل نشر المقالات.</p><div class="field"><label for="genInterval">كل</label><select id="genInterval"><option value="1">1 دقيقة</option><option value="5">5 دقائق</option><option value="10">10 دقائق</option><option value="15">15 دقيقة</option><option value="30">30 دقيقة</option><option value="60">60 دقيقة</option></select></div><button class="action" id="saveInterval">حفظ فاصل التوليد</button></div>
<div class="panel"><h3>2 — فاصل نشر المقالات</h3><div class="state warn"><strong>غير مرتبط بمخزون مستقل حتى الآن</strong><small>لن نعرض زر حفظ مضللًا. بيانات النشر المؤكد في النظرة العامة.</small></div><p class="subtle">عند إضافة READY/SCHEDULED المستدام سنربط هذه الخانة بموعد scheduled_at الحقيقي.</p></div></div>
<div class="panel"><h3>آخر نشر مؤكد</h3><div id="lastPublished">غير متاح</div><p id="nextGenerationSchedule" class="data-note">نافذة التوليد التالية: غير متاحة</p><p id="nextPublishingSchedule" class="data-note">موعد المقال التالي: لم يُجدول بعد</p><p>المقالات المنشورة بالفعل لا تُحذف أو تُعاد جدولة روابطها بهذه الشاشة.</p></div></section>
<section class="section" id="view-quality" role="tabpanel" hidden>
<h2>الجودة والتصميمات</h2><div class="panel"><h3>QUALITY GATE المطلوب</h3><p>Search Intent 15 · الأصالة والفائدة 20 · الدقة 15 · SEO/Schema 15 · الصور 15 · UX 10 · الروابط والأداء 10. الحد العام 90/100 مع الشروط الإلزامية المنفصلة.</p><div class="data-note">المولد الحالي يطبق بوابات جودة قائمة؛ لم يتم بعد توحيدها مع مقياس SYSTEM1 الجديد أو التحقق بصريًا من خمسة ملفات 1600×1000 لكل مقال. لا نعرض PASS دون دليل.</div></div>
<div class="panel"><h3>خمسة تصميمات لكل مقالة</h3><p>Featured · Product · Geometric · Lifestyle · Minimal. يجب إثبات أن الملفات الخمسة مختلفة وقابلة للعرض ومخزنة في R2 مع Alt Text.</p><div id="visualState" class="state">التحقق قيد الإعداد، لا يعني نجاح الصور.</div></div></section>
<section class="section" id="view-articles" role="tabpanel" hidden>
<h2>المقالات</h2><div class="panel"><h3>مقالات منشورة وروابطها</h3><p>مراجعة المقالات الفعلية موجودة في المدونة والإدارة المتقدمة. لا نغيّر محتوى أو روابط المقالات الحالية.</p><div class="linkrow"><a href="/blog" target="_blank" rel="noopener">المدونة العامة</a><a href="/admin/legacy#articlesPanel">جدول وإدارة المقالات</a><a href="/blog/archive/all" target="_blank" rel="noopener">الأرشيف الكامل</a></div></div></section>
<section class="section" id="view-diagnostics" role="tabpanel" hidden>
<h2>الأخطاء والتحليلات</h2><div class="panel"><h3>تشخيص بدون كشف مفاتيح</h3><p id="diagState" class="data-note">جارٍ التحديث</p><details><summary>البيانات الفنية المنقّحة</summary><pre id="diagJson" dir="ltr" style="overflow:auto;max-height:350px;white-space:pre-wrap;font-size:11px;background:#f6f8fa;padding:12px;border-radius:10px"></pre></details></div>
<div class="panel"><h3>تقارير ومصادر خارجية موثوقة</h3><div class="linkrow"><a href="/admin/legacy#seoDropsPanel">GSC Drops</a><a href="/admin/legacy#conversionEventsPanel">Conversions</a><a href="https://github.com/ramyadamface1-stack/nooncoupons/actions/workflows/noondealsnow-ai-v2.yml" target="_blank" rel="noopener">سجلات التوليد</a></div></div></section>
</main></div><div id="message" role="status" aria-live="polite" hidden></div>
<script>
(function(){
"use strict";
const $=id=>document.getElementById(id);
let snapshot=null,keywords=null,shownProvider="gemini",gh=null;
const tabs=[...document.querySelectorAll('[data-tab]')];
function show(tab){if(!$('view-'+tab))tab='overview';for(const n of tabs){const active=n.dataset.tab===tab;n.classList.toggle('active',active);n.setAttribute('aria-selected',active?'true':'false');}
for(const node of document.querySelectorAll('.section')){const active=node.id==='view-'+tab;node.classList.toggle('active',active);node.hidden=!active;}
history.replaceState(null,'','#'+tab);if(tab==='keywords'&&!keywords)loadKeywords();}
function note(message){const el=$('message');el.textContent=message;el.hidden=false;window.clearTimeout(note.t);note.t=window.setTimeout(()=>{el.hidden=true},6500)}
function fmt(x){return x===null||x===undefined?'غير متاح':String(x)}
function local(x){const d=Date.parse(x||'');return Number.isFinite(d)?new Date(d).toLocaleString('ar-EG',{timeZone:'Africa/Cairo'}):'غير متاح'}
function item(parent,strong,detail){const div=document.createElement('div'),b=document.createElement('b'),p=document.createElement('div');b.textContent=strong;p.textContent=detail;p.className='subtle';div.append(b,p);parent.append(div)}
function setState(id,title,detail,tone){const el=$(id);el.className='state '+(tone||'');el.replaceChildren();item(el,title,detail)}
async function api(path,opts){const response=await fetch(path,Object.assign({credentials:'same-origin',cache:'no-store'},opts||{}));if(response.status===401){location.href='/admin';throw Error('AUTH_REQUIRED')}let json;try{json=await response.json()}catch{throw Error('INVALID_SERVER_RESPONSE')}if(!response.ok||json.ok===false)throw Error(json.error||('HTTP_'+response.status));return json}
const statusNames={PAUSED_MANUALLY:'متوقف يدويًا',PAUSED_QUOTA_EXHAUSTED:'انتظار تجدد الكوتة',WAITING_ELIGIBLE_TOPIC:'المجدول يعمل، لا توجد مهمة مؤهلة في آخر فحص',WAITING_TELEMETRY:'المجدول يعمل، لم يصل تقرير حديث',SCHEDULER_ACTIVE_UNVERIFIED:'المجدول مفعّل، لا يوجد توليد مؤكد',ERROR:'تعذر التحقق من المجدول',DISABLED:'المجدول غير مفعّل فعليًا على Cloudflare',UNKNOWN:'الحالة غير معروفة'};
const publishNames={RECENT_VERIFIED:'تم تأكيد نشر خلال آخر ساعة',NO_VERIFIED_PUBLICATION_LAST_HOUR:'لا يوجد نشر مؤكد آخر ساعة',UNVERIFIED:'حالة النشر غير متاحة'};
function statusTone(s){return s==='PAUSED_MANUALLY'||s==='DISABLED'?'stop':s==='RECENT_VERIFIED'?'ok':'warn'}
function metric(id,value){$(id).textContent=fmt(value)}
function renderLastArticle(article){
 const el=$('lastArticleSummary');el.replaceChildren();
 const slug=String(article?.slug||'');
 if(!/^[a-z0-9-]{16,120}$/.test(slug)){item(el,'غير متاح','لم يصلنا سجل نشر برابط مؤكد');return}
 const div=document.createElement('div'),link=document.createElement('a'),detail=document.createElement('div');
 link.href='/articles/'+encodeURIComponent(slug);link.target='_blank';link.rel='noopener';link.textContent=slug;
 detail.className='subtle';detail.textContent=(article.country==='SA'?'السعودية':article.country==='AE'?'الإمارات':'غير معروف')+' · '+local(article.publishedAt);
 div.append(link,detail);el.append(div);
}
function update(){
const s=snapshot;if(!s)return;const g=s.generation||{},p=s.publishing||{},v=p.verified||{};
setState('genState','التوليد — '+(statusNames[g.status]||g.status||'غير معروف'),
 'آخر تقرير: '+local(g.lastReportAt)+' | تشغيل كل '+fmt(g.actualScheduler?.intervalMinutes||g.dispatchIntervalMinutes)+' دقيقة',statusTone(g.status));
setState('pubState','النشر — '+(publishNames[p.status]||p.status||'غير معروف'),
 v.ledgerAvailable?'آخر تحديث عدادات: '+local(v.generatedAt):'بيانات سجل المنشورات غير متاحة',statusTone(p.status));
metric('lastHour',v.lastHour?.total);metric('lastDay',v.last24Hours?.total);
 metric('generatedDay',g.draftsGeneratedLast24Hours);$('generatedDayHint').textContent=Number.isSafeInteger(g.draftsGeneratedLast24Hours)?'مسودات محفوظة مؤكدة':'العدد غير مقاس بعد، وليس صفرًا';
 metric('saPublishedDay',p.verifiedMarketTotals?.SA);metric('aePublishedDay',p.verifiedMarketTotals?.AE);
 metric('readyCount',s.stockpile?.available===true&&Number.isSafeInteger(s.stockpile.readyCount)?s.stockpile.readyCount:null);
 renderLastArticle(v.lastArticle);
 const next=$('nextArticleSummary');next.replaceChildren();
 item(next,p.nextArticleScheduledAt?'مقال مجدول: '+local(p.nextArticleScheduledAt):'المقالة القادمة: موعد النشر غير محدد',
  p.nextArticleScheduledAt?'يستلزم اجتياز فحوص النشر النهائية':'لا يوجد ناشر READY مستقل مؤكد؛ تشغيل المولد لا يضمن نزول مقال');
 item(next,g.nextGenerationCheckAt?'نافذة تشغيل المولد القادمة: '+local(g.nextGenerationCheckAt):'نافذة تشغيل المولد غير متاحة',
  g.nextGenerationCheckAt?'توقيت حسابي متوقع للفحص، وليس ضمان تشغيل GitHub':'تتطلب مجدولًا نشطًا ومعتمدًا');
for(const provider of ['gemini','groq'])metric(provider+'Count',s.providers?.[provider]?.total);
const market=$('marketSummary');market.replaceChildren();
for(const m of g.marketReports||[]){const reason=m.lastOutcome?.reason||'NO_RECENT_REPORT';
 const label=reason==='QUEUE_WINDOW_EMPTY'?'لا توجد مهمة مؤهلة في آخر تشغيل':m.lastOutcome?.status==='LIVE_VERIFIED'?'مقال نشره النظام وتحقق منه':reason;
 item(market,m.market==='SA'?'السعودية · '+label:'الإمارات · '+label,'آخر تقرير: '+local(m.generatedAt));}
$('lastDataAt').textContent='آخر فحص: '+local(s.checkedAt);
$('genDetails').textContent=statusNames[g.status]||g.status||'غير متاح';
$('genInterval').value=String(g.dispatchIntervalMinutes||1);
const queue=$('queueDetail');queue.replaceChildren();
for(const m of g.marketReports||[])item(queue,m.market==='SA'?'السعودية':'الإمارات',fmt(m.lastOutcome?.status)+' · '+fmt(m.lastOutcome?.reason)+' · '+local(m.generatedAt));
setState('stockState',s.stockpile?.available?'تقرير المخزون موجود':'المخزون READY غير مقاس بعد',
 s.stockpile?.available?'آخر تحديث: '+local(s.stockpile.generatedAt):'لا يمكن حساب READY وSCHEDULED أو أيام التغطية بدون جرد حقيقي','warn');
$('stockEvidence').textContent=s.stockpile?.available?JSON.stringify(s.stockpile):'لم يصل تقرير مؤكد لمخزون المقالات الجاهزة';
setState('visualState',s.visualQuality?.scope==='single_canary_only'?
 'خمسة تصميمات محفوظة لمقال تجريبي واحد فقط':
 s.visualQuality?.available?'تقرير تصميمات محدود':'الصور الخمس غير مثبتة لكل المقالات',
 s.visualQuality?.available?'الأصول المؤكدة: '+fmt(s.visualQuality.verifiedAssets)+
 ' · المقالات التجريبية: '+fmt(s.visualQuality.verifiedArticles)+
 ' · آخر فحص: '+local(s.visualQuality.generatedAt)+
 ' · المراجعة البصرية البشرية: '+(s.visualQuality.visualHumanReviewed?'مكتملة':'لم تتم'):
 'لا يوجد تدقيق مؤكد لخمسة تصميمات مختلفة محفوظة لكل مقال','warn');
$('lastPublished').textContent=v.lastArticle?'آخر مقال: '+fmt(v.lastArticle.slug)+' | '+local(v.lastArticle.publishedAt):'غير متاح';
 $('nextGenerationSchedule').textContent=g.nextGenerationCheckAt?'نافذة فحص التوليد القادمة (تقديرية): '+local(g.nextGenerationCheckAt):'نافذة فحص التوليد غير متاحة';
 $('nextPublishingSchedule').textContent=p.nextArticleScheduledAt?'موعد المقال التالي المجدول: '+local(p.nextArticleScheduledAt):'موعد نشر المقال القادم غير محدد حتى تفعيل مخزون READY المجدول';
$('diagState').textContent=s.warnings?.length?s.warnings.join(' · '):'لا توجد أخطاء مسجلة في هذه اللقطة، لكن ذلك لا يثبت اكتمال كل مراحل SYSTEM1';
$('diagJson').textContent=JSON.stringify({checkedAt:s.checkedAt,generation:s.generation,publishing:s.publishing,capabilities:s.capabilities,warnings:s.warnings},null,2);
for(const provider of ['gemini','groq']){
const count=s.providers?.[provider]?.counts;
$(provider+'Quota').textContent=count?'إجمالي محمل: '+fmt(s.providers?.[provider]?.total)+' | غير محظور وغير مختبر: '+fmt(count.eligibleUnverified)+' | انتظار حصة: '+fmt(count.quotaWait)+' | انتظار مزود: '+fmt(count.providerWait)+' | غير محسوم: '+fmt((count.unverified||0)+(count.notInspected||0)):'لا توجد بيانات حصص مؤكدة من المزود';
}
renderKeys();
}
async function load(){try{snapshot=await api('/api/admin/system1/summary');update()}catch(e){setState('genState','المراقبة غير متاحة',e.message,'warn');setState('pubState','النشر غير متاح','الرقم مجهول، وليس صفرًا','warn');note('تعذر قراءة بيانات الإنتاج: '+e.message)}}
async function loadKeywords(){const rows=$('keywordRows');rows.replaceChildren();try{
 const params=new URLSearchParams({market:$('kwMarket').value,q:$('kwSearch').value.slice(0,120),limit:'100'});
 keywords=await api('/api/admin/system1/keywords?'+params.toString());
 if(!keywords.available){const tr=rows.insertRow(),td=tr.insertCell();td.colSpan=5;td.textContent='الفهرس غير متاح: '+fmt(keywords.reason);$('kwNote').textContent='فهرس الكلمات لم يُبنَ بعد أو تعذر قراءته';return}
 $('kwNote').textContent='مصدر GitHub · إجمالي العناوين المجمعة '+fmt(keywords.total)+' · النتائج المطابقة '+fmt(keywords.matched)+' · هذه الموضوعات موجودة بالفعل في طابور المصدر، وحالة إنجاز كل موضوع غير مقاسة';
 for(const entry of keywords.items){const tr=rows.insertRow();for(const text of [
  entry.keyword,entry.country+' · '+entry.language,
  [entry.brand,entry.category].filter(Boolean).join(' / '),
  entry.priority+'/100 (جزئي)', 'في الطابور الأصلي · التنفيذ غير مفحوص'
 ])tr.insertCell().textContent=fmt(text)}
 if(!keywords.items.length){const tr=rows.insertRow(),td=tr.insertCell();td.colSpan=5;td.textContent='لا توجد نتائج مطابقة'}
}catch(e){const tr=rows.insertRow(),td=tr.insertCell();td.colSpan=5;td.textContent='تعذر عرض الكلمات: '+e.message}}
function renderKeys(){const el=$('keyRows');el.replaceChildren();$('keysTitle').textContent=shownProvider==='gemini'?'Gemini':'Groq';
const provider=snapshot?.providers?.[shownProvider];const entries=provider?.entries||[];
const group=gh?.groups?.[shownProvider]||[];
if(group.length){for(const slot of group){const x=entries.filter(y=>y.source===slot.name);
 item(el,slot.name+' · '+(slot.configured?'محفوظ في GitHub':'غير موجود'),
 x.length?x.map(y=>'#'+y.id+' ('+y.status+')').join(' · '):'لا يمكن استرجاع قيمة Secret أو معرفة عدد مفاتيحه من GitHub');}}
else if(entries.length){for(const x of entries)item(el,x.source+' · #'+x.id,'حالة السجل: '+x.status+(x.resumeAt?' · إعادة محاولة: '+local(x.resumeAt):''));}
else item(el,'لا توجد بيانات مفصلة للمفاتيح','لعرض أسماء GitHub Secrets يلزم رمز بصلاحية Secrets Read، ولا يتم حفظه على المتصفح');}
async function post(path,value){return api(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(value)})}
async function setControl(patch){try{const value=await post('/api/admin/ai-v2-control',patch);note('حُفظ الطلب بنجاح. التحقق من حالة المجدول الفعلية بعد التحديث.');await load();return value}catch(e){note('تعذر تغيير إعداد التوليد: '+e.message);return null}}
async function runNow(){
 const g=snapshot?.generation||{};
 if(g.desiredEnabled===false){note('ابدئي بالضغط على تشغيل / استئناف، ثم تحديث البيانات للتأكد أن المجدول مفعل.');return}
 if(g.actualScheduler?.enabled===false){note('المجدول متوقف فعليًا. اضغطي تشغيل / استئناف أولًا ثم حدّثي الحالة. لو ظل متوقفًا يحتاج تفعيل Cloudflare.');return}
 if(!confirm('طلب محاولة توليد فعلية عبر GitHub. قد تستهلك حصة Gemini/Groq عندما توجد مهمة جديدة. هل تريدين المتابعة؟'))return;
 const btn=$('runOnce');btn.disabled=true;
 try{
   const result=await post('/api/admin/ai-v2-run-now',{});
   note(result.dispatched?'تم قبول محاولة التوليد في GitHub. ده لا يعني نشر مقالة؛ تابعي السجل وعداد النشر المؤكد.':'لم تُرسل محاولة جديدة');
   await load();
 }catch(e){
   const messages={
    generation_already_running:'يوجد تشغيل توليد جارٍ بالفعل. انتظري نتيجة نفس التشغيل بدل محاولة مكررة.',
    scheduler_paused:'التوليد متوقف يدويًا. اضغطي تشغيل / استئناف أولًا.',
    scheduler_not_verified:'المجدول غير مفعّل أو لم تُتحقق سياسة تشغيله على Cloudflare.',
    dispatch_secret_missing:'رمز إرسال GitHub غير موجود في أسرار مجدول Cloudflare؛ يجب إعادة ربطه بشكل آمن.',
    internal_dispatch_not_configured:'الاتصال الداخلي بالمجدول غير جاهز بعد. راجعي آخر نشر Cloudflare.',
    github_token_expired:'رمز GitHub المحفوظ في Cloudflare انتهت صلاحيته؛ يجب تجديده.',
    github_token_permissions:'رمز GitHub المحفوظ لا يملك صلاحية Actions المطلوبة.'
   };
   note(messages[e.message]||'تعذر إرسال المحاولة: '+e.message);
 }finally{btn.disabled=false}
}
async function githubSecrets(){try{gh=await post('/api/admin/ai-v2-keys',{githubToken:$('githubToken').value});renderKeys();note('عرض أسماء الخانات فقط؛ قيم المفاتيح مشفرة وغير قابلة للقراءة')}catch(e){note('تعذر قراءة خانات GitHub: '+e.message)}}
async function importKeys(){const text=$('keyBulk').value.trim();if(!text){note('الصقي المفاتيح أو ارفعي ملفًا أولًا');return}
 if(!confirm('سيتم تشفير وحفظ المفاتيح في خانة GitHub Secret جديدة دون الكتابة فوق القديمة. متابعة؟'))return;
 try{const res=await post('/api/admin/ai-v2-key-import',{provider:$('keyProvider').value,keys:text,githubToken:$('githubToken').value});
 $('keyBulk').value='';$('keyFile').value='';note('حُفظ '+res.addedCount+' مفتاح في '+res.secretName+'. هذا لا يثبت صلاحية الحصص.');
 await githubSecrets()}catch(e){note('تعذر حفظ المفاتيح: '+e.message)}}
for(const tab of tabs)tab.onclick=()=>show(tab.dataset.tab);
for(const link of document.querySelectorAll('[data-jump]'))link.onclick=e=>{e.preventDefault();show(link.dataset.jump)};
$('refresh').onclick=load;$('kwLoad').onclick=loadKeywords;
// Refresh the bounded overview every two minutes only while this page is visible.
window.setInterval(()=>{if(!document.hidden)load()},120000);
$('kwSearch').onkeydown=e=>{if(e.key==='Enter')loadKeywords()};
$('startGeneration').onclick=()=>setControl({enabled:true});
$('pauseGeneration').onclick=()=>setControl({enabled:false});
$('saveInterval').onclick=()=>setControl({intervalMinutes:Number($('genInterval').value)});
$('runOnce').onclick=runNow;
$('keysGemini').onclick=()=>{shownProvider='gemini';$('keyProvider').value='gemini';renderKeys()};
$('keysGroq').onclick=()=>{shownProvider='groq';$('keyProvider').value='groq';renderKeys()};
$('viewGithubSecrets').onclick=githubSecrets;
$('saveKeys').onclick=importKeys;
$('clearKeys').onclick=()=>{$('githubToken').value='';$('keyBulk').value='';$('keyFile').value='';gh=null;renderKeys();note('اتمسحت البيانات الحساسة من الحقول')};
$('keyFile').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;if(file.size>22000){note('الملف أكبر من 22KB');return}try{$('keyBulk').value=await file.text();note('تم تحميل الملف في النموذج، ولم يُرفع إلى GitHub بعد')}catch{note('تعذر قراءة الملف')}};
const initial=(location.hash||'').slice(1);
show(initial==='aiV2Panel'?'generation':initial);
load();
})();
</script></body></html>`;

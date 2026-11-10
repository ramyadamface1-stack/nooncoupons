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

/* Read-only operator ribbon: colors describe evidence, never invented progress. */
.live-strip{background:#fff;border:1px solid #d9e2ee;border-radius:15px;padding:16px 18px;margin:0 0 21px;box-shadow:0 3px 14px #11182705}
.live-strip-top{display:flex;align-items:start;justify-content:space-between;gap:14px;flex-wrap:wrap}
.live-kicker{color:#516579;font-size:12px;font-weight:700}
.live-heading{display:flex;align-items:center;gap:10px;margin-top:4px;font-size:19px;color:#152c48}
.live-dot{width:11px;height:11px;flex:none;border-radius:100%;background:#94a3b8}
.live-strip[data-tone="ok"] .live-dot{background:#1b8061}.live-strip[data-tone="stop"] .live-dot{background:#b44343}
.live-strip[data-tone="warn"] .live-dot{background:#bc8d29}
.live-reason{font-size:13px;color:#465870;margin-top:5px;max-width:850px}
.live-stamp{font-size:11px;color:#52647b;border:1px solid #dce5f0;border-radius:8px;padding:5px 9px;background:#f8fafc}
.live-steps{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin:17px 0 13px}
.live-step{min-width:0;border:1px solid #e0e7ef;border-bottom:4px solid #9baabd;border-radius:10px;padding:10px 12px;background:#f9fbfd}
.live-step[data-tone="ok"]{border-bottom-color:#1b8061}.live-step[data-tone="warn"]{border-bottom-color:#bc8d29}.live-step[data-tone="stop"]{border-bottom-color:#b44343}
.live-step-label{font-size:12px;color:#51627a;font-weight:700}.live-step-value{font-size:13px;font-weight:800;color:#263950;margin-top:3px;overflow-wrap:anywhere}
.live-facts{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}
.live-fact{border-top:1px solid #e8edf4;padding:10px 1px 1px;min-width:0}
.live-fact-label{font-size:11px;color:#607186}.live-fact-value{font-size:13px;font-weight:800;color:#243950;overflow-wrap:anywhere;display:block}
.live-attempt{margin-top:12px;padding:9px 11px;border:1px solid #dde6f0;border-radius:9px;background:#f8fafc;color:#36506a;font-size:12px}
.live-footnote{margin:9px 0 0;color:#67768a;font-size:11px}
.daily-pulse{margin:15px 0 10px;border:1px solid #dce5ee;border-radius:12px;padding:14px;background:#fbfdff}
.daily-pulse h3{margin:0 0 4px;font-size:16px;color:#172f4c}
.daily-status{font-size:13px;color:#465a70;line-height:1.7;margin:4px 0 12px}
.daily-pulse[data-tone="stop"] .daily-status{color:#ab3131;font-weight:700}
.daily-pulse[data-tone="warn"] .daily-status{color:#8a5b00;font-weight:700}
.daily-pulse[data-tone="ok"] .daily-status{color:#136b51;font-weight:700}
.daily-numbers{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin:8px 0 10px}
.daily-num{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:10px;min-width:0}
.daily-num-label{font-size:11px;color:#607286}.daily-num-value{font-size:21px;font-weight:800;color:#142e4c;font-variant-numeric:tabular-nums}
.daily-track{background:#e6edf5;height:15px;border-radius:10px;overflow:hidden}
.daily-fill{height:100%;background:#1e8060;min-width:0;max-width:100%;width:0%;transition:width .35s}
.daily-pulse[data-tone="warn"] .daily-fill{background:#ad842c}
.daily-pulse[data-tone="stop"] .daily-fill{background:#bc4b4b}
.daily-caption{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;color:#536981;font-size:12px;margin-top:6px}
.daily-actions{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-top:13px}
@media(max-width:800px){.daily-numbers{grid-template-columns:repeat(2,minmax(0,1fr))}}

@media(max-width:1070px){.live-steps,.live-facts{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:470px){.live-strip{padding:13px}.live-heading{font-size:16px}.live-step{padding:9px}.live-steps,.live-facts{gap:7px}}
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
<div class="live-strip" id="liveStrip" data-tone="unknown" role="region" aria-label="شريط متابعة التوليد والنشر">
 <div class="live-strip-top"><div>
  <div class="live-kicker">حالة التشغيل والنشر — بيانات حقيقية</div>
  <div class="live-heading"><span class="live-dot" aria-hidden="true"></span><strong id="liveHeadline" role="status" aria-live="polite">جارٍ التحقق من حالة النظام…</strong></div>
  <div class="live-reason" id="liveReason">سيتم التحقق من المجدول وتقارير المقالات المنشورة، بدون افتراض أن الضغط على زر التشغيل أنجز نشرًا.</div>
 </div><span class="live-stamp" id="liveCheckedAt">آخر فحص: جارٍ التحميل</span></div>
 <div class="live-steps" aria-label="مؤشرات مستقلة لحالة المراحل">
  <div class="live-step" id="liveStageScheduler" data-tone="unknown"><div class="live-step-label">1 — مجدول Cloudflare</div><div class="live-step-value">جارٍ الفحص</div></div>
  <div class="live-step" id="liveStageGeneration" data-tone="unknown"><div class="live-step-label">2 — آخر تقرير توليد</div><div class="live-step-value">جارٍ الفحص</div></div>
  <div class="live-step" id="liveStageReady" data-tone="unknown"><div class="live-step-label">3 — المخزون الجاهز READY</div><div class="live-step-value">جارٍ الفحص</div></div>
  <div class="live-step" id="liveStagePublishing" data-tone="unknown"><div class="live-step-label">4 — النشر المؤكد</div><div class="live-step-value">جارٍ الفحص</div></div>
 </div>
 <div class="daily-pulse" id="dailyPulse" data-tone="unknown" role="region" aria-label="هدف النشر اليومي وحالة النشر">
  <h3>هدف النشر اليوم — بتوقيت القاهرة</h3>
  <p class="daily-status" id="dailyGoalStatus" role="status" aria-live="polite">جارٍ التحقق من منشورات اليوم والهدف المطلوب…</p>
  <div class="daily-numbers">
    <div class="daily-num"><div class="daily-num-label">المستهدف اليوم</div><div class="daily-num-value" id="dailyGoalTarget">1,440</div></div>
    <div class="daily-num"><div class="daily-num-label">اتنشر فعلًا اليوم</div><div class="daily-num-value" id="dailyGoalPublished">—</div></div>
    <div class="daily-num"><div class="daily-num-label">المتبقي من الهدف</div><div class="daily-num-value" id="dailyGoalRemaining">—</div></div>
    <div class="daily-num"><div class="daily-num-label">المنشور آخر ساعة / الهدف</div><div class="daily-num-value" id="dailyGoalHour">— / 60</div></div>
  </div>
  <div class="daily-track" role="progressbar" id="dailyProgress" aria-label="نسبة إنجاز هدف اليوم" aria-valuemin="0" aria-valuemax="100" aria-valuetext="القياس لم يكتمل"><div class="daily-fill" id="dailyProgressFill"></div></div>
  <div class="daily-caption"><span id="dailyProgressLabel">النسبة غير متاحة حتى وصول جرد اليوم</span><span id="dailyGoalUpdated">آخر جرد: غير متاح</span></div>
  <div class="daily-actions"><button class="action" type="button" id="startNowFromRibbon">تشغيل التوليد والنشر تلقائيًا الآن</button><span class="subtle">يستخدم طابور الكلمات المفتاحية المؤهلة الحالي؛ لا يعيد نشر المقالات السابقة.</span></div>
  <p class="live-footnote">الأرقام من سجل المقالات المنشورة الموثّقة في R2، ويُحدّث الجرد تقريبًا كل 15 دقيقة. الهدف ليس ضمانًا لنشر مقالة عند كل دقيقة؛ تُحسب فقط المقالات التي تم نشرها فعليًا.</p>
 </div>
 <div class="live-facts">
  <div class="live-fact"><span class="live-fact-label">آخر مقالة منشورة مؤكدًا</span><strong class="live-fact-value" id="liveLastPublished">غير متاح</strong></div>
  <div class="live-fact"><span class="live-fact-label">نافذة النشر المستهدفة التالية</span><strong class="live-fact-value" id="liveNextPublish">غير محدد</strong></div>
  <div class="live-fact"><span class="live-fact-label">المخزون الجاهز</span><strong class="live-fact-value" id="liveReadyCount">غير مقاس</strong></div>
  <div class="live-fact"><span class="live-fact-label">آخر مشكلة أو سبب انتظار</span><strong class="live-fact-value" id="liveIssue">جارٍ الفحص</strong></div>
 </div>
 <div class="live-attempt" id="liveAttempt">آخر طلب «توليد الآن» من هذه الصفحة: لم يتم إرسال طلب في الجلسة الحالية.</div>
 <p class="live-footnote">الشريط يوضح حالات مستقلة وليس نسبة تقدّم. قبول طلب التوليد لا يؤكد إنتاج مقال، وموعد فحص المولد لا يساوي موعد نشر المقالة.</p>
</div>
<section class="section active" id="view-overview" role="tabpanel">
<h2>نظرة عامة</h2><p class="dim">التوليد والنشر عمليتان منفصلتان؛ نجاح المجدول لا يعني إنتاج مقال أو نشره.</p>
<div class="grid two"><div class="state" id="genState" role="status"><strong>التوليد: جارٍ الفحص</strong><small>يتم التحقق من المجدول وتقارير GitHub</small></div><div class="state" id="pubState" role="status"><strong>النشر: جارٍ الفحص</strong><small>العداد من سجل المقالات المنشورة المؤكدة</small></div></div>
<div class="grid"><div class="stat">نشر مؤكد آخر ساعة<b id="lastHour">—</b><small>R2 verified ledger فقط</small></div><div class="stat">نشر مؤكد آخر 24 ساعة<b id="lastDay">—</b><small>R2 verified ledger فقط</small></div><div class="stat">Gemini مسجل<b id="geminiCount">—</b><small>ليست مفاتيح مؤكد صلاحيتها</small></div><div class="stat">Groq مسجل<b id="groqCount">—</b><small>ليست حصصًا يومية منفصلة</small></div></div>
<div class="grid"><div class="stat">تم توليدها وحفظها خلال 24 ساعة<b id="generatedDay">—</b><small id="generatedDayHint">العدد المستقل غير مقاس بعد</small></div><div class="stat">منشور السعودية خلال 24 ساعة<b id="saPublishedDay">—</b><small>من R2 المؤكد</small></div><div class="stat">منشور الإمارات خلال 24 ساعة<b id="aePublishedDay">—</b><small>من R2 المؤكد</small></div><div class="stat">مخزون READY<b id="readyCount">—</b><small>جرد المقالات الجاهزة الفعلي فقط</small></div></div>
<div class="grid two"><div class="panel"><h3>آخر مقالة منشورة فعلًا</h3><div id="lastArticleSummary" class="smalllist">جارٍ التحميل</div></div><div class="panel"><h3>موعد النشر المستهدف ونافذة التشغيل</h3><div id="nextArticleSummary" class="smalllist">جارٍ التحميل</div></div></div>
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
<h2>التوليد والطابور</h2><p class="dim">ابدئي التوليد من الموقع نفسه دون فتح GitHub. خدمة الخلفية تتابع الطلب حتى لو قفلتي المتصفح. الإيقاف اليدوي يحافظ على المهام المحفوظة.</p>
<div class="panel"><h3>التحكم في تشغيل Gemini / Groq</h3><div id="genDetails" class="state">جارٍ القراءة</div>
<div class="row"><button class="action" id="startGeneration">تشغيل تلقائي الآن</button><button class="action secondary" id="runOnce">2 — توليد الآن من الموقع</button><button class="action danger" id="pauseGeneration">إيقاف مؤقت</button></div>
<p class="subtle">زر التوليد يتصل مباشرة بالخدمة الداخلية الآمنة على Cloudflare دون مطالبتك برمز GitHub. تنفيذ المولد يجري في الخلفية. قبول الطلب لا يعني توليد مقال أو نشره؛ تحققي من النتائج والعدادات.</p></div>
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
<h2>الجدولة والنشر</h2><p class="data-note">يمكنكِ اختيار فاصل نشر مقالات AI V2 من دقيقة حتى 15 دقيقة مستقلاً عن فاصل تشغيل المولد. يتم حفظ الاختيار في Cloudflare وتطبيقه على بوابة النشر الفعلية؛ لا يمكن ضمان نزول مقال في كل نافذة دون مقالة مؤهلة.</p><div class="grid two"><div class="panel"><h3>1 — فاصل تشغيل التوليد</h3><p class="subtle">يتحكم في إرسال مهمة GitHub، وليس فاصل نشر المقالات.</p><div class="field"><label for="genInterval">كل</label><select id="genInterval"><option value="1">1 دقيقة</option><option value="5">5 دقائق</option><option value="10">10 دقائق</option><option value="15">15 دقيقة</option><option value="30">30 دقيقة</option><option value="60">60 دقيقة</option></select></div><button class="action" id="saveInterval">حفظ فاصل التوليد</button></div>
<div class="panel"><h3>2 — فاصل نشر مقالات AI V2</h3><p class="subtle">الافتراضي دقيقة واحدة، ويمكن تغييره من 1 إلى 15 دقيقة. يمنع النظام نشر مقالين من AI V2 بأقل من الفاصل المختار، ولا يؤثر على المنشورات القديمة أو المولدات الأخرى.</p><div class="field"><label for="publishInterval">كل</label><select id="publishInterval"><option value="1">1 دقيقة</option><option value="2">2 دقائق</option><option value="3">3 دقائق</option><option value="4">4 دقائق</option><option value="5">5 دقائق</option><option value="6">6 دقائق</option><option value="7">7 دقائق</option><option value="8">8 دقائق</option><option value="9">9 دقائق</option><option value="10">10 دقائق</option><option value="11">11 دقائق</option><option value="12">12 دقائق</option><option value="13">13 دقائق</option><option value="14">14 دقائق</option><option value="15">15 دقائق</option></select></div><button class="action" id="savePublishingInterval">حفظ فاصل النشر</button><p id="publishingIntervalHint" class="data-note">جارٍ التحقق من إعداد فاصل النشر المحفوظ في Cloudflare.</p></div></div>
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
let snapshot=null,keywords=null,shownProvider="gemini",gh=null,lastManualDispatch=null;
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

function liveStage(id,value,tone){
 const el=$(id);el.dataset.tone=tone||'unknown';
 el.querySelector('.live-step-value').textContent=value;
}
function liveFresh(value,minutes){
 const ts=Date.parse(value||'');
 return Number.isFinite(ts)&&Date.now()-ts>=-120000&&Date.now()-ts<=minutes*60000;
}
function liveOutcome(m){
 const reason=m?.lastOutcome?.reason||'';
 const status=m?.lastOutcome?.status||'';
 if(status==='LIVE_VERIFIED')return 'آخر تقرير: نشر موثّق';
 if(reason==='BATCH_CONTENT_THIN')return 'آخر محاولة: المحتوى لم يجتز الجودة';
 if(reason==='PUBLISH_5XX_OUTCOME_QUARANTINED')return 'آخر محاولة نشر: خطأ 503، النتيجة غير مؤكدة';
 if(reason==='QUEUE_WINDOW_EMPTY')return 'آخر تشغيل: لا توجد مهمة مؤهلة';
 if(reason==='QUOTA_EXHAUSTED'||reason==='PAUSED_QUOTA')return 'انتظار تجدد الحصة';
 if(status==='BLOCKED')return 'آخر محاولة: محجوبة — راجعي الأخطاء';
 return 'لا توجد نتيجة توليد مؤكدة';
}

function renderDailyPulse(s){
 const d=s?.publishing?.dailyGoal||{},enabled=s?.generation?.desiredEnabled===true;
 const asNumber=x=>Number.isSafeInteger(x)&&x>=0?x:null;
 const goal=asNumber(d.dayTarget),published=asNumber(d.todayPublished),
   remaining=asNumber(d.todayRemaining),hour=asNumber(d.lastHourVerified);
 const hourly=Number.isFinite(d.hourTarget)?Number(d.hourTarget.toFixed(1)):60;
 $('dailyGoalTarget').textContent=goal===null?'—':fmt(goal);
 $('dailyGoalPublished').textContent=published===null?'—':fmt(published);
 $('dailyGoalRemaining').textContent=remaining===null?'—':fmt(remaining);
 $('dailyGoalHour').textContent=(hour===null?'—':fmt(hour))+' / '+fmt(hourly);
 const percent=asNumber(d.progressPercent);
 $('dailyProgressFill').style.width=(percent===null?0:Math.min(100,percent))+'%';
 const bar=$('dailyProgress');
 if(percent!==null){bar.setAttribute('aria-valuenow',String(percent));bar.setAttribute('aria-valuetext',percent+'% من هدف اليوم')}
 else{bar.removeAttribute('aria-valuenow');bar.setAttribute('aria-valuetext','معلومات النشر اليومي غير متاحة')}
 $('dailyProgressLabel').textContent=percent===null?'الإنجاز غير مقاس بعد':percent+'% من هدف اليوم';
 $('dailyGoalUpdated').textContent=d.asOf?'آخر جرد موثق: '+local(d.asOf)+' (القاهرة)':'آخر جرد موثق: غير متاح';
 const messages={
  STOPPED:'متوقف: تشغيل التوليد والنشر متوقف من البانل أو على Cloudflare.',
  SCHEDULER_UNVERIFIED:'تعذر التحقق من المجدول؛ لا نعتبر التوليد شغالًا قبل تأكيده.',
  UNVERIFIED:'الجرد اليومي غير حديث أو غير مكتمل — لا نستطيع تأكيد عدد المنشورات اليوم.',
  NO_RECENT_PUBLICATION:'تحذير: لم يظهر نشر مؤكد خلال أكثر من 20 دقيقة في آخر جرد. راجعي أخطاء الجودة والمزود.',
  BEHIND_TARGET:'النشر شغال لكن أقل من الهدف: راجعي آخر ساعة ونقص المقالات أو أخطاء الجودة.',
  ON_TARGET:'النشر مؤكد والمعدل حاليًا يواكب المستهدف في آخر جرد.'
 };
 const tone=d.status==='STOPPED'?'stop':
   ['BEHIND_TARGET','NO_RECENT_PUBLICATION','SCHEDULER_UNVERIFIED','UNVERIFIED'].includes(d.status)?'warn':'ok';
 $('dailyPulse').dataset.tone=tone;
 $('dailyGoalStatus').textContent=messages[d.status]||'حالة النشر غير مؤكدة';
}
function renderLiveStrip(s){
 const g=s.generation||{},p=s.publishing||{},v=p.verified||{},scheduler=g.actualScheduler||{};
 const verifiedScheduler=g.desiredEnabled===true&&scheduler.reachable===true&&scheduler.enabled===true&&scheduler.controlStatus==='POLICY_VERIFIED';
 const reports=Array.isArray(g.marketReports)?g.marketReports.filter(m=>m&&typeof m==='object'):[];
 const latest=reports.slice().sort((a,b)=>Date.parse(b.generatedAt||'')-Date.parse(a.generatedAt||''))[0]||null;
 const generationFresh=liveFresh(g.lastReportAt||latest?.generatedAt,15);
 const publicationFresh=v.ledgerAvailable===true&&liveFresh(v.generatedAt,15);
 let tone='warn',headline='حالة التشغيل غير مؤكدة',reason='لم تصل بيانات كافية لإثبات تشغيل المجدول.';
 if(g.desiredEnabled===false){tone='stop';headline='التوليد متوقف من لوحة التحكم';reason='اضغطي تشغيل / استئناف ثم حدّثي الحالة للتأكد من تفعيل Cloudflare الفعلي.'}
 else if(scheduler.reachable===false){headline='تعذر الاتصال بمجدول Cloudflare';reason='لا يمكن الجزم إن المجدول يعمل. يُرجى مراجعة الاتصال وحالة الخدمة.'}
 else if(scheduler.enabled===false){tone='stop';headline='المجدول غير مفعّل فعليًا';reason='طلب التشغيل محفوظ، لكن مجدول Cloudflare لا يزال غير مفعّل. الضغط على توليد الآن لا يثبت تشغيلًا تلقائيًا.'}
 else if(!verifiedScheduler){headline='تفعيل المجدول غير متحقق';reason='وصلت استجابة من Cloudflare، لكن سياسة تشغيل المجدول لم تُؤكَّد بعد.'}
 else if(g.status==='PAUSED_QUOTA_EXHAUSTED'){headline='المجدول مفعّل — انتظار تجدد الحصة';reason='المفاتيح المتاحة في انتظار حصة Gemini/Groq وفق آخر تقرير. لا يوجد توليد ناجح مؤكد الآن.'}
 else if(g.status==='WAITING_ELIGIBLE_TOPIC'){headline='المجدول مفعّل — لا توجد مهمة مؤهلة';reason='آخر فحص لم يجد موضوعًا مؤهلًا؛ هذا ليس دليلًا على نشر مقال جديد.'}
 else if(p.dailyGoal?.status==='NO_RECENT_PUBLICATION'){
   tone='warn';headline='المجدول مفعّل لكن النشر متعثر';
   reason='آخر جرد مؤكد لا يُظهر نشرًا حديثًا. افحصي الجودة والحدود والأخطاء.'
 }
 else if(p.dailyGoal?.status==='BEHIND_TARGET'){
   tone='warn';headline='المجدول مفعّل — معدل النشر أقل من 60 مقالة/ساعة';
   reason='تشغيل المجدول لا يضمن بلوغ العدد المستهدف. راقبي المقالات المنشورة وأسباب الرفض.'
 }
 else if(!generationFresh){headline='المجدول مفعّل — ننتظر تقرير توليد حديث';reason='تشغيل المجدول لا يثبت أن Gemini/Groq يولّد مقالة الآن.'}
 else {tone='ok';headline='المجدول مفعّل — ورد تقرير تشغيل حديث';reason='نستقبل بيانات التوليد؛ نجاح النشر يُقاس بشكل منفصل بسجل المنشورات المؤكدة.'}
 $('liveStrip').dataset.tone=tone;
 $('liveHeadline').textContent=headline;
 $('liveReason').textContent=reason;
 $('liveCheckedAt').textContent='آخر فحص: '+local(s.checkedAt)+' (القاهرة)';
 liveStage('liveStageScheduler',verifiedScheduler?'مفعّل ومتحقق':g.desiredEnabled===false?'متوقف يدويًا':scheduler.reachable===false?'تعذر الاتصال':scheduler.enabled===false?'غير مفعّل':'التفعيل غير متحقق',verifiedScheduler?'ok':g.desiredEnabled===false||scheduler.enabled===false?'stop':'warn');
 liveStage('liveStageGeneration',generationFresh?liveOutcome(latest):'لا يوجد تقرير حديث يثبت التوليد',generationFresh&&latest?.lastOutcome?.status==='LIVE_VERIFIED'?'ok':'warn');
 const stockMeasured=s.stockpile?.available===true&&Number.isSafeInteger(s.stockpile.readyCount)&&s.stockpile.readyCount>=0;
 liveStage('liveStageReady',stockMeasured?'READY مؤكد: '+s.stockpile.readyCount:'غير مقاس — لا نفترض صفرًا',stockMeasured?'ok':'warn');
 const lastHour=Number.isSafeInteger(v.lastHour?.total)?v.lastHour.total:null;
 liveStage('liveStagePublishing',publicationFresh&&lastHour!==null?(lastHour>0?'تم تأكيد '+lastHour+' مقالة آخر ساعة':'لا نشر مؤكّد آخر ساعة'):v.ledgerAvailable?'تقرير النشر قديم أو غير مكتمل':'سجل النشر غير متاح',publicationFresh&&lastHour>0?'ok':'warn');
 $('liveLastPublished').textContent=v.ledgerAvailable&&liveFresh(v.lastArticle?.publishedAt,525600)?local(v.lastArticle.publishedAt):'غير متاح من السجل';
 $('liveNextPublish').textContent=p.nextPublicationWindowAt?local(p.nextPublicationWindowAt)+' (مستهدفة)':'غير متاحة حتى تحقق بوابة النشر';
 $('liveReadyCount').textContent=stockMeasured?String(s.stockpile.readyCount):'غير مقاس';
 let issue='لا يوجد خطأ محدد في آخر تقرير';
 if(g.desiredEnabled===false)issue='التوليد متوقف يدويًا';
 else if(scheduler.reachable===false)issue='مجدول Cloudflare لا يستجيب';
 else if(scheduler.enabled===false)issue='المجدول غير مفعّل فعليًا';
 else if(g.status==='PAUSED_QUOTA_EXHAUSTED')issue='انتظار تجدد حصة المفاتيح';
 else if(generationFresh&&latest?.lastOutcome?.status==='BLOCKED')issue=liveOutcome(latest);
 else if(!generationFresh)issue='تقرير التوليد غير حديث';
 else if(!publicationFresh)issue='بيانات النشر غير حديثة أو غير متاحة';
 $('liveIssue').textContent=issue;
 $('liveAttempt').textContent=lastManualDispatch?
 'آخر طلب من هذه الصفحة: '+local(lastManualDispatch.at)+' — '+lastManualDispatch.message:
 'آخر طلب «توليد الآن» من هذه الصفحة: لم يتم إرسال طلب في الجلسة الحالية.';
}
function liveStripUnavailable(message){
 $('liveStrip').dataset.tone='warn';
 $('liveHeadline').textContent='تعذّر التحقق من حالة التوليد والنشر';
 $('liveReason').textContent='تعذّر تحديث حالة الإنتاج. لا يمكن اعتبار القيم السابقة دليلًا على التشغيل الحالي. '+message;
 $('liveCheckedAt').textContent='آخر فحص: فشل التحديث';
 for(const id of ['liveStageScheduler','liveStageGeneration','liveStageReady','liveStagePublishing'])liveStage(id,'غير متاح حاليًا','warn');
 for(const id of ['liveLastPublished','liveNextPublish','liveReadyCount','liveIssue'])$(id).textContent='غير متاح';
 $('dailyPulse').dataset.tone='warn';$('dailyGoalStatus').textContent='تعذر تحديث بيانات اليوم؛ لا يمكن إثبات النشر الحالي.';
 for(const id of ['dailyGoalPublished','dailyGoalRemaining'])$(id).textContent='—';
 $('dailyGoalHour').textContent='— / 60';$('dailyProgressFill').style.width='0%';
 $('dailyProgress').removeAttribute('aria-valuenow');
 $('dailyGoalUpdated').textContent='آخر جرد: غير متاح';
}
function update(){
const s=snapshot;if(!s)return;renderLiveStrip(s);renderDailyPulse(s);const g=s.generation||{},p=s.publishing||{},v=p.verified||{};
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
 item(next,p.nextPublicationWindowAt?'نافذة النشر المستهدفة التالية: '+local(p.nextPublicationWindowAt):'نافذة النشر المستهدفة: غير متاحة',
  p.intervalVerified?'الفاصل الفعلي: كل '+p.publicationIntervalMinutes+' دقيقة · الموعد فرصة لنشر مقال جاهز وليس وعدًا بنشر مقال':'فاصل النشر لم يُتحقق منه بعد من Cloudflare');
 item(next,p.nextArticleScheduledAt?'مقال محجوز للنشر: '+local(p.nextArticleScheduledAt):'لا توجد مقالة بعينها بموعد مضمون',
  'لن نعرض موعدًا مؤكدًا لمقالة ما لم تتوافر مقالة READY ولها scheduled_at حقيقي');
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
$('publishInterval').value=String(p.desiredIntervalMinutes||1);
$('publishingIntervalHint').textContent=p.intervalVerified?
 'الفاصل المحفوظ والمطبق على بوابة Cloudflare: '+p.publicationIntervalMinutes+' دقيقة · النافذة المستهدفة: '+
 (p.nextPublicationWindowAt?local(p.nextPublicationWindowAt):'غير متاحة')+
 ' · أي مقالة تحتاج اجتياز الجودة قبل النشر':
 'الإعداد المطلوب: '+(p.desiredIntervalMinutes||1)+' دقيقة، لكن تأكيد تطبيقه على Cloudflare غير متاح حاليًا.';
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
 $('nextPublishingSchedule').textContent=p.nextPublicationWindowAt?'نافذة النشر المستهدفة القادمة: '+local(p.nextPublicationWindowAt)+' (ليست ضمانًا لنزول مقال)':'نافذة النشر التالية غير متاحة حتى تأكيد بوابة النشر';
$('diagState').textContent=s.warnings?.length?s.warnings.join(' · '):'لا توجد أخطاء مسجلة في هذه اللقطة، لكن ذلك لا يثبت اكتمال كل مراحل SYSTEM1';
$('diagJson').textContent=JSON.stringify({checkedAt:s.checkedAt,generation:s.generation,publishing:s.publishing,capabilities:s.capabilities,warnings:s.warnings},null,2);
for(const provider of ['gemini','groq']){
const count=s.providers?.[provider]?.counts;
$(provider+'Quota').textContent=count?'إجمالي محمل: '+fmt(s.providers?.[provider]?.total)+' | غير محظور وغير مختبر: '+fmt(count.eligibleUnverified)+' | انتظار حصة: '+fmt(count.quotaWait)+' | انتظار مزود: '+fmt(count.providerWait)+' | غير محسوم: '+fmt((count.unverified||0)+(count.notInspected||0)):'لا توجد بيانات حصص مؤكدة من المزود';
}
renderKeys();
}
async function load(){try{snapshot=await api('/api/admin/system1/summary');update()}catch(e){liveStripUnavailable('تعذر قراءة بيانات الإنتاج');setState('genState','المراقبة غير متاحة',e.message,'warn');setState('pubState','النشر غير متاح','الرقم مجهول، وليس صفرًا','warn');note('تعذر قراءة بيانات الإنتاج: '+e.message)}}
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
async function runNow(skipConfirm=false){
 const g=snapshot?.generation||{};
 if(g.desiredEnabled===false){note('ابدئي بالضغط على تشغيل / استئناف، ثم تحديث البيانات للتأكد أن المجدول مفعل.');return}
 if(g.actualScheduler?.enabled===false){note('المجدول متوقف فعليًا. اضغطي تشغيل / استئناف أولًا ثم حدّثي الحالة. لو ظل متوقفًا يحتاج تفعيل Cloudflare.');return}
 if(!skipConfirm&&!confirm('تشغيل محاولة توليد من لوحة الموقع؟ سيعمل المحرك في الخلفية وقد يستخدم حصة Gemini/Groq إذا وجد موضوعًا مؤهلًا. هل تريدين المتابعة؟'))return;
 const btn=$('runOnce');btn.disabled=true;
 try{
   const result=await post('/api/admin/ai-v2-run-now',{});
   lastManualDispatch={at:new Date().toISOString(),message:result.dispatched?'تم قبول طلب التوليد في الخلفية، ولم يثبت توليد أو نشر مقالة بعد':'لم تُرسل محاولة جديدة'};
   if(snapshot)renderLiveStrip(snapshot);
   note(result.dispatched?'استلمت خدمة الخلفية طلب التوليد من الموقع. لم يتم تأكيد توليد أو نشر مقالة بعد؛ تابعي العدادات والسجل.':'لم تُرسل محاولة جديدة');
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
   lastManualDispatch={at:new Date().toISOString(),message:messages[e.message]||'تعذر إرسال الطلب'};
   if(snapshot)renderLiveStrip(snapshot);
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
async function startAndDispatch(){
 const buttons=[$('startGeneration'),$('startNowFromRibbon')];
 buttons.forEach(btn=>btn.disabled=true);
 try{
  const saved=await setControl({enabled:true});
  if(!saved)return;
  await runNow(true);
 }finally{buttons.forEach(btn=>btn.disabled=false)}
}
$('startGeneration').onclick=startAndDispatch;
$('startNowFromRibbon').onclick=startAndDispatch;
$('pauseGeneration').onclick=()=>setControl({enabled:false});
$('saveInterval').onclick=()=>setControl({intervalMinutes:Number($('genInterval').value)});
$('savePublishingInterval').onclick=async()=>{
 const minutes=Number($('publishInterval').value);
 if(!Number.isInteger(minutes)||minutes<1||minutes>15){note('اختاري فاصلاً من دقيقة إلى 15 دقيقة');return}
 const result=await setControl({publishingIntervalMinutes:minutes});
 if(result)note('تم حفظ الفاصل: '+minutes+' دقيقة. يتم التحقق من تطبيقه على بوابة النشر؛ راجعي النافذة المستهدفة.');
};
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

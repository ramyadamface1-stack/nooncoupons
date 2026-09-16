import fs from 'node:fs';

function mustReplace(text,from,to,label){if(!text.includes(from))throw new Error(label+'_NOT_FOUND');return text.replace(from,to)}
function editFunction(text,startToken,endToken,fn,label){const a=text.indexOf(startToken);if(a<0)throw new Error(label+'_START_NOT_FOUND');const b=text.indexOf(endToken,a+startToken.length);if(b<0)throw new Error(label+'_END_NOT_FOUND');return text.slice(0,a)+fn(text.slice(a,b))+text.slice(b)}

// commerce-entry: English canary route, health, sitemap, scheduled canary.
{
 const path='commerce-entry.js';let s=fs.readFileSync(path,'utf8');
 s=mustReplace(s,"import {enhanceSpecialtyLanding,LANDING_SPECIALTY_V4} from './landing-specialty-v4.js';","import {enhanceSpecialtyLanding,LANDING_SPECIALTY_V4} from './landing-specialty-v4.js';\nimport {runEnglishCanary,serveEnglishCanaryArticle,serveEnglishCanaryHealth,englishCanarySitemap} from './english-canary.js';",'COMMERCE_IMPORT');
 const old="if(/<sitemapindex\\b/i.test(text)){if(!text.includes('/sitemap-commerce.xml'))text=text.replace(/<\\/sitemapindex>/i,`<sitemap><loc>${xmlEsc(origin)}/sitemap-commerce.xml</loc></sitemap></sitemapindex>`);return text}";
 const neu="if(/<sitemapindex\\b/i.test(text)){if(!text.includes('/sitemap-commerce.xml'))text=text.replace(/<\\/sitemapindex>/i,`<sitemap><loc>${xmlEsc(origin)}/sitemap-commerce.xml</loc></sitemap></sitemapindex>`);if(!text.includes('/sitemap-en-articles.xml'))text=text.replace(/<\\/sitemapindex>/i,`<sitemap><loc>${xmlEsc(origin)}/sitemap-en-articles.xml</loc></sitemap></sitemapindex>`);return text}";
 s=mustReplace(s,old,neu,'COMMERCE_SITEMAP_INDEX');
 s=mustReplace(s,"if(req.method==='GET'&&path==='/sitemap-commerce.xml')return hardened(commerceSitemap(origin));if(req.method==='GET'&&path==='/api/commerce-health')", "if(req.method==='GET'&&path==='/sitemap-commerce.xml')return hardened(commerceSitemap(origin));if(req.method==='GET'&&path==='/sitemap-en-articles.xml')return hardened(await englishCanarySitemap(env,origin));if(req.method==='GET'&&path==='/api/english-canary-health')return serveEnglishCanaryHealth(env);if(req.method==='GET'&&path.startsWith('/en/articles/')){const er=await serveEnglishCanaryArticle(req,env);if(er)return hardened(er)}if(req.method==='GET'&&path==='/api/commerce-health')",'COMMERCE_ROUTES');
 s=mustReplace(s,"async scheduled(event,env,ctx){if(app.scheduled)return app.scheduled(event,env,ctx)}","async scheduled(event,env,ctx){if(app.scheduled)app.scheduled(event,env,ctx);ctx.waitUntil(runEnglishCanary(env))}",'COMMERCE_SCHEDULED');
 fs.writeFileSync(path,s);
}

// commerce-pages: English landing evidence must come only from the isolated native-English canary.
{
 const path='commerce-pages-v2.js';let s=fs.readFileSync(path,'utf8');
 s=mustReplace(s,"} from './commerce-taxonomy.js';","} from './commerce-taxonomy.js';\nimport {englishCanaryRecords} from './english-canary.js';",'PAGES_IMPORT');
 const marker="function articleCard(a) {\n  return `<article class=\"card\"><small>${a.country === 'AE' ? 'الإمارات' : 'السعودية'}</small><h3><a href=\"/articles/${enc(a.slug)}\">${esc(a.title || a.primaryKeyword || a.slug)}</a></h3><p>${esc((a.metaDescription || '').slice(0,180))}</p><a class=\"read\" href=\"/articles/${enc(a.slug)}\">اقرأ الدليل ←</a></article>`;\n}\n";
 const add=marker+"\nasync function englishMarketRows(env, market) {\n  const country = MARKETS[market]?.country;\n  if (!country) return [];\n  return (await englishCanaryRecords(env)).filter((a) => a?.slug && a.indexable !== false && a.country === country && a.languageSource === 'native-intent-v6-canary');\n}\n\nfunction englishArticleCard(a) {\n  return `<article class=\"card\"><small>${a.country === 'AE' ? 'UAE' : 'Saudi Arabia'} · ${esc(a.intent || 'guide')}</small><h3><a href=\"/en/articles/${enc(a.slug)}\">${esc(a.title || a.primaryKeyword || a.slug)}</a></h3><p>${esc((a.metaDescription || '').slice(0,180))}</p><a class=\"read\" href=\"/en/articles/${enc(a.slug)}\">Read guide →</a></article>`;\n}\n";
 s=mustReplace(s,marker,add,'PAGES_ENGLISH_HELPERS');
 s=editFunction(s,'async function englishCategoryPage(','async function englishCountryPage(',block=>{
   block=mustReplace(block,'const rows=marketRows(await latestArticles(env),market).filter(a=>a.categoryKey===key||a.commerceCategory===key).slice(0,12);','const rows=(await englishMarketRows(env,market)).filter(a=>a.categoryKey===key).slice(0,12);','EN_CATEGORY_ROWS');
   return block.replace(/rows\.map\(articleCard\)/g,'rows.map(englishArticleCard)');
 },'EN_CATEGORY_FUNCTION');
 s=editFunction(s,'async function englishCountryPage(','async function countryPage(',block=>{
   block=mustReplace(block,'rows=marketRows(await latestArticles(env),market).slice(0,9)','rows=(await englishMarketRows(env,market)).slice(0,9)','EN_COUNTRY_ROWS');
   return block.replace(/rows\.map\(articleCard\)/g,'rows.map(englishArticleCard)');
 },'EN_COUNTRY_FUNCTION');
 fs.writeFileSync(path,s);
}

// public-entry: fix existing undefined market variable on article mobile CTA.
{
 const path='public-entry.js';let s=fs.readFileSync(path,'utf8');
 s=mustReplace(s,"    html=mobileCouponBar(html,noonUrl,fallbackCode,market);","    const market=noonUrl.includes('/uae-ar/')?'AE':'SA';\n    html=mobileCouponBar(html,noonUrl,fallbackCode,market);",'PUBLIC_MARKET_FIX');
 fs.writeFileSync(path,s);
}

// Main bulk pipeline remains Arabic-primary; English is isolated until the canary audit is complete.
{
 const path='bulk-generator.js';let s=fs.readFileSync(path,'utf8');
 const old="const rawTopic=buildRawBulkTopic(currentCursor),englishEligible=ENGLISH_COMMERCIAL_INTENTS.has(rawTopic.intent)&&currentCursor%ENGLISH_INTENT_CADENCE===0,languageIntent=englishEligible?'en':'ar',revenueEligible=";
 const neu="const rawTopic=buildRawBulkTopic(currentCursor),languageIntent='ar',revenueEligible=";
 s=mustReplace(s,old,neu,'BULK_LANGUAGE_INTENT');
 s=mustReplace(s,"languageSource:languageIntent==='en'?'native-intent-candidate':'arabic-primary'","languageSource:'arabic-primary'",'BULK_LANGUAGE_SOURCE');
 s=mustReplace(s,"bulkLanguageStrategy:'arabic-primary-native-english-candidates'","bulkLanguageStrategy:'arabic-primary-english-canary-isolated'",'BULK_LANGUAGE_STRATEGY');
 fs.writeFileSync(path,s);
}

// Hard cap the English canary at two successful articles.
{
 const path='wrangler.jsonc';let s=fs.readFileSync(path,'utf8');
 s=mustReplace(s,'    "TARGET_ARTICLE_WORDS": "1500",','    "TARGET_ARTICLE_WORDS": "1500",\n    "ENGLISH_CANARY_TOTAL": "2",','WRANGLER_CANARY_CAP');
 fs.writeFileSync(path,s);
}

console.log('ENGLISH_CANARY_INTEGRATION=APPLIED');

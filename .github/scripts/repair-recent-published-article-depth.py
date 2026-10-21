#!/usr/bin/env python3
"""Targeted editorial corrections on 3 *existing published* Noon article HTMLs.

Default DRY RUN. --apply only after tests with EXPLICIT QA_WRITE_EXISTING=yes.
Object writes are conditional If-Match and preserve R2 metadata, original URL,
slug, and full existing article body. No deletions or new articles.
"""
import os,sys,argparse,boto3,re,hashlib,html
from botocore.config import Config

ACCOUNT='e4c35f8a50a7b2e4cfb9d6c534962603'
BUCKET='nooncoupons-content-v2'
MARKER='data-editorial-supplement="noondealsnow-20261021"'
PAGES={
'كود-خصم-نون-السعودية-اللابتوبات-مع-مقارنة-البائعين':(
  'SA','مراجعة عرض اللابتوب بين أكثر من بائع',
  'عند مقارنة اللابتوبات على نون السعودية، ابدأ بمطابقة رقم الموديل والمعالج وحجم الذاكرة وسعة التخزين، لأن تشابه الاسم التجاري لا يعني بالضرورة أن المواصفات متطابقة. راجع اسم البائع وحالة المنتج والضمان وسياسة الإرجاع قبل الاختيار. بعد ذلك أضف كل عرض إلى السلة بصورة منفصلة، وسجل السعر النهائي الظاهر بعد الشحن والرسوم وأي خصم مؤهل، بدل الاعتماد على نسبة الخصم المكتوبة في صفحة العرض. لا تفترض أن كوبون نون يعمل على كل علامة تجارية أو كل بائع؛ قد تختلف أهلية المنتجات وفق شروط العرض الفعلية. إذا كان السعر أقل لكن مدة التسليم أطول أو الضمان مختلفًا، ضع هذه الفروق ضمن المقارنة. احتفظ بلقطة للسعر النهائي وشروط البيع وقت الشراء للرجوع إليها عند الحاجة. القرار الأفضل هو العرض الذي يجمع المواصفات المطلوبة والتكلفة الفعلية والضمان والتوصيل الملائم، وليس السعر الأولي وحده.'
),
'شراء-الجوالات-من-نون-الإمارات-باستخدام-كوبون-مع-حل-مشاكل-الكود':(
  'AE','خطوات عملية عند رفض كوبون الجوالات في الإمارات',
  'إذا لم يظهر الخصم عند شراء جوال من نون الإمارات، تحقق أولًا من كتابة الكود كما هو من غير مسافات إضافية، ثم راجع الرسالة الظاهرة داخل السلة. افحص بلد المتجر والحساب المستخدم، والحد الأدنى للطلب إن كان مذكورًا، وأهلية الجهاز والبائع وطريقة الدفع وفق شروط العرض الفعلية. قد تختلف بعض العروض حسب المنتج أو فترة الاستخدام أو فئة العميل؛ لذلك لا تعتبر عدم قبول الكود خطأ تقنيًا تلقائيًا. جرّب إزالة المنتجات غير المؤهلة مؤقتًا لمعرفة العنصر الذي يؤثر على العرض، ثم أعد المقارنة بعد احتساب رسوم الشحن أو التوصيل. لا تكمل الدفع قبل التأكد من إجمالي المبلغ النهائي وما إذا كان الضمان مناسبًا لإصدار الجهاز المحدد. إن لم يصبح الكود صالحًا، قارن السعر الأساسي والعروض المعلنة المتاحة بدل تكرار محاولات لا تغيّر الأهلية. احتفظ بالشروط المعروضة وقت الشراء لتسهيل التواصل مع خدمة العملاء عند الضرورة.'
),
'كود-خصم-نون-الإمارات-اللابتوبات-مع-الشحن':(
  'AE','كيف تقارن تكلفة اللابتوب مع الشحن في الإمارات',
  'عند اختيار لابتوب من نون الإمارات، قارن تكلفة الجهاز بعد الشحن والرسوم بدل مقارنة السعر المعروض في نتائج البحث وحده. تأكد من مواصفات الإصدار المحلي أو الدولي وتخطيط لوحة المفاتيح والضمان، لأن اختلاف هذه التفاصيل قد يجعل عرضين متشابهين غير قابلين للمقارنة المباشرة. افتح سلة كل بائع على حدة لمعرفة تكلفة التوصيل وموعد التسليم الفعلي وأهلية الكوبون، ولا تفترض أن الخصم يشمل رسوم الشحن. اقرأ سياسة الإرجاع المتعلقة بالمنتج الإلكتروني وحالة العلبة والتفعيل قبل الدفع. إذا كان هناك عرض أسرع توصيلًا لكنه أغلى، قيّم فارق الوقت ضمن احتياجاتك الحقيقية. احتفظ بإجمالي السلة النهائي ورقم الموديل وشروط الضمان، ثم اختر العرض الذي يحقق أفضل توازن بين السعر النهائي والمواصفات وسياسة الخدمة، لا الأقل سعرًا على الورق فقط.'
)}
def build_section(title,paragraph):
    return f'<section class="editorial-verification-checklist" {MARKER}><h2>{html.escape(title)}</h2><p>{html.escape(paragraph)}</p></section>'
def update_document(text,section):
    if MARKER in text:return text,False
    if not re.search(r'<h1\b',text,re.I):raise ValueError('missing_source_h1')
    if len(text)<9000:raise ValueError('unexpectedly_short_source_article')
    for boundary in ('</article>','</main>','</body>'):
        if boundary in text:
            return text.replace(boundary,section+boundary,1),True
    return text+section,True
def client():
    return boto3.client('s3',region_name='auto',endpoint_url=f'https://{ACCOUNT}.r2.cloudflarestorage.com',
        aws_access_key_id=os.environ['NOON_NEW_R2_ACCESS_KEY_ID'].strip(),
        aws_secret_access_key=os.environ['NOON_NEW_R2_SECRET_ACCESS_KEY'].strip(),
        config=Config(connect_timeout=10,read_timeout=25,retries={'mode':'standard','max_attempts':3}))
def main(apply):
    c=client()
    for slug,(country,title,paragraph) in PAGES.items():
        if len(paragraph.split())<85:raise RuntimeError('editorial_checklist_too_thin')
        key=f'articles/{slug}.html'
        resp=c.get_object(Bucket=BUCKET,Key=key)
        source=resp['Body'].read().decode('utf-8')
        metadata=resp.get('Metadata') or {}
        if metadata.get('status')!='published' or metadata.get('c')!=country:
            raise RuntimeError('article_status_country_mismatch')
        section=build_section(title,paragraph)
        revised,changed=update_document(source,section)
        print('EDITORIAL_ARTICLE_REPAIR='+str({'slug':slug,'market':country,'originalBytes':len(source.encode()),'newBytes':len(revised.encode()),'changed':changed,'apply':apply,'sourceHashPrefix':hashlib.sha256(source.encode()).hexdigest()[:12]}),flush=True)
        if not apply or not changed:continue
        kwargs=dict(Bucket=BUCKET,Key=key,Body=revised.encode('utf-8'),
                    ContentType=resp.get('ContentType') or 'text/html; charset=utf-8',
                    Metadata=metadata,IfMatch=resp['ETag'])
        for header in ('CacheControl','ContentLanguage','ContentDisposition','ContentEncoding'):
            if resp.get(header):kwargs[header]=resp[header]
        c.put_object(**kwargs)
        out=c.get_object(Bucket=BUCKET,Key=key)
        restored=out['Body'].read().decode('utf-8')
        if not restored.startswith(source[:500]) or restored.count(MARKER)!=1 or len(restored)<=len(source):
            raise RuntimeError('postwrite_article_integrity_mismatch')
        if out.get('Metadata')!=metadata:raise RuntimeError('article_metadata_not_preserved')
        print('EDITORIAL_ARTICLE_VERIFIED='+str({'slug':slug,'bytes':len(restored.encode()),'markerOnce':True}),flush=True)
    print('EDITORIAL_REPAIR_COMPLETE='+str({'apply':apply,'existingArticlesOnly':True,'newResources':False,'deletions':0}),flush=True)
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--apply',action='store_true');parser.add_argument('--fixture-test',action='store_true')
    args=parser.parse_args()
    if args.fixture_test:
        sample='<h1>test</h1>'+('<p>sample useful text</p>'*600)
        a,new=update_document(sample,build_section('title',PAGES[next(iter(PAGES))][2]))
        assert new and a.count(MARKER)==1
        b,new=update_document(a,'ignored');assert not new and b==a
        for country,title,para in PAGES.values():assert len(para.split())>=85
        print('EDITORIAL_PATCH_FIXTURE_TESTS=PASS');sys.exit(0)
    if args.apply and os.environ.get('QA_WRITE_EXISTING')!='yes':sys.exit('missing QA_WRITE_EXISTING=yes')
    main(args.apply)

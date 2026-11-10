import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const filename=new URL('../.github/workflows/noondealsnow-native-quality-compact.yml',import.meta.url);
const workflow=()=>readFileSync(filename,'utf8');
function embeddedPython(){
 const yaml=workflow(),open="          python3 - <<'PY'\n",start=yaml.indexOf(open);
 assert.ok(start>=0,'Expected existing isolated boto3 projection script');
 const end=yaml.indexOf("\n          PY",start+open.length);
 assert.ok(end>start,'Expected existing heredoc boundary');
 return yaml.slice(start+open.length,end).split('\n').map(line=>{
  assert.ok(!line||line.startsWith('          '),'Python code escaped workflow literal block');
  return line.startsWith('          ')?line.slice(10):line;
 }).join('\n');
}

test('quality snapshot has a bounded twelve-hour recurrence and still permits manual regeneration',()=>{
 const y=workflow();
 assert.match(y,/schedule:\s*\n\s+- cron: '23 0,12 \* \* \*'/);
 assert.match(y,/workflow_dispatch:/);
 assert.match(y,/concurrency:\s*\n\s+group: ndn-native-quality-snapshot/);
 assert.match(y,/NOON_NEW_R2_ACCESS_KEY_ID/);
 assert.match(y,/NOON_NEW_R2_SECRET_ACCESS_KEY/);
 assert.doesNotMatch(y,/GEMINI_API_KEY|GROQ_API_KEY|workers_ai/i);
});

test('Python projection remains syntax valid and skips identical source before download or write',()=>{
 const py=embeddedPython();
 const parse=spawnSync('python3',['-c','import ast,sys;ast.parse(sys.stdin.read())'],{
  input:py,encoding:'utf8',timeout:5000
 });
 assert.equal(parse.status,0,parse.stderr);
 const headAt=py.indexOf("sourceHead=s.head_object(");
 const changedAt=py.indexOf("priorMeta.get('source-etag')==sourceEtag");
 const skipAt=py.indexOf("raise SystemExit(0)");
 const downloadAt=py.indexOf("sourceObj=s.get_object(");
 const putAt=py.indexOf("s.put_object(Bucket=bucket,Key=target");
 assert.ok(headAt>=0&&headAt<changedAt&&changedAt<skipAt&&skipAt<downloadAt&&downloadAt<putAt,
  'Up-to-date source must not download entire original quality source or write anything');
 assert.match(py,/raise RuntimeError\('SOURCE_CHANGED_BETWEEN_HEAD_AND_GET'\)/);
 assert.match(py,/raise RuntimeError\('SOURCE_CHANGED_BEFORE_COMPACT_PUT'\)/);
 assert.match(py,/except ClientError as e:/);
 assert.match(py,/if e\.response\.get\('Error',\{\}\)\.get\('Code'\) not in/);
});

test('stale projection rebuild retains every original SEO novelty field, full source order and checksum readback',()=>{
 const py=embeddedPython();
 const required=['slug','title','primaryKeyword','signature','blueprint','country','category','intent',
  'intentLabel','useCase','factor','scenario','queryModifier','catalogLevel','catalogTarget',
  'brandKey','modelKey','comparisonKey','campaignId','campaignKind',
  'campaignStartKnown','campaignEndKnown','intentKey','ownerIntentKey','createdAt','updatedAt'];
 for(const key of required)assert.ok(py.includes("'"+key+"'"),'Must preserve novelty field '+key);
 assert.match(py,/if len\(slim\)!=len\(payload\['articles'\]\)/);
 assert.match(py,/if k in orig and sub\.get\(k\)!=orig\[k\]/);
 assert.match(py,/sourceEtag.*sourceEtag/s);
 assert.match(py,/Metadata=\{'source-etag':sourceEtag,'source-count':str\(len\(slim\)\)\}/);
 assert.match(py,/hashlib\.sha256\(raw\)\.digest\(\)!=hashlib\.sha256\(after\)\.digest\(\)/);
 assert.match(py,/NATIVE_QUALITY_PROJECTION_VERIFIED=true/);
 assert.match(py,/ARTICLE_OBJECT_WRITES=0;OLD_ORIGINAL_INDEX_WRITES=0/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {safeSaudiFilesystemRecovery,SA_FILESYSTEM_RECOVERY_REVISION,resumableCheckpoint} from '../automation/ai-v2/topic-queue.mjs';
test('checkpointed SSD draft has exactly one no-provider filesystem recovery',()=>{
 const topic={country:'SA',category:'أقراص SSD',coupon:'NOV170'};
 const c={state:'BLOCKED_REVIEW',errorCategory:'NATIVE_QUALITY_BLOCKED',
  sections:Array(5).fill({html:'<h2>Existing draft</h2>'}),sectionIndex:5,
  nativeArticle:{html:'<article>FAT32 EXT4 NOV170</article>'},
  nativeTopic:{...topic,code:'NOV170'},
  nativeGateDiagnostics:{p0:['coupon_lock'],failed:['coupon_lock'],schemas:[],duplicates:[],indexation:[]}};
 assert.equal(safeSaudiFilesystemRecovery(c,topic),true);
 assert.equal(resumableCheckpoint(c,{autoSafeSaudiFilesystemRecovery:true,topic}),true);
 assert.equal(safeSaudiFilesystemRecovery({...c,filesystemRecoveryRevision:SA_FILESYSTEM_RECOVERY_REVISION},topic),false);
 assert.equal(safeSaudiFilesystemRecovery({...c,nativeArticle:{html:'NOV170 NOV188 EXT4'}},topic),false);
});

test('saved ASUS router AX3000 code confusion is recoverable once only',()=>{
 const topic={country:'SA',category:'راوتر واي فاي',brand:'أسوس',coupon:'NOV170'};
 const cp={state:'BLOCKED_REVIEW',errorCategory:'NATIVE_QUALITY_BLOCKED',
  sections:Array(5).fill({html:'<h2>Saved text</h2>'}),sectionIndex:5,
  nativeArticle:{html:'<article>تصنيف راوتر AX3000 مع كود NOV170</article>'},
  nativeTopic:{...topic,code:'NOV170'},
  nativeGateDiagnostics:{p0:['coupon_lock'],failed:['coupon_lock'],schemas:[],duplicates:[],indexation:[]}};
 assert.equal(safeSaudiFilesystemRecovery(cp,topic),true);
 assert.equal(safeSaudiFilesystemRecovery({...cp,filesystemRecoveryRevision:SA_FILESYSTEM_RECOVERY_REVISION},topic),false);
 assert.equal(safeSaudiFilesystemRecovery({...cp,nativeArticle:{html:'AX3000 NOV188 NOV170'}},topic),false);
});

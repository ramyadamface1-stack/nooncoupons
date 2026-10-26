import test from 'node:test';
import assert from 'node:assert/strict';
import {migrationExportPageBudget} from '../do-migration-state.js';

test('shared remote-R2 Cron caps each DO exporter at 2 checkpointed parts per minute',()=>{
  assert.equal(migrationExportPageBudget({REMOTE_EXISTING_R2_ENABLED:'true',DO_MIGRATION_EXPORT_PAGES_PER_TICK:'20'}),2);
  assert.equal(migrationExportPageBudget({REMOTE_EXISTING_R2_ENABLED:'true',DO_MIGRATION_EXPORT_PAGES_PER_TICK:'1'}),1);
  assert.equal(migrationExportPageBudget({REMOTE_EXISTING_R2_ENABLED:'true'}),2);
});
test('local/binding-native backup acceleration remains unchanged',()=>{
  assert.equal(migrationExportPageBudget({REMOTE_EXISTING_R2_ENABLED:'false',DO_MIGRATION_EXPORT_PAGES_PER_TICK:'20'}),20);
  assert.equal(migrationExportPageBudget({REMOTE_EXISTING_R2_ENABLED:'false',DO_MIGRATION_EXPORT_PAGES_PER_TICK:'200'}),20);
  assert.equal(migrationExportPageBudget({REMOTE_EXISTING_R2_ENABLED:'false',DO_MIGRATION_EXPORT_PAGES_PER_TICK:'0'}),1);
});

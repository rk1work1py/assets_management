import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const properties = { GATEWAY_SHARED_SECRET: 'a'.repeat(64) };
const allowedUsers = ['U-member-1'];
const sandbox = {
  console,
  PropertiesService: { getScriptProperties: () => ({ getProperty: (key) => properties[key] || null }) },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  getSettingValues_: () => allowedUsers.slice(),
  getSheet_: () => ({ appendRow: (row) => allowedUsers.push(String(row[1])) }),
};
vm.createContext(sandbox);
for (const file of ['src/store.gs', 'src/main.gs']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), sandbox, { filename: file });
}
sandbox.getSettingValues_ = () => allowedUsers.slice();
sandbox.getSheet_ = () => ({ appendRow: (row) => allowedUsers.push(String(row[1])) });

test('GAS accepts only a correctly authenticated gateway envelope', () => {
  const lineBody = JSON.stringify({ destination: 'U-bot', events: [] });
  const valid = JSON.stringify({ gatewayToken: properties.GATEWAY_SHARED_SECRET, lineBody });
  assert.equal(sandbox.extractVerifiedLineBody_(valid), lineBody);
  assert.equal(sandbox.extractVerifiedLineBody_(JSON.stringify({ gatewayToken: 'wrong', lineBody })), null);
  assert.equal(sandbox.extractVerifiedLineBody_('{invalid-json'), null);
  assert.equal(sandbox.extractVerifiedLineBody_(JSON.stringify({ gatewayToken: properties.GATEWAY_SHARED_SECRET })), null);
});

test('allowlist admits at most two distinct LINE users', () => {
  assert.equal(sandbox.addAllowedUser_('U-member-1'), true);
  assert.equal(sandbox.addAllowedUser_('U-member-2'), true);
  assert.deepEqual(allowedUsers, ['U-member-1', 'U-member-2']);
  assert.equal(sandbox.addAllowedUser_('U-member-3'), false);
  assert.deepEqual(allowedUsers, ['U-member-1', 'U-member-2']);
  allowedUsers.push('U-stale-third-row');
  assert.equal(sandbox.isAllowedUser_('U-stale-third-row'), false);
});

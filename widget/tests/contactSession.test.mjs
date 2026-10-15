import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../src/contactSession.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022 } });
const { contactSessionKey, emptyContact, readContact, writeContact, clearContact, hasHandoffContact } =
  await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const storage = () => {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
};
const details = { name: 'Test Visitor', email: 'visitor@example.com', phone: '+919876543210', company: 'Test Company', customFields: { city: 'Pune' } };

test('restores all successful Quick Connect fields in the exact session', () => {
  const store = storage(), key = contactSessionKey('https://api.test', 'widget', 'session-a');
  writeContact(store, key, details, 1000);
  assert.deepEqual(readContact(store, key, 120000, 2000), details);
  assert.equal(hasHandoffContact(readContact(store, key, 120000, 2000)), true);
});
test('session, widget and API scopes cannot share contacts', () => {
  const store = storage(), key = contactSessionKey('https://api.test', 'widget', 'session-a');
  writeContact(store, key, details, 1000);
  for (const scope of [['https://api.test', 'widget', 'session-b'], ['https://api.test', 'other-widget', 'session-a'], ['https://other.test', 'widget', 'session-a']]) {
    assert.deepEqual(readContact(store, contactSessionKey(...scope), 120000, 2000), emptyContact());
  }
});
test('expires and removes PII at the inactivity boundary', () => {
  const store = storage();
  writeContact(store, 'contact', details, 1000);
  assert.deepEqual(readContact(store, 'contact', 120000, 121000), emptyContact());
  assert.equal(store.getItem('contact'), null);
});
test('activity renews the inactivity window; explicit reset removes contacts', () => {
  const store = storage();
  writeContact(store, 'contact', details, 1000);
  writeContact(store, 'contact', details, 100000);
  assert.deepEqual(readContact(store, 'contact', 120000, 121000), details);
  clearContact(store, 'contact');
  assert.deepEqual(readContact(store, 'contact', 120000, 121001), emptyContact());
});
test('corrupt/future-dated entries are cleared rather than reused', () => {
  const store = storage();
  store.setItem('contact', '{broken');
  assert.deepEqual(readContact(store, 'contact', 120000, 1000), emptyContact());
  assert.equal(store.getItem('contact'), null);
  writeContact(store, 'contact', details, 2000);
  assert.deepEqual(readContact(store, 'contact', 120000, 1000), emptyContact());
});
test('partial contacts only qualify for handoff when name and a contact method exist', () => {
  assert.equal(hasHandoffContact({ ...emptyContact(), name: 'Test', phone: '1234567890' }), true);
  assert.equal(hasHandoffContact({ ...emptyContact(), email: 'visitor@example.com' }), false);
  assert.equal(hasHandoffContact({ ...emptyContact(), name: 'Test' }), false);
});
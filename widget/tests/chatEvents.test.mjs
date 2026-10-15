import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
const source = readFileSync(new URL('../src/chatEvents.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022 } });
const { ChatEventDecoder, submittedContactMessages } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

test('retains trailing done metadata without a final blank line', () => {
  const decoder = new ChatEventDecoder();
  assert.deepEqual(decoder.push('data: {"type":"token","text":"Connecting"}\n\ndata: {"type":"done","handoff_chat_id":"h","handoff_status":"assigned"}'), [{ type: 'token', text: 'Connecting' }]);
  assert.deepEqual(decoder.push('', true), [{ type: 'done', handoff_chat_id: 'h', handoff_status: 'assigned' }]);
});
test('handles CRLF and chunk boundaries including multiline data', () => {
  const decoder = new ChatEventDecoder();
  assert.deepEqual(decoder.push('data: {"type":"done",\r\ndata: "handoff_status":"assigned"}\r'), []);
  assert.deepEqual(decoder.push('\n\r\n'), [{ type: 'done', handoff_status: 'assigned' }]);
});
test('ignores malformed frames without discarding later status', () => {
  assert.deepEqual(new ChatEventDecoder().push('event: ignored\n\ndata: bad\n\ndata: {"type":"done"}\n\n'), [{ type: 'done' }]);
});
test('all submitted contact fields become one readable user message', () => {
  assert.deepEqual(submittedContactMessages({ name: 'Ada', email: 'ada@example.com', phone: '1234567890', company: 'Visitor Co', customFields: { city: 'Pune', interest_stage: 'Qualified' } }), [
    'Quick Connect Details: Name: Ada | Email: ada@example.com | Phone: 1234567890 | Company: Visitor Co | Custom field "city": "Pune" | Custom field "interest_stage": "Qualified"',
  ]);
});
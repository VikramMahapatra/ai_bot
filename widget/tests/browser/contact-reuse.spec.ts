import { expect, test, Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const bundle = readFileSync(new URL('../../dist/chatbot-widget.iife.js', import.meta.url), 'utf8');
const origin = 'http://contact-reuse.test';
const contact = { name: 'Ada Visitor', email: 'ada@example.com', phone: '+919876543210', company: 'Visitor Co' };

async function fixture(page: Page) {
  const state = { turns: 0, lead: null as any, booking: null as any, handoff: 'none', failLead: false,
    delayLead: null as null | (() => Promise<void>), delayStream: null as null | (() => Promise<void>),
    framing: '\n\n', omitUiAction: false, omitDone: false, disablePolling: false,
    failStream: false, reopenForm: false,
    handoffItems: [] as Array<{ id: number; sender_type: string; message: string }>,
  };
  await page.route(`${origin}/**`, async route => {
    const url = new URL(route.request().url());
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><body><script>window.AIChatbot={widgetId:'contact-reuse-fixture',apiUrl:'${origin}'};</script><script src="/widget.js"></script></body></html>` });
    if (url.pathname === '/widget.js') return route.fulfill({ contentType: 'text/javascript', body: bundle });
    if (url.pathname.includes('/widget/config/')) return json({ lead_fields: JSON.stringify({ fields: [{ key: 'city', label: 'City', required: true }] }) });
    if (url.pathname === '/api/admin/leads') {
      const submitted = route.request().postDataJSON();
      if (state.delayLead) await state.delayLead();
      if (state.failLead) return json({ detail: 'Test failure' }, 500);
      state.lead = submitted;
      return json({ id: 1, ...submitted });
    }
    if (url.pathname === '/api/chat/appointments') {
      state.booking = route.request().postDataJSON();
      return json({ id: 1, ...state.booking, message: 'Appointment booked successfully.' });
    }
    if (url.pathname.includes('/should-capture-lead/')) return json({ should_capture: state.turns >= 3 && !state.lead });
    if (url.pathname === '/api/admin/handoff/handoff-test/accept') {
      state.handoff = 'assigned';
      return json({ chat_id: 'handoff-test', status: state.handoff, assigned_agent_id: 42 });
    }
    if (url.pathname === '/api/chat') {
      state.handoff = 'waiting_for_agent';
      return json({ response: 'Connecting you.', handoff_chat_id: 'handoff-test', handoff_status: state.handoff });
    }
    if (url.pathname === '/api/chat/stream') {
      if (state.failStream) return json({ detail: 'No stream' }, 503);
      const payload = route.request().postDataJSON();
      if (state.delayStream) await state.delayStream();
      state.turns++;
      const human = /human|agent|connect/i.test(payload.message);
      const alreadyActive = ['waiting_for_agent', 'assigned'].includes(state.handoff);
      if (human && !alreadyActive) state.handoff = 'waiting_for_agent';
      const handoffReply = human || alreadyActive;
      const done = handoffReply ? { type: 'done', ui_action: 'open_human_handoff', handoff_chat_id: 'handoff-test', handoff_status: state.handoff } : /meeting/i.test(payload.message) ? { type: 'done', ui_action: 'open_appointment_form' } : { type: 'done' };
      if (state.omitUiAction) delete (done as any).ui_action;
      if (state.reopenForm) (done as any).ui_action = 'open_lead_form';
      return route.fulfill({ contentType: 'text/event-stream', body: `${alreadyActive ? '' : `data: ${JSON.stringify({ type: 'token', text: human ? 'Connecting you.' : 'Test answer.' })}${state.framing || '\n\n'}`}${state.omitDone ? '' : `data: ${JSON.stringify(done)}${state.framing}`}` });
    }
    if (url.pathname === '/api/chat/handoff/session') return json(state.disablePolling || state.handoff === 'none' ? {} : { chat_id: 'handoff-test', status: state.handoff, assigned_agent_id: state.handoff === 'assigned' ? 42 : null, wait_timeout_seconds: 120 });
    if (url.pathname.includes('/handoff/') && url.pathname.endsWith('/messages')) return json({ status: state.handoff, items: state.handoffItems });
    return json({ items: [], questions: [] });
  });
  await page.goto(origin);
  await page.locator('.chat-launcher').click();
  return state;
}

async function send(page: Page, message: string) {
  await page.locator('.chatbot-widget-input').fill(message);
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(page.locator('.chatbot-widget-input:enabled, .chatbot-lead-bubble')).toHaveCount(1);
}

async function quickConnect(page: Page, phone = contact.phone) {
  for (const message of ['Hello there', 'Tell me more', 'What else?']) await send(page, message);
  await expect(page.getByText('Quick contact form', { exact: true })).toBeVisible();
  for (const [placeholder, value] of [['Name', contact.name], ['Email', contact.email], ['Phone', phone], ['Company', contact.company], ['City *', 'Pune']]) {
    await page.getByPlaceholder(placeholder, { exact: true }).fill(value);
  }
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  await expect(page.getByText('Thanks. Your details have been received. Let me know if you need any further assistance.', { exact: true })).toBeVisible();
}

test('three turns -> Quick Connect -> handoff -> meeting, without repeat contact prompts', async ({ page }) => {
  await page.clock.install();
  const state = await fixture(page);
  await quickConnect(page);
  await expect(page.locator('.chatbot-message.user').filter({ hasText: 'Quick Connect Details:' })).toHaveCount(1);
  await expect(page.getByText(`Quick Connect Details: Name: ${contact.name} | Email: ${contact.email} | Phone: ${contact.phone} | Company: ${contact.company} | Custom field "city": "Pune"`, { exact: true })).toBeVisible();
  expect(JSON.parse(state.lead.custom_fields)).toEqual({ city: 'Pune' });
  await send(page, 'connect me to a human agent');
  await expect(page.locator('.chatbot-lead-bubble')).toHaveCount(0);
  state.handoff = 'bot_active';
  await page.clock.runFor(1600);
  await expect(page.getByText('Welcome back from live support.', { exact: false })).toBeVisible();
  await send(page, 'yes, set up a meeting');
  await expect(page.getByText('Set up your meeting', { exact: true })).toBeVisible();
  await expect(page.getByPlaceholder('Full name', { exact: true })).toHaveCount(0);
  await expect(page.getByPlaceholder('Email address', { exact: true })).toHaveCount(0);
  await expect(page.getByPlaceholder('Mobile number', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Create meeting', exact: true }).click();
  await expect(page.getByText('Appointment booked successfully.', { exact: true })).toBeVisible();
  expect(state.booking).toMatchObject({ name: contact.name, email: contact.email, phone: contact.phone, session_id: state.lead.session_id });
});

test('reload restores contacts; explicit new chat clears all contact/date drafts', async ({ page }) => {
  const state = await fixture(page);
  await quickConnect(page);
  await page.reload();
  await page.locator('.chat-launcher').click();
  await page.getByRole('button', { name: 'Book appointment', exact: true }).click();
  await expect(page.getByPlaceholder('Full name', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'New chat', exact: true }).click();
  await page.getByRole('button', { name: 'Book appointment', exact: true }).click();
  await expect(page.getByPlaceholder('Full name', { exact: true })).toHaveValue('');
  await expect(page.getByPlaceholder('Email address', { exact: true })).toHaveValue('');
  await expect(page.getByPlaceholder('Mobile number', { exact: true })).toHaveValue('');
  expect(await page.evaluate(() => Object.keys(sessionStorage).filter(key => key.startsWith('chatbot_contact_')))).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem('chatbot_session_id_contact-reuse-fixture'))).not.toBe(state.lead.session_id);
});

test('partial contact asks only for the missing phone, and remembers it after booking', async ({ page }) => {
  const state = await fixture(page);
  await quickConnect(page, '');
  await page.getByRole('button', { name: 'Book appointment', exact: true }).click();
  await expect(page.getByPlaceholder('Full name', { exact: true })).toHaveCount(0);
  await expect(page.getByPlaceholder('Email address', { exact: true })).toHaveCount(0);
  await page.getByPlaceholder('Mobile number', { exact: true }).fill(contact.phone);
  await page.getByRole('button', { name: 'Create meeting', exact: true }).click();
  await expect(page.getByText('Appointment booked successfully.', { exact: true })).toBeVisible();
  expect(state.booking.phone).toBe(contact.phone);
  await page.getByRole('button', { name: 'Book appointment', exact: true }).click();
  await expect(page.getByPlaceholder('Mobile number', { exact: true })).toHaveCount(0);
});

test('inactivity expires contact cache and prevents booking from reusing old values', async ({ page }) => {
  await page.clock.install();
  await fixture(page);
  await quickConnect(page);
  await page.clock.runFor(120001);
  await expect(page.getByText('Closing this chat session', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Book appointment', exact: true }).click();
  await expect(page.getByPlaceholder('Full name', { exact: true })).toHaveValue('');
  expect(await page.evaluate(() => Object.keys(sessionStorage).filter(key => key.startsWith('chatbot_contact_')))).toEqual([]);
});

test('failed submission never caches contacts', async ({ page }) => {
  const state = await fixture(page);
  state.failLead = true;
  for (const message of ['Hello', 'More', 'Details']) await send(page, message);
  await page.getByPlaceholder('Name', { exact: true }).fill(contact.name);
  await page.getByPlaceholder('Email', { exact: true }).fill(contact.email);
  await page.getByPlaceholder('City *', { exact: true }).fill('Pune');
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  await expect(page.getByText('Sorry, failed to submit your details. Please try again.', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => Object.keys(sessionStorage).filter(key => key.startsWith('chatbot_contact_')))).toEqual([]);
});

test('late Quick Connect success cannot leak into a reset session', async ({ page }) => {
  const state = await fixture(page);
  let release!: () => void;
  state.delayLead = () => new Promise<void>(resolve => { release = resolve; });
  for (const message of ['Hello', 'More', 'Details']) await send(page, message);
  await page.getByPlaceholder('Name', { exact: true }).fill(contact.name);
  await page.getByPlaceholder('Email', { exact: true }).fill(contact.email);
  await page.getByPlaceholder('City *', { exact: true }).fill('Pune');
  const pending = page.waitForRequest(request => request.url().endsWith('/api/admin/leads'));
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  await pending;
  await page.getByRole('button', { name: 'New chat', exact: true }).click();
  const response = page.waitForResponse(response => response.url().endsWith('/api/admin/leads'));
  release();
  await response;
  await page.getByRole('button', { name: 'Book appointment', exact: true }).click();
  await expect(page.getByPlaceholder('Full name', { exact: true })).toHaveValue('');
  expect(await page.evaluate(() => Object.keys(sessionStorage).filter(key => key.startsWith('chatbot_contact_')))).toEqual([]);
});

test('invalid saved phone remains correctable rather than hiding a blocked field', async ({ page }) => {
  const state = await fixture(page);
  await quickConnect(page, '123');
  await page.getByRole('button', { name: 'Book appointment', exact: true }).click();
  await expect(page.getByPlaceholder('Full name', { exact: true })).toHaveCount(0);
  await page.getByPlaceholder('Mobile number', { exact: true }).fill(contact.phone);
  await page.getByRole('button', { name: 'Create meeting', exact: true }).click();
  await expect(page.getByText('Appointment booked successfully.', { exact: true })).toBeVisible();
  expect(state.booking.phone).toBe(contact.phone);
});

test('expired contacts on reload rotate the session instead of restoring PII', async ({ page }) => {
  const state = await fixture(page);
  await quickConnect(page);
  await page.evaluate(() => {
    for (const key of Object.keys(sessionStorage).filter(key => key.startsWith('chatbot_contact_'))) {
      const entry = JSON.parse(sessionStorage.getItem(key)!);
      entry.updatedAt = Date.now() - 120001;
      sessionStorage.setItem(key, JSON.stringify(entry));
    }
  });
  await page.reload();
  await page.locator('.chat-launcher').click();
  await page.getByRole('button', { name: 'Book appointment', exact: true }).click();
  await expect(page.getByPlaceholder('Full name', { exact: true })).toHaveValue('');
  expect(await page.evaluate(() => localStorage.getItem('chatbot_session_id_contact-reuse-fixture'))).not.toBe(state.lead.session_id);
});

test('late chat UI action cannot reopen a booking with the old session contact', async ({ page }) => {
  const state = await fixture(page);
  await quickConnect(page);
  let release!: () => void;
  state.delayStream = () => new Promise<void>(resolve => { release = resolve; });
  const pending = page.waitForRequest(request => request.url().endsWith('/api/chat/stream'));
  await page.locator('.chatbot-widget-input').fill('book a meeting');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await pending;
  await page.getByRole('button', { name: 'New chat', exact: true }).click();
  const response = page.waitForResponse(response => response.url().endsWith('/api/chat/stream'));
  release();
  await response;
  await page.getByRole('button', { name: 'Book appointment', exact: true }).click();
  await expect(page.getByPlaceholder('Full name', { exact: true })).toHaveValue('');
  expect(await page.evaluate(() => Object.keys(sessionStorage).filter(key => key.startsWith('chatbot_contact_')))).toEqual([]);
});

for (const framing of ['', '\r\n\r\n']) {
  test(`handoff header consumes metadata-only SSE with ${framing ? 'CRLF framing' : 'unterminated final event'}`, async ({ page }) => {
    const state = await fixture(page);
    await quickConnect(page);
    state.framing = framing;
    state.omitUiAction = true;
    state.disablePolling = true; // Prove the actual SSE handler, not the fallback.
    await send(page, 'can i have a live chat with human');
    await expect(page.getByRole('status')).toHaveText('Waiting for an agent');
    await expect(page.locator('.chatbot-handoff-slider')).toBeVisible();
  });
}

test('admin acceptance updates the embedded header and persists across reopen/reload', async ({ page }) => {
  await page.clock.install();
  const state = await fixture(page);
  await quickConnect(page);
  await send(page, 'can i have a live chat with human');
  await expect(page.getByRole('status')).toHaveText('Waiting for an agent');
  await page.evaluate(async () => { await fetch('/api/admin/handoff/handoff-test/accept', { method: 'POST' }); });
  await page.clock.runFor(1600);
  await expect(page.getByRole('status')).toHaveText('Agent connected');
  expect(state.handoff).toBe('assigned');
  await page.clock.runFor(120001);
  await expect(page.getByRole('status')).toHaveText('Agent connected');
  await expect(page.getByText('Closing this chat session', { exact: false })).toHaveCount(0);
  await page.getByRole('button', { name: 'Minimize chat', exact: true }).click();
  await page.locator('.chat-launcher').click();
  await expect(page.getByRole('status')).toHaveText('Agent connected');
  await page.reload();
  await page.locator('.chat-launcher').click();
  await expect(page.getByRole('status')).toHaveText('Agent connected');
});

test('polling discovers a real handoff even when the stream lost its done event', async ({ page }) => {
  const state = await fixture(page);
  await quickConnect(page);
  state.omitDone = true;
  await send(page, 'human agent please');
  await expect(page.getByRole('status')).toHaveText('Waiting for an agent');
  await page.evaluate(async () => { await fetch('/api/admin/handoff/handoff-test/accept', { method: 'POST' }); });
  await expect(page.getByRole('status')).toHaveText('Agent connected');
});

test('non-stream response metadata activates the same handoff header', async ({ page }) => {
  const state = await fixture(page);
  await quickConnect(page);
  state.failStream = true;
  state.disablePolling = true;
  await send(page, 'human agent please');
  await expect(page.getByRole('status')).toHaveText('Waiting for an agent');
});

test('form resubmission does not duplicate visible user field entries', async ({ page }) => {
  const state = await fixture(page);
  await quickConnect(page);
  state.reopenForm = true;
  await send(page, 'submit details again');
  await expect(page.getByRole('button', { name: 'Submit', exact: true })).toBeVisible();
  state.reopenForm = false;
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  await expect(page.locator('.chatbot-message.user').filter({ hasText: 'Quick Connect Details:' })).toHaveCount(1);
});

test('repeated handoff status polls and visitor followups do not repeat acknowledgements or internal audit messages', async ({ page }) => {
  await page.clock.install();
  const state = await fixture(page);
  await quickConnect(page);
  state.handoffItems = [
    { id: 1, sender_type: 'system', message: 'User requested a live agent directly.' },
    { id: 2, sender_type: 'system', message: 'A human handoff request has been created. Reason: user_requested_live_agent_directly' },
    { id: 3, sender_type: 'system', message: 'Saved visitor contact (session-scoped data): {}' },
  ];
  await send(page, 'human agent please');
  await expect(page.getByText('Connecting you.', { exact: true })).toHaveCount(1);
  await send(page, 'human agent please');
  await send(page, 'which additional detail');
  await page.clock.runFor(4600);
  await expect(page.getByText('Connecting you.', { exact: true })).toHaveCount(1);
  await expect(page.getByText('User requested a live agent directly.', { exact: true })).toHaveCount(0);
  await expect(page.getByText('I could not generate a response right now.', { exact: true })).toHaveCount(0);
  state.handoff = 'assigned';
  state.handoffItems.push({ id: 4, sender_type: 'agent', message: 'How can I help you today?' });
  await page.clock.runFor(4600);
  await expect(page.getByRole('status')).toHaveText('Agent connected');
  await expect(page.getByText('How can I help you today?', { exact: true })).toHaveCount(1);
  await page.getByRole('button', { name: 'Minimize chat', exact: true }).click();
  await page.locator('.chat-launcher').click();
  await page.clock.runFor(1600);
  await expect(page.getByText('How can I help you today?', { exact: true })).toHaveCount(1);
});
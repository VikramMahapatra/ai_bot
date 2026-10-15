const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, 'src/pages/CreateChatAgentPage.tsx'), 'utf8');
const tree = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const nodes = [];
function visit(node) {
  nodes.push(node);
  ts.forEachChild(node, visit);
}
visit(tree);
const loadingHook = nodes.find(node => ts.isCallExpression(node)
  && node.expression.getText(tree) === 'useEffect'
  && node.arguments[0].getText(tree).includes("qualificationTemplateService.list({ status: 'Active'"));
assert.ok(loadingHook);

function evaluate(expression, context) {
  const code = ts.transpileModule(`(${expression})`, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText;
  return vm.runInNewContext(code, context);
}
const flush = () => new Promise(resolve => setImmediate(resolve));

test('both chat selectors load active pending/failed local templates without shared lookup', async () => {
  const items = [
    { id: 1, name: 'Zen_template', status: 'Active', sync_status: 'pending', objective: 'Local objective', engine_template_id: null },
    { id: 2, name: 'Retry locally', status: 'Active', sync_status: 'failed', description: 'Description' },
    { id: 3, name: 'Inactive', status: 'Inactive', sync_status: 'synced' },
  ];
  let summaries, options;
  const loading = [];
  const hook = evaluate(loadingHook.arguments[0].getText(tree), {
    qualificationTemplateService: {
      list: params => {
        assert.equal(params.status, 'Active');
        assert.equal(params.limit, 100);
        return Promise.resolve({ items });
      },
      lookup: () => assert.fail('Chat must not use external synced lookup'),
    },
    setQualificationTemplates: value => { summaries = value; },
    setTemplates: value => { options = value; },
    setQualificationTemplatesLoading: value => loading.push(value),
    setError: () => assert.fail('Loading failed'),
  });
  hook();
  await flush();
  assert.deepEqual(Array.from(summaries, item => item.id), [1, 2]);
  assert.deepEqual(Array.from(options, item => item.id), [1, 2]);
  assert.equal(options[0].description, 'Local objective');
  assert.equal(options[1].description, 'Description');
  assert.equal(items[0].sync_status, 'pending');
  assert.equal(items[0].engine_template_id, null);
  assert.deepEqual(loading, [true, false]);
  assert.ok(!source.includes('qualificationTemplateService.lookup('));
  assert.ok(source.includes('{templates.map('));
  assert.ok(source.includes('{qualificationTemplates.map('));
});

test('unmounted template request cannot update either selector', async () => {
  let resolve;
  const updates = [];
  const hook = evaluate(loadingHook.arguments[0].getText(tree), {
    qualificationTemplateService: { list: () => new Promise(done => { resolve = done; }) },
    setQualificationTemplates: () => updates.push('summaries'),
    setTemplates: () => updates.push('options'),
    setQualificationTemplatesLoading: value => updates.push(value),
    setError: () => updates.push('error'),
  });
  const cleanup = hook();
  cleanup();
  resolve({ items: [] });
  await flush();
  assert.deepEqual(updates, [true]);
});

test('identity and conversation saves require a template, not engine synchronization', async () => {
  const save = nodes.find(node => ts.isVariableDeclaration(node) && node.name.getText(tree) === 'saveWidgetProfile');
  assert.ok(save && ts.isArrowFunction(save.initializer));
  const statements = save.initializer.body.statements;
  const prefix = [];
  for (const statement of statements) {
    if (statement.getText(tree).includes('const normalizedContactFields')) break;
    prefix.push(statement.getText(tree));
  }
  for (const nextStep of [1, 2]) {
    let errors;
    const context = {
      busy: false, widget: { name: 'Local agent' }, isEditMode: false,
      qualificationTemplateId: '', AGENT_STEP: { conversation: 1, knowledge: 2 },
      setErrors: value => { errors = value; },
    };
    const guard = evaluate(`async (nextStep) => { ${prefix.join('\n')} return 'eligible'; }`, context);
    assert.equal(await guard(nextStep), undefined);
    assert.match(errors.qualification_template_id, /select an active qualification template/);
    const selectedGuard = evaluate(`async (nextStep) => { ${prefix.join('\n')} return 'eligible'; }`, {
      ...context, qualificationTemplateId: 1,
    });
    assert.equal(await selectedGuard(nextStep), 'eligible');
    assert.equal(errors.qualification_template_id, '');
  }
});
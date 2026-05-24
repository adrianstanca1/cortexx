const assert = require('assert');
const {
  evaluateConditions,
  evaluateCondition,
  evaluateConditionGroup,
  getValueAtPath,
} = require('../lib/workflow/condition-evaluator');

async function runTests() {
  console.log('Running condition-evaluator tests...\n');

  // Test: getValueAtPath
  console.log('✓ getValueAtPath with simple path');
  let context = { type: 'change_order', amount: 1000 };
  assert.strictEqual(getValueAtPath(context, 'type'), 'change_order');
  assert.strictEqual(getValueAtPath(context, 'amount'), 1000);

  console.log('✓ getValueAtPath with nested path');
  context = { event: { type: 'change_order', details: { amount: 5000 } } };
  assert.strictEqual(getValueAtPath(context, 'event.type'), 'change_order');
  assert.strictEqual(getValueAtPath(context, 'event.details.amount'), 5000);

  console.log('✓ getValueAtPath returns undefined for missing path');
  context = { event: { type: 'test' } };
  assert.strictEqual(getValueAtPath(context, 'event.missing'), undefined);
  assert.strictEqual(getValueAtPath(context, 'missing.path'), undefined);

  // Test: evaluateCondition operators
  console.log('✓ evaluateCondition with eq operator');
  let cond = { operator: 'eq', path: 'type', value: 'change_order' };
  context = { type: 'change_order' };
  assert.strictEqual(evaluateCondition(cond, context), true);
  context = { type: 'work_order' };
  assert.strictEqual(evaluateCondition(cond, context), false);

  console.log('✓ evaluateCondition with neq operator');
  cond = { operator: 'neq', path: 'type', value: 'change_order' };
  context = { type: 'work_order' };
  assert.strictEqual(evaluateCondition(cond, context), true);

  console.log('✓ evaluateCondition with gt/gte/lt/lte operators');
  context = { amount: 1000 };
  assert.strictEqual(evaluateCondition({ operator: 'gt', path: 'amount', value: 900 }, context), true);
  assert.strictEqual(evaluateCondition({ operator: 'gt', path: 'amount', value: 1000 }, context), false);
  assert.strictEqual(evaluateCondition({ operator: 'gte', path: 'amount', value: 1000 }, context), true);
  assert.strictEqual(evaluateCondition({ operator: 'lt', path: 'amount', value: 1100 }, context), true);
  assert.strictEqual(evaluateCondition({ operator: 'lte', path: 'amount', value: 1000 }, context), true);

  console.log('✓ evaluateCondition with in operator');
  cond = { operator: 'in', path: 'type', value: ['change_order', 'work_order'] };
  context = { type: 'change_order' };
  assert.strictEqual(evaluateCondition(cond, context), true);
  context = { type: 'purchase_order' };
  assert.strictEqual(evaluateCondition(cond, context), false);

  console.log('✓ evaluateCondition with contains operator');
  cond = { operator: 'contains', path: 'description', value: 'urgent' };
  context = { description: 'This is an urgent request' };
  assert.strictEqual(evaluateCondition(cond, context), true);
  context = { description: 'Normal request' };
  assert.strictEqual(evaluateCondition(cond, context), false);

  console.log('✓ evaluateCondition with contains operator on array');
  cond = { operator: 'contains', path: 'tags', value: 'critical' };
  context = { tags: ['critical', 'urgent'] };
  assert.strictEqual(evaluateCondition(cond, context), true);
  context = { tags: ['normal', 'routine'] };
  assert.strictEqual(evaluateCondition(cond, context), false);

  console.log('✓ evaluateCondition with exists operator');
  cond = { operator: 'exists', path: 'amount', value: null };
  assert.strictEqual(evaluateCondition(cond, { amount: 1000 }), true);
  assert.strictEqual(evaluateCondition(cond, { amount: null }), false);
  assert.strictEqual(evaluateCondition(cond, {}), false);

  // Test: evaluateConditionGroup
  console.log('✓ evaluateConditionGroup with "all" mode');
  const conditions = [
    { operator: 'eq', path: 'type', value: 'change_order' },
    { operator: 'gt', path: 'amount', value: 500 },
  ];
  context = { type: 'change_order', amount: 1000 };
  assert.strictEqual(evaluateConditionGroup(conditions, context, 'all'), true);
  context = { type: 'work_order', amount: 1000 };
  assert.strictEqual(evaluateConditionGroup(conditions, context, 'all'), false);

  console.log('✓ evaluateConditionGroup with "any" mode');
  const conditions2 = [
    { operator: 'eq', path: 'type', value: 'change_order' },
    { operator: 'eq', path: 'type', value: 'work_order' },
  ];
  context = { type: 'purchase_order' };
  assert.strictEqual(evaluateConditionGroup(conditions2, context, 'any'), false);
  context = { type: 'change_order' };
  assert.strictEqual(evaluateConditionGroup(conditions2, context, 'any'), true);

  console.log('✓ evaluateConditionGroup with nested groups');
  const conditions3 = [
    {
      mode: 'any',
      conditions: [
        { operator: 'eq', path: 'type', value: 'change_order' },
        { operator: 'eq', path: 'type', value: 'work_order' },
      ],
    },
    { operator: 'gt', path: 'amount', value: 500 },
  ];
  context = { type: 'change_order', amount: 1000 };
  assert.strictEqual(evaluateConditionGroup(conditions3, context, 'all'), true);

  // Test: evaluateConditions
  console.log('✓ evaluateConditions returns true for null conditions');
  assert.strictEqual(evaluateConditions(null, {}), true);
  assert.strictEqual(evaluateConditions(undefined, {}), true);

  console.log('✓ evaluateConditions treats array as "all" mode by default');
  const arrayConditions = [
    { operator: 'eq', path: 'type', value: 'change_order' },
    { operator: 'gt', path: 'amount', value: 500 },
  ];
  context = { type: 'change_order', amount: 1000 };
  assert.strictEqual(evaluateConditions(arrayConditions, context), true);
  context = { type: 'work_order', amount: 1000 };
  assert.strictEqual(evaluateConditions(arrayConditions, context), false);

  console.log('✓ evaluateConditions respects explicit mode');
  const groupConditions = {
    mode: 'any',
    conditions: [
      { operator: 'eq', path: 'type', value: 'change_order' },
      { operator: 'eq', path: 'type', value: 'work_order' },
    ],
  };
  context = { type: 'purchase_order' };
  assert.strictEqual(evaluateConditions(groupConditions, context), false);
  context = { type: 'change_order' };
  assert.strictEqual(evaluateConditions(groupConditions, context), true);

  console.log('\n✅ All condition-evaluator tests passed!\n');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err.message);
  console.error(err.stack);
  process.exit(1);
});

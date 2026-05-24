const {
  evaluateConditions,
  evaluateCondition,
  evaluateConditionGroup,
  getValueAtPath,
} = require('../lib/workflow/condition-evaluator');

describe('condition-evaluator', () => {
  describe('getValueAtPath', () => {
    it('returns value at simple path', () => {
      const context = { type: 'change_order', amount: 1000 };
      expect(getValueAtPath(context, 'type')).toBe('change_order');
      expect(getValueAtPath(context, 'amount')).toBe(1000);
    });

    it('returns value at nested path', () => {
      const context = { event: { type: 'change_order', details: { amount: 5000 } } };
      expect(getValueAtPath(context, 'event.type')).toBe('change_order');
      expect(getValueAtPath(context, 'event.details.amount')).toBe(5000);
    });

    it('returns undefined for missing path', () => {
      const context = { event: { type: 'test' } };
      expect(getValueAtPath(context, 'event.missing')).toBeUndefined();
      expect(getValueAtPath(context, 'missing.path')).toBeUndefined();
    });

    it('handles null values safely', () => {
      const context = { event: null };
      expect(getValueAtPath(context, 'event.type')).toBeUndefined();
    });
  });

  describe('evaluateCondition', () => {
    describe('eq operator', () => {
      it('returns true when values match', () => {
        const cond = { operator: 'eq', path: 'type', value: 'change_order' };
        const context = { type: 'change_order' };
        expect(evaluateCondition(cond, context)).toBe(true);
      });

      it('returns false when values differ', () => {
        const cond = { operator: 'eq', path: 'type', value: 'change_order' };
        const context = { type: 'work_order' };
        expect(evaluateCondition(cond, context)).toBe(false);
      });
    });

    describe('neq operator', () => {
      it('returns true when values differ', () => {
        const cond = { operator: 'neq', path: 'type', value: 'change_order' };
        const context = { type: 'work_order' };
        expect(evaluateCondition(cond, context)).toBe(true);
      });

      it('returns false when values match', () => {
        const cond = { operator: 'neq', path: 'type', value: 'change_order' };
        const context = { type: 'change_order' };
        expect(evaluateCondition(cond, context)).toBe(false);
      });
    });

    describe('gt/gte/lt/lte operators', () => {
      const context = { amount: 1000 };

      it('gt: greater than', () => {
        expect(evaluateCondition({ operator: 'gt', path: 'amount', value: 900 }, context)).toBe(
          true
        );
        expect(evaluateCondition({ operator: 'gt', path: 'amount', value: 1000 }, context)).toBe(
          false
        );
      });

      it('gte: greater than or equal', () => {
        expect(evaluateCondition({ operator: 'gte', path: 'amount', value: 900 }, context)).toBe(
          true
        );
        expect(evaluateCondition({ operator: 'gte', path: 'amount', value: 1000 }, context)).toBe(
          true
        );
      });

      it('lt: less than', () => {
        expect(evaluateCondition({ operator: 'lt', path: 'amount', value: 1100 }, context)).toBe(
          true
        );
        expect(evaluateCondition({ operator: 'lt', path: 'amount', value: 1000 }, context)).toBe(
          false
        );
      });

      it('lte: less than or equal', () => {
        expect(evaluateCondition({ operator: 'lte', path: 'amount', value: 1100 }, context)).toBe(
          true
        );
        expect(evaluateCondition({ operator: 'lte', path: 'amount', value: 1000 }, context)).toBe(
          true
        );
      });
    });

    describe('in operator', () => {
      it('returns true if value is in array', () => {
        const cond = { operator: 'in', path: 'type', value: ['change_order', 'work_order'] };
        const context = { type: 'change_order' };
        expect(evaluateCondition(cond, context)).toBe(true);
      });

      it('returns false if value is not in array', () => {
        const cond = { operator: 'in', path: 'type', value: ['change_order', 'work_order'] };
        const context = { type: 'purchase_order' };
        expect(evaluateCondition(cond, context)).toBe(false);
      });
    });

    describe('contains operator', () => {
      it('returns true if string contains substring', () => {
        const cond = { operator: 'contains', path: 'description', value: 'urgent' };
        const context = { description: 'This is an urgent request' };
        expect(evaluateCondition(cond, context)).toBe(true);
      });

      it('returns false if string does not contain substring', () => {
        const cond = { operator: 'contains', path: 'description', value: 'urgent' };
        const context = { description: 'Normal request' };
        expect(evaluateCondition(cond, context)).toBe(false);
      });

      it('returns true if array contains element', () => {
        const cond = { operator: 'contains', path: 'tags', value: 'critical' };
        const context = { tags: ['critical', 'urgent'] };
        expect(evaluateCondition(cond, context)).toBe(true);
      });

      it('returns false if array does not contain element', () => {
        const cond = { operator: 'contains', path: 'tags', value: 'critical' };
        const context = { tags: ['normal', 'routine'] };
        expect(evaluateCondition(cond, context)).toBe(false);
      });
    });

    describe('exists operator', () => {
      it('returns true if path exists and is not null/undefined', () => {
        const cond = { operator: 'exists', path: 'amount', value: null };
        expect(evaluateCondition(cond, { amount: 1000 })).toBe(true);
        expect(evaluateCondition(cond, { amount: 0 })).toBe(true);
        expect(evaluateCondition(cond, { amount: '' })).toBe(true);
      });

      it('returns false if path is null or undefined', () => {
        const cond = { operator: 'exists', path: 'amount', value: null };
        expect(evaluateCondition(cond, { amount: null })).toBe(false);
        expect(evaluateCondition(cond, { amount: undefined })).toBe(false);
        expect(evaluateCondition(cond, {})).toBe(false);
      });
    });

    describe('unknown operator', () => {
      it('returns false and logs warning', () => {
        const cond = { operator: 'unknown_op', path: 'type', value: 'test' };
        const context = { type: 'test' };
        expect(evaluateCondition(cond, context)).toBe(false);
      });
    });
  });

  describe('evaluateConditionGroup', () => {
    it('returns true for empty conditions array', () => {
      expect(evaluateConditionGroup([], {}, 'all')).toBe(true);
    });

    it('combines conditions with "all" (AND) mode', () => {
      const conditions = [
        { operator: 'eq', path: 'type', value: 'change_order' },
        { operator: 'gt', path: 'amount', value: 500 },
      ];
      const context = { type: 'change_order', amount: 1000 };
      expect(evaluateConditionGroup(conditions, context, 'all')).toBe(true);

      // Fails if any condition fails
      const context2 = { type: 'work_order', amount: 1000 };
      expect(evaluateConditionGroup(conditions, context2, 'all')).toBe(false);
    });

    it('combines conditions with "any" (OR) mode', () => {
      const conditions = [
        { operator: 'eq', path: 'type', value: 'change_order' },
        { operator: 'eq', path: 'type', value: 'work_order' },
      ];
      const context = { type: 'purchase_order' };
      expect(evaluateConditionGroup(conditions, context, 'any')).toBe(false);

      // Passes if any condition passes
      const context2 = { type: 'change_order' };
      expect(evaluateConditionGroup(conditions, context2, 'any')).toBe(true);
    });

    it('handles nested condition groups', () => {
      const conditions = [
        {
          mode: 'any',
          conditions: [
            { operator: 'eq', path: 'type', value: 'change_order' },
            { operator: 'eq', path: 'type', value: 'work_order' },
          ],
        },
        { operator: 'gt', path: 'amount', value: 500 },
      ];
      const context = { type: 'change_order', amount: 1000 };
      expect(evaluateConditionGroup(conditions, context, 'all')).toBe(true);

      // Fails if nested group fails
      const context2 = { type: 'purchase_order', amount: 1000 };
      expect(evaluateConditionGroup(conditions, context2, 'all')).toBe(false);
    });
  });

  describe('evaluateConditions', () => {
    it('returns true for null/undefined conditions', () => {
      expect(evaluateConditions(null, {})).toBe(true);
      expect(evaluateConditions(undefined, {})).toBe(true);
    });

    it('treats array as "all" mode by default', () => {
      const conditions = [
        { operator: 'eq', path: 'type', value: 'change_order' },
        { operator: 'gt', path: 'amount', value: 500 },
      ];
      const context = { type: 'change_order', amount: 1000 };
      expect(evaluateConditions(conditions, context)).toBe(true);

      const context2 = { type: 'work_order', amount: 1000 };
      expect(evaluateConditions(conditions, context2)).toBe(false);
    });

    it('respects explicit mode in condition group object', () => {
      const conditions = {
        mode: 'any',
        conditions: [
          { operator: 'eq', path: 'type', value: 'change_order' },
          { operator: 'eq', path: 'type', value: 'work_order' },
        ],
      };
      const context = { type: 'purchase_order' };
      expect(evaluateConditions(conditions, context)).toBe(false);

      const context2 = { type: 'change_order' };
      expect(evaluateConditions(conditions, context2)).toBe(true);
    });

    it('handles real workflow condition example', () => {
      const conditions = [
        { operator: 'eq', path: 'event.type', value: 'autoimprove.suggestion' },
        { operator: 'gte', path: 'event.severity_score', value: 7 },
      ];
      const context = {
        event: {
          type: 'autoimprove.suggestion',
          severity_score: 8,
        },
      };
      expect(evaluateConditions(conditions, context)).toBe(true);

      const context2 = {
        event: {
          type: 'autoimprove.suggestion',
          severity_score: 5,
        },
      };
      expect(evaluateConditions(conditions, context2)).toBe(false);
    });
  });
});

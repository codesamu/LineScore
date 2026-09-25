const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateScore } = require('../scoring');

test('disabled overall judge preserves the normal result', () => {
  assert.deepEqual(calculateScore({ scores: [10, 20], overallScores: [90, 100], overallJudgeEnabled: false }), {
    total: 30,
    overallScore: null
  });
});

test('enabled overall judge adds the average of all overall fields', () => {
  assert.deepEqual(calculateScore({ scores: [10, 20], overallScores: [90, 80, 85], overallJudgeEnabled: true }), {
    total: 115,
    overallScore: 85
  });
});

test('missing overall submissions do not crash or become NaN', () => {
  assert.deepEqual(calculateScore({ scores: [10], overallScores: [null, undefined, 'bad'], overallJudgeEnabled: true }), {
    total: 10,
    overallScore: null
  });
});

test('overall average keeps two decimal places', () => {
  assert.equal(calculateScore({ scores: [], overallScores: [10, 11, 12], overallJudgeEnabled: true }).overallScore, 11);
  assert.equal(calculateScore({ scores: [], overallScores: [10, 11], overallJudgeEnabled: true }).overallScore, 10.5);
});

import assert from 'node:assert/strict';
import {
  formatInsuranceValidity,
  INSURANCE_INVALID_DATE_TOKEN,
} from './formatInsuranceValidity.ts';

assert.equal(formatInsuranceValidity(''), null);
assert.equal(formatInsuranceValidity(undefined), null);
assert.equal(formatInsuranceValidity('2020-01-15', 2022), INSURANCE_INVALID_DATE_TOKEN);
assert.match(formatInsuranceValidity('2030-06-01', 2020) || '', /2030/);
assert.equal(formatInsuranceValidity('Comprehensive'), 'Comprehensive');

console.log('formatInsuranceValidity.check.ts: ok');

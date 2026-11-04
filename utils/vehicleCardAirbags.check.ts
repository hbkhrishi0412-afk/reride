/**
 * Run: npx tsx utils/vehicleCardAirbags.check.ts
 */
import { airbagLabel } from './vehicleCardAirbags.js';

const cases: Array<[string[] | undefined, string | null]> = [
  [undefined, null],
  [[], null],
  [['Power Steering', '6 Airbags'], '6 Airbags'],
  [['Dual Airbags'], 'Dual Airbags'],
  [['Airbags x 2'], '2 Airbags'],
  [['Side Airbag'], 'Side Airbag'],
  [['ABS'], null],
];

for (const [input, expected] of cases) {
  const got = airbagLabel(input);
  if (got !== expected) {
    console.error('FAIL', input, '→', got, 'expected', expected);
    process.exit(1);
  }
}
console.log('vehicleCardAirbags.check: ok');

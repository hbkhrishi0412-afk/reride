import { formatIndianNumberInput, parseIndianNumberDigits } from '../utils/indianNumberInput';

describe('indianNumberInput', () => {
  it('round-trips Indian-grouped display without truncating on parse', () => {
    const raw = '1250000';
    const displayed = formatIndianNumberInput(raw);
    expect(displayed).toBe('12,50,000');
    // Bug: parseFloat(displayed) === 12. Digits must be stripped first.
    expect(parseFloat(displayed)).toBe(12);
    expect(Number(parseIndianNumberDigits(displayed))).toBe(1250000);

    const kmDisplay = formatIndianNumberInput('45000');
    expect(kmDisplay).toBe('45,000');
    expect(parseInt(kmDisplay, 10)).toBe(45);
    expect(Number(parseIndianNumberDigits(kmDisplay))).toBe(45000);
  });
});

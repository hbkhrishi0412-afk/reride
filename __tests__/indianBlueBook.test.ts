import { parseIndianBlueBookResponse } from '../lib/indianBlueBook';

describe('Indian Blue Book response parsing', () => {
  it('parses standard IBB fair market value fields', () => {
    const result = parseIndianBlueBookResponse({
      data: {
        fairMarketValue: 1050000,
        minPrice: 980000,
        maxPrice: 1120000,
        onRoadPrice: 1580000,
      },
    });

    expect(result).not.toBeNull();
    expect(result!.source).toBe('ibb');
    expect(result!.usedFairAverage).toBe(1050000);
    expect(result!.usedFairLow).toBe(980000);
    expect(result!.usedFairHigh).toBe(1120000);
    expect(result!.newOnRoadPrice).toBe(1580000);
  });

  it('parses alternate ibb_price field names', () => {
    const result = parseIndianBlueBookResponse({
      ibb_price: 875000,
      lower_price: 800000,
      upper_price: 950000,
    });

    expect(result!.usedFairAverage).toBe(875000);
    expect(result!.usedFairLow).toBe(800000);
    expect(result!.usedFairHigh).toBe(950000);
  });
});

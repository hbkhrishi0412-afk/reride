import { parseSurepassValuationResponse } from '../lib/surepassVehiclePricing';

describe('Surepass valuation parsing', () => {
  it('parses IDV calculator response', () => {
    const result = parseSurepassValuationResponse({
      success: true,
      status_code: 200,
      data: {
        idv: 1080000,
        idv_value: 1080000,
        registration_year: 2022,
        make: 'Hyundai',
        model: 'Verna',
      },
    });

    expect(result).not.toBeNull();
    expect(result!.source).toBe('surepass');
    expect(result!.usedFairAverage).toBe(1080000);
    expect(result!.usedFairLow).toBe(972000);
    expect(result!.usedFairHigh).toBe(1188000);
  });

  it('parses vehicle price check with on-road price', () => {
    const result = parseSurepassValuationResponse({
      data: {
        on_road_price: 1580000,
        ex_showroom_price: 1420000,
      },
    });

    expect(result!.newOnRoadPrice).toBe(1580000);
    expect(result!.usedFairAverage).toBeGreaterThan(0);
  });

  it('parses RC-to-IDV response fields', () => {
    const result = parseSurepassValuationResponse({
      data: {
        insured_declared_value: 950000,
        min_price: 900000,
        max_price: 1000000,
      },
    });

    expect(result!.usedFairAverage).toBe(950000);
    expect(result!.usedFairLow).toBe(900000);
    expect(result!.usedFairHigh).toBe(1000000);
  });
});

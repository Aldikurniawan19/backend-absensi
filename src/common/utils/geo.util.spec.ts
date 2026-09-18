import { hitungJarakMeter } from './geo.util';

describe('Geo Utilities (Haversine Formula)', () => {
  it('harus menghasilkan 0 meter untuk dua koordinat yang identik', () => {
    const lat = -6.1685;
    const lng = 106.837;
    expect(hitungJarakMeter(lat, lng, lat, lng)).toBeCloseTo(0, 1);
  });

  it('harus menghitung jarak koordinat dengan akurat', () => {
    // Monas (-6.1754, 106.8272) ke Masjid Istiqlal (-6.1702, 106.8317) ~ 750-850 meter
    const jarak = hitungJarakMeter(-6.1754, 106.8272, -6.1702, 106.8317);
    expect(jarak).toBeGreaterThan(700);
    expect(jarak).toBeLessThan(900);
  });
});

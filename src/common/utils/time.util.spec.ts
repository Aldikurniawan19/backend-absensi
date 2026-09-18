import { isTimeOverlapping, timeToMinutes } from './time.util';

describe('Time Utilities (Clash Detector)', () => {
  it('harus mengonversi string waktu HH:mm ke menit dari 00:00 dengan benar', () => {
    expect(timeToMinutes('00:00')).toBe(0);
    expect(timeToMinutes('07:30')).toBe(450);
    expect(timeToMinutes('09:00')).toBe(540);
    expect(timeToMinutes('23:59')).toBe(1439);
  });

  it('harus melempar error jika format waktu tidak valid', () => {
    expect(() => timeToMinutes('invalid')).toThrow();
  });

  it('harus mendeteksi rentang waktu yang tumpang tindih (overlap)', () => {
    // Overlap penuh / sebagian
    expect(isTimeOverlapping('07:30', '09:00', '08:00', '09:30')).toBe(true);
    expect(isTimeOverlapping('08:00', '09:30', '07:30', '09:00')).toBe(true);
    expect(isTimeOverlapping('07:30', '10:00', '08:00', '09:00')).toBe(true);
    expect(isTimeOverlapping('08:00', '09:00', '07:30', '10:00')).toBe(true);
  });

  it('harus mendeteksi rentang waktu yang bersambungan tanpa overlap (tidak bentrok)', () => {
    // Sesi 1 selesai jam 09:00, Sesi 2 mulai tepat jam 09:00 -> Tidak tumpang tindih
    expect(isTimeOverlapping('07:30', '09:00', '09:00', '10:30')).toBe(false);
    expect(isTimeOverlapping('09:00', '10:30', '07:30', '09:00')).toBe(false);
    expect(isTimeOverlapping('07:00', '08:00', '10:00', '11:00')).toBe(false);
  });
});

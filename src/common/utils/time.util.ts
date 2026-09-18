/**
 * Mengubah string waktu "HH:mm" menjadi jumlah menit dari tengah malam (00:00).
 * Contoh: "07:30" -> 450
 */
export function timeToMinutes(timeStr: string): number {
  const parts = timeStr.trim().split(':');
  if (parts.length < 2) {
    throw new Error(`Format waktu tidak valid: ${timeStr}. Gunakan format HH:mm`);
  }
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  return hours * 60 + minutes;
}

/**
 * Mengecek apakah dua rentang waktu tumpang tindih (overlap).
 * Rentang [mulai1, selesai1] dan [mulai2, selesai2] overlap jika mulai1 < selesai2 DAN mulai2 < selesai1.
 */
export function isTimeOverlapping(
  mulai1: string,
  selesai1: string,
  mulai2: string,
  selesai2: string,
): boolean {
  const m1 = timeToMinutes(mulai1);
  const s1 = timeToMinutes(selesai1);
  const m2 = timeToMinutes(mulai2);
  const s2 = timeToMinutes(selesai2);

  return m1 < s2 && m2 < s1;
}

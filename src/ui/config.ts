import data from '../data/ui.json';

/** Semua teks dan angka UI dari src/data/ui.json. */
export const UI: typeof data = data;

/** Mengganti {a}, {b}, ... di sebuah pola dengan nilai. */
export function isiPola(pola: string, nilai: Record<string, string | number>): string {
  return pola.replace(/\{(\w+)\}/g, (_, k: string) => String(nilai[k] ?? ''));
}

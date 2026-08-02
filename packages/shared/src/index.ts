// Shared constants
export const CURRENCIES = ['DJF', 'USD', 'EUR'] as const;
export const LANGUAGES = ['FR', 'AR', 'EN', 'SO'] as const;
export const COUNTRIES = { DJ: 'Djibouti', ET: 'Éthiopie', ER: 'Érythrée', SO: 'Somalie', YE: 'Yémen' };

// Notary fee calculation (simplified Djibouti rates)
export function calculateNotaryFees(propertyValue: number, type: string): number {
  let rate = 0.03; // 3% default
  if (type === 'SALE') rate = 0.025;
  if (type === 'MORTGAGE') rate = 0.015;
  if (type === 'DONATION') rate = 0.02;
  return Math.max(propertyValue * rate, 10000); // min 10,000 DJF
}

// Format Djibouti phone number
export function formatDjiboutiPhone(phone: string): string {
  const clean = phone.replace(/\D/g, '');
  if (clean.startsWith('253')) return `+${clean}`;
  if (clean.startsWith('77') || clean.startsWith('21')) return `+253${clean}`;
  return phone;
}

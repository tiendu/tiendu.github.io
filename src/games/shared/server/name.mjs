export function cleanName(value) {
  if (typeof value !== 'string') return '';
  const name = value.normalize('NFC').replace(/[\p{Cc}\p{Cf}]/gu, '').trim().replace(/\s+/g, ' ');
  return [...name].length <= 16 ? name : '';
}

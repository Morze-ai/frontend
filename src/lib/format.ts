export function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('pl-PL', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export function sliderLabel(value: number) {
  if (value === 0) return '▶ Bieżąca godzina';
  if (value < 0) return `↩ ${Math.abs(value)}h temu`;
  return `↦ Prognoza za ${value}h`;
}

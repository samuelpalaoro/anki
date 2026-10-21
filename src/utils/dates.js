/**
 * Centralized date calculation and manipulation utilities.
 * Keeps business logic pure and timezone/clock injectable.
 */

/**
 * Returns current ISO 8601 string given a clock or Date instance
 * @param {Date|number|string} [clock]
 * @returns {string}
 */
export function toISOString(clock = new Date()) {
  const d = clock instanceof Date ? clock : new Date(clock);
  if (isNaN(d.getTime())) {
    throw new Error('Data inválida fornecida.');
  }
  return d.toISOString();
}

/**
 * Adds whole or fractional days to a given reference date
 * @param {Date|string|number} baseDate
 * @param {number} days
 * @returns {string} ISO 8601 string
 */
export function addDays(baseDate, days) {
  const d = new Date(baseDate);
  if (isNaN(d.getTime())) {
    throw new Error('Data base inválida.');
  }
  const ms = Math.round(days * 24 * 60 * 60 * 1000);
  return new Date(d.getTime() + ms).toISOString();
}

/**
 * Checks if a due date is due relative to current clock
 * @param {string} dueAtISO
 * @param {Date|string|number} [now]
 * @returns {boolean}
 */
export function isDue(dueAtISO, now = new Date()) {
  const dueTime = new Date(dueAtISO).getTime();
  const currentTime = new Date(now).getTime();
  return dueTime <= currentTime;
}

/**
 * Checks if two ISO strings fall on the same calendar day in local timezone
 * @param {string} isoA
 * @param {Date|string|number} [isoB]
 * @returns {boolean}
 */
export function isSameDay(isoA, isoB = new Date()) {
  const dA = new Date(isoA);
  const dB = new Date(isoB);
  return (
    dA.getFullYear() === dB.getFullYear() &&
    dA.getMonth() === dB.getMonth() &&
    dA.getDate() === dB.getDate()
  );
}

/**
 * Formats ISO date to human friendly relative or short representation
 * @param {string} isoString
 * @param {Date|string|number} [now]
 * @returns {string}
 */
export function formatFriendlyDate(isoString, now = new Date()) {
  if (!isoString) return 'Nunca';
  const target = new Date(isoString);
  const current = new Date(now);
  const diffHours = (target.getTime() - current.getTime()) / (1000 * 60 * 60);

  if (Math.abs(diffHours) < 1) {
    const mins = Math.round(diffHours * 60);
    if (mins <= 0) return 'Agora';
    return `Em ${mins} min`;
  }
  if (diffHours < 0 && Math.abs(diffHours) < 24 && isSameDay(target, current)) {
    return 'Hoje';
  }
  const diffDays = Math.round(diffHours / 24);
  if (diffDays === 0) return 'Hoje';
  if (diffDays === 1) return 'Amanhã';
  if (diffDays === -1) return 'Ontem';
  if (diffDays > 1 && diffDays <= 30) return `Em ${diffDays} dias`;
  if (diffDays < -1 && diffDays >= -30) return `${Math.abs(diffDays)} dias atrás`;

  return target.toLocaleDateString('pt-BR');
}

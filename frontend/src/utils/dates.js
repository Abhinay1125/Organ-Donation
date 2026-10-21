const HAS_ZONE = /([zZ]|[+-]\d{2}:?\d{2})$/;

export const parseServerDate = (value) => {
  if (!value) return null;
  const s = String(value);
  const d = new Date(HAS_ZONE.test(s) ? s : `${s}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const formatDateTime = (value) => {
  const d = parseServerDate(value);
  if (!d) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false, timeZoneName: 'short',
  }).format(d);
};
// Display formatting helpers shared between server and client.
// Timezone matches the workspace locale (Europe/Warsaw).

export const TZ = 'Europe/Warsaw';

const PALETTE = ['#5c72e5', '#d89536', '#4ca982', '#8b72d9', '#e2786e', '#44a793', '#5369df', '#d99a42'];

export function pickColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'U';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

export function formatBudget(value: number | null | undefined): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function ymd(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export function formatDue(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const due = new Date(`${dateStr}T12:00:00Z`);
  if (Number.isNaN(due.getTime())) return '';
  const today = ymd(new Date());
  const tomorrow = ymd(new Date(Date.now() + 86_400_000));
  const d = ymd(due);
  if (d === today) return 'Today';
  if (d === tomorrow) return 'Tomorrow';
  return new Intl.DateTimeFormat('en-US', { timeZone: TZ, month: 'short', day: 'numeric' }).format(due);
}

export function getTodayLabel(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(d);
}

export function getGreeting(name: string, d: Date = new Date()): string {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', hour12: false }).format(d),
  );
  const part = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  return `${part}, ${name.split(' ')[0] || 'there'}`;
}

export function slugify(input: string): string {
  const slug = input.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug || 'workspace';
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function getFileIcon(mimeType: string | null): string {
  if (!mimeType) return '📄';
  const type = mimeType.split('/')[0];
  switch (type) {
    case 'image': return '🖼️';
    case 'video': return '🎬';
    case 'audio': return '🎵';
    case 'application': {
      const subtype = mimeType.split('/')[1];
      if (subtype?.includes('pdf')) return '📕';
      if (subtype?.includes('word') || subtype?.includes('document')) return '📘';
      if (subtype?.includes('excel') || subtype?.includes('spreadsheet')) return '📗';
      if (subtype?.includes('powerpoint') || subtype?.includes('presentation')) return '📙';
      if (subtype?.includes('zip') || subtype?.includes('compressed')) return '📦';
      return '📄';
    }
    case 'text': return '📝';
    default: return '📄';
  }
}

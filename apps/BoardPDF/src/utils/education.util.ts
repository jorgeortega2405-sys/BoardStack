const ACADEMIC_PATTERNS: RegExp[] = [
  /\.edu$/i,
  /\.edu\.[a-z]{2}$/i,
  /\.ac\.[a-z]{2}$/i,
  /\.escolar\.[a-z]{2}$/i,
  /@([a-z0-9\-]+\.)*nuevaescuela\.mx$/i,
  /@([a-z0-9\-]+\.)*educa\.[a-z]{2,5}$/i,
  /@([a-z0-9\-]+\.)*k12\.[a-z]{2}$/i,
];

export function isAcademicEmail(email: string): boolean {
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return false;
  }
  const clean = email.trim().toLowerCase();
  return ACADEMIC_PATTERNS.some((pattern) => pattern.test(clean));
}

export function extractDomain(email: string): string {
  if (!email || !email.includes('@')) {
    return '';
  }
  return email.split('@')[1]?.toLowerCase().trim() || '';
}

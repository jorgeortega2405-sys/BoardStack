const ACADEMIC_PATTERNS: RegExp[] = [
  /\.edu(\.[a-z]{2,3})?$/i,
  /\.ac(\.[a-z]{2,3})?$/i,
  /\.sch\.[a-z]{2,3}$/i,
  /\.escolar\.[a-z]{2,3}$/i,
  /\.ed\.[a-z]{2,3}$/i,
  /\.res\.[a-z]{2,3}$/i,
  /\.(college|university|academy|education)$/i,
  /\.k12(\.[a-z]{2,3})?$/i,
  /\.k12\.[a-z]{2}\.us$/i,
  /@([a-z0-9\-]+\.)*(unam|ipn|itesm|uam|ibero|anahuac|cinvestav|colmex|udg|uanl|buap|uv|uaemex|uaslp|uson|uabc|uach|ujat|uady|uaeh|uaa|uaq|tecnm|iteso|nuevaescuela)\.mx$/i,
  /@([a-z0-9\-]+\.)*(gva\.es|xtec\.cat|educa\.madrid\.org|juntadeandalucia\.es|educantabria\.es|educa\.aragon\.es|educacyl\.jcyl\.es|educarex\.es|educacion\.navarra\.es|euskadi\.eus)$/i,
  /@([a-z0-9\-]+\.)*(univ-[a-z0-9\-]+\.fr|u-[a-z0-9\-]+\.fr|uni-[a-z0-9\-]+\.de|sorbonne-universite\.fr)$/i,
  /@([a-z0-9\-]+\.)*educa\.[a-z]{2,5}$/i,
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

/**
 * Gera um código de barras EAN-13 válido a partir de um seed (nome do produto + variação).
 * Formato: 2-digit prefix + 9-digit serial + 1 check digit = 12 digits (EAN-13 usa 13 com o check).
 * Prefixo por origem: 01=Próprio, 02=Shopee, 03=TikTok, 04=Outro
 */
export function generateBarCode(seed: string, prefix = '01'): string {
  // Gera hash numérico simples a partir da string
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  hash = Math.abs(hash);

  // Prefixo (2 dígitos) + hash serializado (9 dígitos) = 11 dígitos base
  const base = (prefix + String(hash).padStart(9, '0').slice(0, 9)).slice(0, 11);

  // Calcula check digit EAN-13
  const digits = base.split('').map(Number);
  const sum = digits.reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 1 : 3), 0);
  const check = (10 - (sum % 10)) % 10;

  return base + check;
}

/**
 * Gera código de barras único para uma variação de produto.
 * Combina nome + tamanho + cor como seed.
 */
export function generateVariationBarCode(produto: string, tamanho: string, cor: string): string {
  const seed = `${produto}-${tamanho}-${cor}`.toLowerCase().trim();
  return generateBarCode(seed);
}

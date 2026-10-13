// Подпись HTTP-уведомления ЮMoney (параметр sign, HMAC-SHA256).
// Строка: все параметры кроме sign, по алфавиту, значения в URL-кодировке RFC 3986, через &.
// https://yoomoney.ru/docs/payment-buttons/using-api/notifications

// encodeURIComponent оставляет !'()* как есть, а RFC 3986 их кодирует
const rfc3986 = (v) => encodeURIComponent(v).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());

export function signedString(params) {
  return Object.keys(params)
    .filter((k) => k !== 'sign')
    .sort()
    .map((k) => `${k}=${rfc3986(params[k] ?? '')}`)
    .join('&');
}

// true, если sign совпал. Сверяет crypto.subtle.verify: сравнение за постоянное время.
export async function verifySign(params, secret) {
  const sign = params.sign;
  if (!secret || typeof sign !== 'string' || !/^[0-9a-f]{64}$/i.test(sign)) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const mac = Uint8Array.from(sign.match(/../g), (h) => parseInt(h, 16));
  return crypto.subtle.verify('HMAC', key, mac, enc.encode(signedString(params)));
}

export const isValidCuil = (raw: string): boolean => {
  const s = raw.replace(/\D/g, '');
  if (s.length !== 11) return false;
  const prefix = s.slice(0, 2);
  if (!['20', '23', '24', '25', '26', '27', '30', '33', '34'].includes(prefix)) return false;
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(s[i]) * weights[i];
  const resto = sum % 11;
  const dv = resto === 0 ? 0 : resto === 1 ? 9 : 11 - resto;
  return dv === Number(s[10]);
};

export const formatCuil = (raw: string): string => {
  const s = (raw || '').replace(/\D/g, '');
  if (s.length !== 11) return raw || '';
  return `${s.slice(0, 2)}-${s.slice(2, 10)}-${s.slice(10)}`;
};

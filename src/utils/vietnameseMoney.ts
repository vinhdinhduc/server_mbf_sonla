const digit = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
function three(value: number, full: boolean): string {
  const hundreds = Math.floor(value / 100);
  const tens = Math.floor(value / 10) % 10;
  const units = value % 10;
  const words: string[] = [];
  if (hundreds || full) words.push(`${digit[hundreds]} trăm`);
  if (tens >= 2) words.push(`${digit[tens]} mươi`);
  else if (tens === 1) words.push('mười');
  else if (units && (hundreds || full)) words.push('lẻ');
  if (units) {
    if (units === 1 && tens >= 2) words.push('mốt');
    else if (units === 5 && tens >= 1) words.push('lăm');
    else words.push(digit[units]);
  }
  return words.join(' ');
}
export function vietnameseMoney(value: number): string {
  if (!Number.isSafeInteger(value) || value < 0 || value > 999_999_999_999) throw new Error('Số tiền không hợp lệ');
  if (value === 0) return 'Không đồng';
  const groups: number[] = [];
  for (let number = value; number > 0; number = Math.floor(number / 1000)) groups.push(number % 1000);
  const units = ['', 'nghìn', 'triệu', 'tỷ'];
  const words = groups.map((group, index) => group ? `${three(group, index < groups.length - 1 && group < 100)} ${units[index]}`.trim() : '').reverse().filter(Boolean).join(' ');
  return `${words.charAt(0).toUpperCase()}${words.slice(1)} đồng`;
}

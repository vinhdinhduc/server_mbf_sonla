/**
 * Tra ve thoi diem hien tai theo timezone Asia/Ho_Chi_Minh, KHONG dung UTC
 * mac dinh cua server (bat buoc theo muc 9).
 */
export function nowInVietnam(): Date {
  const now = new Date();
  const vnString = now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' });
  return new Date(vnString);
}

export function todayDateStringVietnam(): string {
  const vn = nowInVietnam();
  const yyyy = vn.getFullYear();
  const mm = String(vn.getMonth() + 1).padStart(2, '0');
  const dd = String(vn.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** Tra ve gio hien tai dang HH:mm:ss theo timezone Viet Nam, dung de so sanh voi cot TIME */
export function currentTimeStringVietnam(): string {
  const vn = nowInVietnam();
  const hh = String(vn.getHours()).padStart(2, '0');
  const mi = String(vn.getMinutes()).padStart(2, '0');
  const ss = String(vn.getSeconds()).padStart(2, '0');
  return `${hh}:${mi}:${ss}`;
}

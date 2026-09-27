/** Shared field → display header mapping; legacy field headers remain supported. */
export const SIM_IMPORT_HEADERS = {
  phone_number: 'Số điện thoại',
  subscription_type: 'Hình thức thuê bao',
  catalog: 'Nhóm hiển thị',
  sim_type: 'Kiểu số đẹp',
  bundle_note: 'Ghi chú gói cước kèm theo',
  committed_monthly_fee: 'Mức cước cam kết/tháng',
  commitment_months: 'Cam kết (tháng)',
  status: 'Trạng thái',
} as const;

export const normalizeSimHeader = (value: string): string =>
  value.normalize('NFC').toLocaleLowerCase('vi').replace(/\s+/g, '');

const fieldsByHeader = new Map(
  Object.entries(SIM_IMPORT_HEADERS).flatMap(
    ([field, header]) =>
      [
        [normalizeSimHeader(field), field],
        [normalizeSimHeader(header), field],
      ] as [string, string][],
  ),
);

export const resolveSimImportHeader = (header: string): string =>
  fieldsByHeader.get(normalizeSimHeader(header)) ?? header.trim().toLowerCase();

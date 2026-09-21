/** Source: Quyết định 19/2025/QĐ-TTg, Công báo 919+920, trang 27–30.
 * https://congbaocdn.chinhphu.vn/CongBaoCP/VanBan/2025/6/45430/57438-1-2025919-92019-2025-qd-ttg.pdf
 * 75 đơn vị: 08 phường, 67 xã. Keep codes as strings to preserve leading zeros.
 */
const data = [
  ['03646', 'Phường Tô Hiệu'], ['03664', 'Phường Chiềng An'], ['03670', 'Phường Chiềng Cơi'],
  ['03679', 'Phường Chiềng Sinh'], ['03979', 'Phường Mộc Sơn'], ['03980', 'Phường Mộc Châu'],
  ['03982', 'Phường Thảo Nguyên'], ['04033', 'Phường Vân Sơn'],
  ['03688', 'Xã Mường Chiên'], ['03694', 'Xã Mường Giôn'], ['03703', 'Xã Quỳnh Nhai'],
  ['03712', 'Xã Mường Sại'], ['03721', 'Xã Thuận Châu'], ['03724', 'Xã Bình Thuận'],
  ['03727', 'Xã Mường É'], ['03754', 'Xã Chiềng La'], ['03757', 'Xã Mường Khiêng'],
  ['03760', 'Xã Mường Bám'], ['03763', 'Xã Long Hẹ'], ['03781', 'Xã Co Mạ'],
  ['03784', 'Xã Nậm Lầu'], ['03799', 'Xã Muổi Nọi'], ['03808', 'Xã Mường La'],
  ['03814', 'Xã Chiềng Lao'], ['03820', 'Xã Ngọc Chiến'], ['03847', 'Xã Mường Bú'],
  ['03850', 'Xã Chiềng Hoa'], ['03856', 'Xã Bắc Yên'], ['03862', 'Xã Xím Vàng'],
  ['03868', 'Xã Tà Xùa'], ['03871', 'Xã Pắc Ngà'], ['03880', 'Xã Tạ Khoa'],
  ['03892', 'Xã Chiềng Sại'], ['03901', 'Xã Suối Tọ'], ['03907', 'Xã Mường Cơi'],
  ['03910', 'Xã Phù Yên'], ['03922', 'Xã Gia Phù'], ['03943', 'Xã Mường Bang'],
  ['03958', 'Xã Tường Hạ'], ['03961', 'Xã Kim Bon'], ['03970', 'Xã Tân Phong'],
  ['03985', 'Xã Chiềng Sơn'], ['03997', 'Xã Tân Yên'], ['04000', 'Xã Đoàn Kết'],
  ['04006', 'Xã Song Khủa'], ['04018', 'Xã Tô Múa'], ['04045', 'Xã Lóng Sập'],
  ['04048', 'Xã Vân Hồ'], ['04057', 'Xã Xuân Nha'], ['04075', 'Xã Yên Châu'],
  ['04078', 'Xã Chiềng Hặc'], ['04087', 'Xã Yên Sơn'], ['04096', 'Xã Lóng Phiêng'],
  ['04099', 'Xã Phiêng Khoài'], ['04105', 'Xã Mai Sơn'], ['04108', 'Xã Chiềng Sung'],
  ['04117', 'Xã Mường Chanh'], ['04123', 'Xã Chiềng Mung'], ['04132', 'Xã Chiềng Mai'],
  ['04136', 'Xã Tà Hộc'], ['04144', 'Xã Phiêng Cằm'], ['04159', 'Xã Phiêng Pằn'],
  ['04168', 'Xã Sông Mã'], ['04171', 'Xã Bó Sinh'], ['04183', 'Xã Mường Lầm'],
  ['04186', 'Xã Nậm Ty'], ['04195', 'Xã Chiềng Sơ'], ['04204', 'Xã Chiềng Khoong'],
  ['04210', 'Xã Huổi Một'], ['04219', 'Xã Mường Hung'], ['04222', 'Xã Chiềng Khương'],
  ['04228', 'Xã Púng Bánh'], ['04231', 'Xã Sốp Cộp'], ['04240', 'Xã Mường Lèo'],
  ['04246', 'Xã Mường Lạn'],
];

module.exports = {
  up: async (queryInterface) => {
    if (data.length !== 75 || data.filter(([, name]) => name.startsWith('Phường')).length !== 8) {
      throw new Error('Danh mục Sơn La phải có đúng 75 xã/phường, gồm 8 phường');
    }
    await queryInterface.sequelize.query("INSERT INTO provinces (code, name) VALUES ('14', 'Tỉnh Sơn La') ON DUPLICATE KEY UPDATE name = VALUES(name)");
    for (const [code, nameWithType] of data) {
      await queryInterface.sequelize.query(
        'INSERT INTO wards (code, name, name_with_type, province_code) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), name_with_type = VALUES(name_with_type)',
        { replacements: [code, nameWithType.replace(/^(Phường|Xã) /, ''), nameWithType, '14'] },
      );
    }
  },
  down: async () => {
    // Seed rollback intentionally preserves wards referenced by stores.
  },
};

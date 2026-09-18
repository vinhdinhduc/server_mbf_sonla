const bcrypt = require('bcrypt');

module.exports = {
  up: async (queryInterface) => {
    const username = process.env.SEED_ADMIN_USERNAME || 'admin';
    const password = process.env.SEED_ADMIN_PASSWORD;

    if (!password) {
      throw new Error(
        'SEED_ADMIN_PASSWORD chua duoc cau hinh trong .env - vui long dat truoc khi chay seed',
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const [existingUsers] = await queryInterface.sequelize.query(
      'SELECT id FROM users WHERE username = :username LIMIT 1',
      { replacements: { username } },
    );
    if (existingUsers.length > 0) return;

    await queryInterface.bulkInsert('users', [
      {
        username,
        password_hash: passwordHash,
        full_name: 'Quan tri vien',
        email: 'admin@mobifone-sonla.vn',
        phone: '0900000000',
        role: 'admin',
        status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
  },

  down: async (queryInterface) => {
    const username = process.env.SEED_ADMIN_USERNAME || 'admin';
    await queryInterface.bulkDelete('users', { username });
  },
};

require('dotenv').config();

const base = {
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'mobifone_sonla',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  dialect: 'mysql',
  timezone: '+07:00',
  define: {
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
};

module.exports = {
  development: base,
  test: { ...base, database: `${base.database}_test` },
  production: base,
};

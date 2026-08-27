module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    project: './tsconfig.json',
  },
  plugins: ['@typescript-eslint', 'prettier'],
  extends: [
    'airbnb-base',
    'plugin:@typescript-eslint/recommended',
    'prettier',
  ],
  settings: {
    'import/resolver': {
      node: {
        extensions: ['.js', '.ts'],
      },
    },
  },
  rules: {
    'prettier/prettier': 'error',
    'import/extensions': 'off',
    'import/no-unresolved': 'off',
    'class-methods-use-this': 'off',
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': ['warn'],
    'no-underscore-dangle': 'off',
    'import/prefer-default-export': 'off',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    // Tat: moi Model Sequelize tu tham chieu chinh no trong generic cua class
    // (vd `class News extends Model<InferAttributes<News>, ...>`) - day la pattern
    // BAT BUOC cua sequelize (Sequelize thuan + type thu cong theo dung ngan xep
    // cong nghe muc 2), khong phai loi su dung bien truoc khi khai bao that su.
    'no-use-before-define': 'off',
    // Sequelize/Multer/JWT doi hoi 'any' o mot vai diem (bulkCreate payload, callback file...).
    '@typescript-eslint/no-explicit-any': 'warn',
    // Ten cot DB dung snake_case theo dung quy uoc bang 3.1 (vd: phone_number, password_hash) - co tinh.
    camelcase: ['error', { properties: 'never', ignoreDestructuring: true }],
  },
  env: {
    node: true,
    jest: true,
    es6: true,
  },
};

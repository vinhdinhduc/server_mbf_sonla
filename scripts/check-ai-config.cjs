// Prints configuration readiness only; never prints credentials.
const { Sequelize } = require('sequelize');
const config = require('../src/config/sequelize-cli.config').development;
const db = new Sequelize({ ...config, logging: false });
(async () => {
  try {
    const [rows] = await db.query('SELECT `key`, value FROM settings WHERE `group` = :group', {
      replacements: { group: 'ai' },
    });
    const settings = Object.fromEntries(rows.map((row) => [row.key, row.value]));
    console.log(
      JSON.stringify(
        {
          provider: settings.ai_provider || 'anthropic',
          model: settings.ai_model || process.env.ANTHROPIC_MODEL,
          enabled: settings.ai_chatbot_enabled,
          rag: settings.ai_rag_enabled,
          storedKeyPresent: Boolean(settings.ai_api_key_encrypted),
          environmentKeyPresent: Boolean(process.env.ANTHROPIC_API_KEY),
          environmentKeyIsPlaceholder: /placeholder|your[_-]|change[_-]|example/i.test(
            process.env.ANTHROPIC_API_KEY || '',
          ),
        },
        null,
        2,
      ),
    );
  } catch {
    console.error('Unable to inspect AI configuration. Check the database connection.');
    process.exitCode = 1;
  } finally {
    await db.close();
  }
})();

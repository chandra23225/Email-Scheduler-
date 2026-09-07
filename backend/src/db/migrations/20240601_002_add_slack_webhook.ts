import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasColumn = await knex.schema.hasColumn('users', 'slack_webhook_url');
  if (!hasColumn) {
    await knex.schema.alterTable('users', (table) => {
      table.string('slack_webhook_url').nullable();
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasColumn = await knex.schema.hasColumn('users', 'slack_webhook_url');
  if (hasColumn) {
    await knex.schema.alterTable('users', (table) => {
      table.dropColumn('slack_webhook_url');
    });
  }
}

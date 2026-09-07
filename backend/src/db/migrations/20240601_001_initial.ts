import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Users table
  await knex.schema.createTable('users', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('google_id').unique().notNullable();
    table.string('email').unique().notNullable();
    table.string('name').notNullable();
    table.string('avatar').nullable();
    table.string('slack_access_token').nullable();
    table.string('slack_team_id').nullable();
    table.string('slack_channel_id').nullable();
    table.string('slack_webhook_url').nullable();
    table.boolean('slack_connected').defaultTo(false);
    table.timestamps(true, true);
  });

  // Email senders table
  await knex.schema.createTable('email_senders', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.string('name').notNullable();
    table.string('email').notNullable();
    table.string('smtp_host').notNullable();
    table.integer('smtp_port').notNullable();
    table.string('smtp_user').notNullable();
    table.string('smtp_pass').notNullable();
    table.boolean('is_default').defaultTo(false);
    table.timestamps(true, true);
    table.unique(['user_id', 'email']);
  });

  // Email jobs table
  await knex.schema.createTable('email_jobs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.uuid('sender_id').references('id').inTable('email_senders').onDelete('SET NULL').nullable();
    table.string('sender_email').notNullable();
    table.string('recipient_email').notNullable();
    table.string('subject').notNullable();
    table.text('body').notNullable();
    table.string('status').notNullable().defaultTo('scheduled'); // scheduled | retrying | sent | failed | cancelled
    table.timestamp('scheduled_at').notNullable();
    table.timestamp('sent_at').nullable();
    table.string('bullmq_job_id').nullable();
    table.string('idempotency_key').unique().notNullable();
    table.text('error_message').nullable();
    table.integer('retry_count').defaultTo(0);
    table.string('batch_id').nullable(); // groups emails scheduled together
    table.timestamps(true, true);
    table.index(['user_id', 'status']);
    table.index(['scheduled_at']);
    table.index(['idempotency_key']);
    table.index(['batch_id']);
  });

  // Email batches table (for tracking bulk scheduling)
  await knex.schema.createTable('email_batches', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.string('subject').notNullable();
    table.text('body').notNullable();
    table.integer('total_recipients').notNullable();
    table.integer('scheduled_count').defaultTo(0);
    table.integer('sent_count').defaultTo(0);
    table.integer('failed_count').defaultTo(0);
    table.timestamp('start_time').notNullable();
    table.integer('delay_between_emails_ms').defaultTo(2000);
    table.integer('hourly_limit').nullable();
    table.string('status').notNullable().defaultTo('active'); // active | completed | cancelled
    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('email_jobs');
  await knex.schema.dropTableIfExists('email_batches');
  await knex.schema.dropTableIfExists('email_senders');
  await knex.schema.dropTableIfExists('users');
}

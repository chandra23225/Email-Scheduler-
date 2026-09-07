import assert from 'node:assert/strict';
import test from 'node:test';
import { parseRecipientCsv, parseRecipientText } from './recipientParser';

test('parses, normalizes, validates, and deduplicates pasted recipients', () => {
  assert.deepEqual(
    parseRecipientText(' Alice@example.com, invalid, bob@example.com\n alice@example.com '),
    ['alice@example.com', 'bob@example.com']
  );
});

test('parses CSV email columns and ignores the header', () => {
  assert.deepEqual(
    parseRecipientCsv('name,email\nAlice,alice@example.com\nBob,bob@example.com'),
    ['alice@example.com', 'bob@example.com']
  );
});

test('parses quoted CSV fields without shifting the email column', () => {
  assert.deepEqual(
    parseRecipientCsv('name,email\n"Doe, Jane",jane@example.com'),
    ['jane@example.com']
  );
});

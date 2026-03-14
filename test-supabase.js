#!/usr/bin/env node
/**
 * Supabase integration test for MyDay
 *
 * Usage:
 *   node test-supabase.js <SUPABASE_URL> <SUPABASE_ANON_KEY>
 *
 * Or set environment variables:
 *   SUPABASE_URL=https://xxx.supabase.co SUPABASE_KEY=eyJ... node test-supabase.js
 */

const SB_URL = process.argv[2] || process.env.SUPABASE_URL;
const SB_KEY = process.argv[3] || process.env.SUPABASE_KEY;

if (!SB_URL || !SB_KEY) {
  console.error('Usage: node test-supabase.js <SUPABASE_URL> <SUPABASE_ANON_KEY>');
  console.error('  or set SUPABASE_URL and SUPABASE_KEY env vars');
  process.exit(1);
}

const BASE = SB_URL.replace(/\/$/, '');
const HEADERS = {
  'Content-Type': 'application/json',
  'apikey': SB_KEY,
  'Authorization': `Bearer ${SB_KEY}`
};

const TEST_BOARD_ID = 'test_board_' + Date.now();
let passed = 0;
let failed = 0;

function ok(name) { passed++; console.log(`  ✓ ${name}`); }
function fail(name, err) { failed++; console.log(`  ✗ ${name}: ${err}`); }

async function run() {
  console.log(`\nTesting Supabase integration: ${BASE}`);
  console.log(`Test board ID: ${TEST_BOARD_ID}\n`);

  // Test 1: Check connection — GET boards table
  console.log('1. Connection test (GET /rest/v1/boards)');
  try {
    const res = await fetch(`${BASE}/rest/v1/boards?select=board_id&limit=1`, { headers: HEADERS });
    if (res.ok) {
      ok(`Connected, status ${res.status}`);
    } else {
      const body = await res.text();
      fail(`Connection`, `status ${res.status} — ${body}`);
      if (res.status === 404) {
        console.log('\n  → Table "boards" not found. Run this SQL in Supabase SQL Editor:');
        console.log('    create table boards (board_id text primary key, data jsonb);');
        console.log('    -- Also enable RLS or add a policy for anon access\n');
      }
      if (res.status === 401) {
        console.log('\n  → Check your anon key\n');
      }
    }
  } catch (e) {
    fail('Connection', e.message);
    console.log('\n  → Check the Supabase URL\n');
    process.exit(1);
  }

  // Test 2: Upsert (POST with merge-duplicates) — same as syncToCloud()
  console.log('\n2. Write test (POST upsert)');
  const testData = {
    board_id: TEST_BOARD_ID,
    data: { cards: [{ id: 'c1', title: 'Test card', column: 'todo' }], ver: 1 }
  };
  try {
    const res = await fetch(`${BASE}/rest/v1/boards`, {
      method: 'POST',
      headers: { ...HEADERS, 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify(testData)
    });
    if (res.ok || res.status === 201) {
      ok(`Upsert succeeded, status ${res.status}`);
    } else {
      const body = await res.text();
      fail('Upsert', `status ${res.status} — ${body}`);
      if (res.status === 403) {
        console.log('  → RLS is blocking writes. Add a policy:');
        console.log('    ALTER TABLE boards ENABLE ROW LEVEL SECURITY;');
        console.log('    CREATE POLICY "Allow anon access" ON boards FOR ALL USING (true) WITH CHECK (true);');
      }
    }
  } catch (e) {
    fail('Upsert', e.message);
  }

  // Test 3: Read back — same as syncFromCloud()
  console.log('\n3. Read test (GET by board_id)');
  try {
    const res = await fetch(`${BASE}/rest/v1/boards?board_id=eq.${TEST_BOARD_ID}&select=data`, {
      headers: HEADERS
    });
    if (res.ok) {
      const rows = await res.json();
      if (rows.length === 1 && rows[0].data && rows[0].data.cards) {
        ok(`Read back OK — found ${rows[0].data.cards.length} card(s)`);
        if (rows[0].data.cards[0].title === 'Test card') {
          ok('Data integrity verified');
        } else {
          fail('Data integrity', `unexpected title: ${rows[0].data.cards[0].title}`);
        }
      } else {
        fail('Read', `unexpected response: ${JSON.stringify(rows)}`);
      }
    } else {
      fail('Read', `status ${res.status}`);
    }
  } catch (e) {
    fail('Read', e.message);
  }

  // Test 4: Update (second upsert) — verify merge-duplicates works
  console.log('\n4. Update test (second upsert)');
  testData.data.cards.push({ id: 'c2', title: 'Second card', column: 'doing' });
  testData.data.ver = 2;
  try {
    const res = await fetch(`${BASE}/rest/v1/boards`, {
      method: 'POST',
      headers: { ...HEADERS, 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify(testData)
    });
    if (res.ok || res.status === 201) {
      ok(`Update upsert succeeded`);
      // Verify
      const res2 = await fetch(`${BASE}/rest/v1/boards?board_id=eq.${TEST_BOARD_ID}&select=data`, {
        headers: HEADERS
      });
      const rows = await res2.json();
      if (rows[0].data.ver === 2 && rows[0].data.cards.length === 2) {
        ok('Update verified — 2 cards, ver=2');
      } else {
        fail('Update verify', JSON.stringify(rows[0].data));
      }
    } else {
      fail('Update', `status ${res.status}`);
    }
  } catch (e) {
    fail('Update', e.message);
  }

  // Cleanup: delete test row
  console.log('\n5. Cleanup');
  try {
    const res = await fetch(`${BASE}/rest/v1/boards?board_id=eq.${TEST_BOARD_ID}`, {
      method: 'DELETE',
      headers: HEADERS
    });
    if (res.ok) {
      ok('Test data cleaned up');
    } else {
      fail('Cleanup', `status ${res.status} (non-critical)`);
    }
  } catch (e) {
    fail('Cleanup', e.message);
  }

  // Summary
  console.log(`\n${'='.repeat(40)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed === 0) {
    console.log('Supabase integration is working correctly! ✓');
  } else {
    console.log('Some tests failed — see details above.');
  }
  console.log();

  process.exit(failed > 0 ? 1 : 0);
}

run();

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(new URL('../'+path, import.meta.url), 'utf8');
const home = read('index.html');
const context = read('src/core/context.js');
const search = read('src/features/search/index.js');
const demo = read('src/features/demo/index.js');
const locale = read('src/core/locale.js');

test('customer homepage uses concise, truthful ride-search copy', () => {
  assert.match(home, /<h2>Find your ride<\/h2>/);
  assert.match(home, /<h2>Available rides<\/h2>/);
  assert.match(home, /<h2>My bookings<\/h2>/);
  assert.doesNotMatch(home, /All fares in Bangladeshi taka/);
  assert.match(home, /name="startDate"/);
  assert.match(home, /id="searchForm"/);
});

test('fleet class labels do not assert unverified amenities', () => {
  assert.doesNotMatch(context, /Air-conditioned bus|Comfort Hiace/);
  assert.match(context, /bus:'Bus'/);
  assert.match(context, /hiace:'Hiace'/);
});

test('search counts demo separately from actual rides', () => {
  assert.match(search, /realLabel/);
  assert.match(search, /demoLabel/);
  assert.match(search, /No rides match your search yet/);
  assert.match(search, /Practice across Dhaka · No real trip or payment/);
});

test('demo checkout keeps explicit safety and payment disclosure', () => {
  assert.match(demo, /DEMO · NOT A REAL TRIP/);
  assert.match(demo, /No real trip or payment/);
  assert.match(demo, /Charged in demo/);
  assert.match(demo, /Complete demo booking · ৳0/);
  assert.match(demo, /No money is charged or real trip booked/);
});

test('English/Bangla translations include core changed interface labels', () => {
  for (const label of ['My bookings','Find your ride','Available rides','Pickup area',
    'Destination','Start date','Search rides ↗','Demo booking',
    'Payment method (demo)','Fleet management']) {
    assert.ok(locale.includes(JSON.stringify(label)+':') || locale.includes("'"+label+"':"),
      'missing Bangla translation for '+label);
  }
});

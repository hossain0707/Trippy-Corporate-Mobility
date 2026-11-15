import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';

const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const html=source('index.html');
const theme=source('src/features/theam/index.js');
const css=source('src/theam.css');
const main=source('src/main.js');
const ops=source('src/features/admin/index.js');
const search=source('src/features/search/index.js');
const preview=source('public/theam/admin-preview.html');

test('desktop layout matches approved reference structure',()=>{
  for(const id of [
    'hero','theamTabBook','theamTabBookings','theamTabRequest',
    'pickupLocation','destinationLocation','months','startDate',
    'theamFeatured','theamPlanGrid','theamHow','theamCompanyRequest',
  ])assert.match(html,new RegExp('id="'+id+'"'),'missing desktop section '+id);
  assert.match(html,/Tell us where you commute/);
  assert.match(html,/TRIPPY<\/em> takes care of the ride/);
  assert.match(html,/Abdullahpur → Motijheel/);
  assert.match(html,/How TRIPPY Works/);
});

test('same application has explicit Web View and Phone View controls',()=>{
  assert.match(html,/id="theamWebView"/);
  assert.match(html,/id="theamPhoneView"/);
  assert.match(html,/class="mobile-bottom-nav"/);
  assert.match(theme,/trippy-theam-view/);
  assert.match(theme,/matchMedia\('\(max-width:720px\)'\)/);
  assert.match(main,/theamPublicShell/);
  assert.match(css,/data-trippy-view="phone"/);
  assert.match(css,/position:fixed/);
});

test('admin view follows approved reference and still uses authenticated operations APIs',()=>{
  for(const id of [
    'opsDashboard','theamOpsRoutePanel','theamOpsMap','theamOpsVehiclePanel',
    'theamOpsStatusPanel','theamOpsRequestsSummary','theamOpsDemandInsights',
    'theamOpsCandidates','opsDemand','opsBuilder',
  ])assert.match(html,new RegExp('id="'+id+'"'),'missing admin section '+id);
  assert.match(ops,/mfa_verified/);
  assert.match(ops,/api\('\/api\/admin\/overview',\{auth:true\}\)/);
  assert.match(ops,/renderOpsTheam/);
  assert.match(theme,/dashboard\.replaceChildren/);
  assert.doesNotMatch(theme,/1,248|2\.8 t|96%/);
  assert.match(preview,/SAMPLE DATA/);
  assert.match(preview,/noindex,nofollow/);
});

test('plan designs use established fares and distinguish the welcome-only discount',()=>{
  assert.match(theme,/baseBus=5000/);
  assert.match(theme,/20% welcome/);
  assert.match(theme,/New-rider fare from ৳4,000/);
  assert.match(theme,/months:3,discount:25/);
  assert.match(theme,/months:6,discount:30/);
  assert.match(theme,/months:12,discount:35/);
  assert.match(search,/trippy:routes-loaded/);
});

test('rendered theme uses unique DOM IDs and original scalable artwork',()=>{
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(new Set(ids).size,ids.length,'duplicate DOM IDs risk broken booking controls');
  for(const path of [
    'public/theam/coach.svg','public/theam/dhaka-dusk.svg',
    'public/theam/icon.svg','public/theam/admin-preview.html',
    'public/manifest.webmanifest',
  ])assert.ok(existsSync(new URL('../'+path,import.meta.url)),'missing asset '+path);
});

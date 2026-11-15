import {subscriptionQuote} from '../src/core/pricing.js';
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

test('subscription pricing uses the selected vehicle and applies each discount once',()=>{
  const pricing={monthly:{bus:5000,hiace:6500,car:8000},discounts:{firstMonth:20,threeMonths:25,sixMonths:30,twelveMonths:35}};
  for(const [months,monthly,total] of [[1,5200,5200],[3,4875,14625],[6,4550,27300],[12,4225,50700]]){
    const quote=subscriptionQuote(pricing,'hiace',months,true);
    assert.equal(quote.monthly,monthly);
    assert.equal(quote.total,total);
  }
  assert.equal(subscriptionQuote(pricing,'hiace',1,false).total,6500);
  assert.equal(subscriptionQuote(pricing,'bus',3,true).monthly,3750);
  assert.equal(subscriptionQuote(pricing,'car',12,true).monthly,5200);
  assert.match(theme,/loadPricing\(\)/);
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

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const docker=read('../Dockerfile.dev');
const gate=read('src/core/dev-gate.js');
const main=read('src/main.js');
const context=read('src/core/context.js');
const deployment=read('../deploy/dev/cloudbuild.yaml');
const devSite=read('../backend/app/dev_site.py');

test('DEV app remains hidden behind sign in and does not show routes before verification',()=>{
  assert.match(gate,/VITE_DEV_GATE==='true'/);
  assert.match(gate,/app\.hidden=!user/);
  assert.match(gate,/gate\.hidden=Boolean\(user\)/);
  assert.match(gate,/signInWithPassword/);
  assert.match(gate,/signUp/);
  assert.match(main,/const isDevGate=initializeDevGate\(\)/);
  assert.match(main,/if\(!isDevGate\)await loadRoutes\(\)/);
  assert.match(main,/if\(isDevGate\)showDevAccount\(state\.user\)/);
  assert.match(main,/if\(isDevGate\)await loadRoutes\(\)/);
});

test('DEV build requires public Supabase configuration but not database credentials in frontend',()=>{
  assert.match(docker,/ENV VITE_DEV_GATE=true/);
  assert.match(docker,/VITE_SUPABASE_PUBLISHABLE_KEY/);
  assert.doesNotMatch(docker,/SSLCOMMERZ_STORE_PASSWORD|DATABASE_URL=postgres/);
  assert.match(context,/VITE_DEV_GATE==='true'\?window\.location\.origin/);
  assert.match(devSite,/app\.mount\("\/", StaticFiles/);
});

test('DEV deployment cannot touch PRD or make a DEV revision active without review',()=>{
  assert.match(deployment,/trippy-corporate-mobility/);
  assert.match(deployment,/trippy-api-dev/);
  assert.match(deployment,/Iap Enabled: true/);
  assert.match(deployment,/--no-traffic/);
  assert.match(deployment,/--tag=theam/);
  assert.doesNotMatch(deployment,/--allow-unauthenticated/);
  assert.doesNotMatch(deployment,/fcgnaztqcmuxwbwabxfm/);
});

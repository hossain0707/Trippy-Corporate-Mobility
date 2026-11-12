import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  dhakaPlaces,normalizePlaceQuery,rankDhakaPlaces,mergeLocationSuggestions,
} from '../src/features/locations/catalog.js';

const names = (query,limit=8)=>rankDhakaPlaces(query,dhakaPlaces,limit).map(p=>p.name);

test('offline index covers areas, roads, sectors, landmarks and transport hubs',()=>{
  assert.ok(dhakaPlaces.length>=260, 'provide a useful citywide seed index');
  const types=new Set(dhakaPlaces.map(p=>p.category));
  for(const category of ['area','residential','corporate','road','stop','transit','landmark','hospital']){
    assert.ok(types.has(category), 'missing '+category);
  }
  assert.ok(dhakaPlaces.some(p=>p.name==='Uttara Sector 7'));
  assert.ok(dhakaPlaces.some(p=>p.name==='Gulshan Avenue'));
  assert.ok(dhakaPlaces.some(p=>p.name==='Motijheel Metro Station'));
});

test('single-letter and progressive Latin typing returns useful Dhaka matches',()=>{
  for (const search of ['B','Ba','Ban']){
    assert.ok(names(search).includes('Banani'), search+' should include Banani');
  }
  assert.ok(names('Ba').includes('Badda'));
  assert.ok(names('Ba').includes('Bashundhara Residential Area'));
  assert.equal(names('Banani')[0],'Banani');
});

test('Bangla area names and Bengali sector digits remain searchable',()=>{
  assert.equal(normalizePlaceQuery('উত্তরা সেক্টর ৭'),normalizePlaceQuery('উত্তরা সেক্টর 7'));
  assert.ok(names('বনানী').includes('Banani'));
  assert.ok(names('উত্তরা সেক্টর ৭').includes('Uttara Sector 7'));
  assert.ok(names('শাহবাগ').includes('Shahbag'));
});

test('common spelling aliases and minor typos are accepted',()=>{
  assert.ok(names('uttora').includes('Uttara'));
  assert.ok(names('kawran').includes('Kawran Bazar'));
  assert.ok(names('Shahbagh').includes('Shahbag'));
  assert.ok(names('banai').includes('Banani'));
});

test('verified stops rank before lookalike unverified places',()=>{
  const approved={id:'verified-1',name:'Banani Kakoli',bangla:'বনানী কাকলী',
    category:'approved',zone:'Banani',source:'approved',
    latitude:23.79,longitude:90.41,aliases:[]};
  const merged=mergeLocationSuggestions('Banani',{approved:[approved],limit:8});
  assert.equal(merged[0].id,'verified-1');
  assert.equal(merged[0].source,'approved');
});

test('map coordinates only enrich matched places; no invented local coordinates',()=>{
  const original=dhakaPlaces.find(p=>p.name==='Banani');
  assert.equal(original.latitude,null);
  const mapped={id:'map-banani',name:'Banani',bangla:'Banani',
    zone:'Banani',category:'area',source:'map',
    latitude:23.793,longitude:90.406};
  const merged=mergeLocationSuggestions('Banani',{mapped:[mapped],limit:8});
  const place=merged.find(p=>p.name==='Banani');
  assert.equal(place.latitude,23.793);
  assert.equal(place.longitude,90.406);
  assert.equal(place.source,'curated');
});

test('do not return unrelated or empty queries',()=>{
  assert.deepEqual(rankDhakaPlaces(''),[]);
  assert.deepEqual(rankDhakaPlaces('zzzz-not-a-dhaka-location'),[]);
});

test('page integrates autocomplete into pickup and destination without removing old field names',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
  const search=readFileSync(new URL('../src/features/search/index.js',import.meta.url),'utf8');
  const ui=readFileSync(new URL('../src/features/locations/index.js',import.meta.url),'utf8');
  assert.match(html,/name="pickup"/);
  assert.match(html,/name="office"/);
  assert.match(main,/initializeDhakaLocations\(\)/);
  assert.match(search,/locationSearchTerm/);
  assert.match(ui,/aria-autocomplete/);
  assert.match(ui,/aria-activedescendant/);
  assert.match(ui,/DEBOUNCE_MS=350/);
});

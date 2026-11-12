import {config,api,node} from '../../core/context.js';
import {language} from '../../core/locale.js';
import {
  dhakaPlaces,normalizePlaceQuery,mergeLocationSuggestions,categoryLabel,
} from './catalog.js';

// Approximate Greater Dhaka search bounds, not a legal city boundary.
export const DHAKA_BBOX=[90.25,23.63,90.57,23.96];
const DEBOUNCE_MS=350;
const MAX_SUGGESTIONS=8;

const getUiLanguage=()=>language==='bn'?'bn':'en';

export function locationSearchTerm(input){
  const selectedName=input.dataset.selectedName;
  return input.dataset.searchZone && selectedName===input.value
    ?input.dataset.searchZone
    :input.value.trim();
}

function approvedPlaces(records){
  return records.map(place=>({
    id:'approved-'+place.id,
    name:String(place.name||''),
    bangla:String(place.name||''),
    category:'approved',
    zone:String(place.zone||place.name||''),
    aliases:place.zone?[String(place.zone)]:[],
    source:'approved',
    latitude:place.latitude === null ? null : Number(place.latitude),
    longitude:place.longitude === null ? null : Number(place.longitude),
  }));
}

export function mapFeaturesToSuggestions(features){
  if(!Array.isArray(features))return [];
  const [west,south,east,north]=DHAKA_BBOX;
  return features.flatMap(feature=>{
    const coords=feature.center || feature.geometry?.coordinates;
    if(!Array.isArray(coords)||coords.length<2)return [];
    const [longitude,latitude]=coords.map(Number);
    if(!Number.isFinite(longitude)||!Number.isFinite(latitude) ||
      longitude<west||longitude>east||latitude<south||latitude>north)return [];
    const name=String(feature.text||feature.place_name?.split(',')[0]||'').trim().slice(0,110);
    if(!name)return [];
    const types=feature.place_type || [];
    const category=types.includes('road')||types.includes('address')?'road':
      types.includes('poi')?'landmark':'area';
    const context=feature.context?.find(x=>['neighbourhood','place','locality'].some(t=>x.id?.startsWith(t)));
    return [{
      id:'map-'+String(feature.id||name),
      name,
      bangla:feature['text_bn'] || name,
      category,
      zone:String(context?.text||name),
      aliases:[],
      latitude,longitude,
      source:'map',
    }];
  });
}

async function livePlaceSuggestions(query,signal){
  if(!config.mapKey || normalizePlaceQuery(query).length<3)return [];
  const endpoint=new URL('https://api.maptiler.com/geocoding/'+encodeURIComponent(query)+'.json');
  endpoint.searchParams.set('key',config.mapKey);
  endpoint.searchParams.set('bbox',DHAKA_BBOX.join(','));
  endpoint.searchParams.set('country','bd');
  endpoint.searchParams.set('autocomplete','true');
  endpoint.searchParams.set('limit','8');
  endpoint.searchParams.set('language',getUiLanguage());
  const response=await fetch(endpoint,{signal,cache:'no-store',referrerPolicy:'strict-origin-when-cross-origin'});
  if(!response.ok)throw new Error('Map search unavailable');
  const data=await response.json();
  return mapFeaturesToSuggestions(data?.features);
}

async function officialStops(query){
  if(normalizePlaceQuery(query).length<2||!config.api)return [];
  const records=await api('/api/locations/stops?q='+encodeURIComponent(query));
  return approvedPlaces(Array.isArray(records)?records:[]);
}

export function mountLocationAutocomplete(input){
  if(!input || input.dataset.autocompleteMounted==='true')return ()=>{};
  input.dataset.autocompleteMounted='true';
  const id='dhaka-locations-'+input.name;
  const wrapper=input.closest('.location-combobox')||input.parentElement;
  const dropdown=node('div',{className:'location-suggestions hidden',id,role:'listbox',
    'aria-label':getUiLanguage()==='bn'?'ঢাকার স্থান':'Dhaka location suggestions'});
  wrapper.append(dropdown);
  input.setAttribute('role','combobox');
  input.setAttribute('aria-autocomplete','list');
  input.setAttribute('aria-haspopup','listbox');
  input.setAttribute('aria-controls',id);
  input.setAttribute('aria-expanded','false');
  input.setAttribute('spellcheck','false');

  let current=[],activeIndex=-1,generation=0,pending=null,debounce=null;
  let approved=[],mapped=[];
  const close=()=>{
    dropdown.classList.add('hidden');
    generation++;
    if(debounce!==null){clearTimeout(debounce);debounce=null}
    if(pending){pending.abort();pending=null}
    input.setAttribute('aria-expanded','false');
    input.removeAttribute('aria-activedescendant');
    activeIndex=-1;
  };
  const choice=place=>{
    input.value=getUiLanguage()==='bn' && place.bangla ? place.bangla : place.name;
    input.dataset.selectedName=input.value;
    input.dataset.searchZone=place.zone||place.name;
    if(Number.isFinite(place.latitude)&&Number.isFinite(place.longitude)){
      input.dataset.latitude=String(place.latitude);
      input.dataset.longitude=String(place.longitude);
    }else{
      delete input.dataset.latitude;
      delete input.dataset.longitude;
    }
    input.dispatchEvent(new Event('change',{bubbles:true}));
    close();
  };
  const render=()=>{
    const q=input.value.trim();
    if(!q){dropdown.replaceChildren();close();return}
    current=mergeLocationSuggestions(q,{
      local:dhakaPlaces,approved,mapped,limit:MAX_SUGGESTIONS,
    });
    dropdown.replaceChildren();
    const header=node('div',{className:'location-suggestions-header'});
    header.append(node('strong',{},getUiLanguage()==='bn'?'প্রস্তাবিত স্থান':'Suggested locations'));
    header.append(node('span',{},getUiLanguage()==='bn'?'ঢাকা':'Dhaka'));
    dropdown.append(header);
    if(!current.length){
      dropdown.append(node('div',{className:'location-empty'},
        getUiLanguage()==='bn'?'আরও লিখুন অথবা অন্য বানান চেষ্টা করুন।':
          'Keep typing, or try another spelling.'));
    }
    current.forEach((place,index)=>{
      const option=node('div',{id:id+'-option-'+index,
        className:'location-option',role:'option','aria-selected':'false'});
      const mark=node('span',{className:'location-type-icon','aria-hidden':'true'},
        ({area:'⌖',residential:'⌂',corporate:'▦',road:'↗',stop:'●',
          transit:'▣',landmark:'◇',hospital:'✚',approved:'✓',map:'⌖'})[place.category]||'⌖');
      const label=node('span',{className:'location-option-label'});
      label.append(node('strong',{},
        getUiLanguage()==='bn' && place.bangla?place.bangla:place.name));
      const more=node('small',{},categoryLabel(place.category,getUiLanguage())+
        (place.zone && place.zone!==place.name?' · '+place.zone:' · Dhaka'));
      label.append(more);
      option.append(mark,label);
      option.onmousedown=event=>event.preventDefault();
      option.onclick=()=>choice(place);
      dropdown.append(option);
    });
    if(mapped.length && current.some(place=>place.source==='map')){
      const attribution=node('div',{className:'location-attribution'});
      attribution.append(document.createTextNode('Map data: '));
      attribution.append(node('a',{href:'https://www.maptiler.com/copyright/',
        rel:'noopener noreferrer',target:'_blank'},'MapTiler'));
      attribution.append(document.createTextNode(' · '));
      attribution.append(node('a',{href:'https://www.openstreetmap.org/copyright',
        rel:'noopener noreferrer',target:'_blank'},'OpenStreetMap'));
      dropdown.append(attribution);
    }
    if(document.activeElement!==input)return;
    dropdown.classList.remove('hidden');
    input.setAttribute('aria-expanded','true');
    activeIndex=-1;
    input.removeAttribute('aria-activedescendant');
  };
  const abortPrevious=()=>{
    if(debounce!==null){clearTimeout(debounce);debounce=null}
    if(pending){pending.abort();pending=null}
  };
  const refresh=()=>{
    generation++;
    const requestNumber=generation;
    abortPrevious();
    approved=[];mapped=[];
    const value=input.value.trim();
    if(!value){close();return}
    render(); // First-character suggestions are instant and work offline.
    if(normalizePlaceQuery(value).length<2)return;
    debounce=setTimeout(async()=>{
      const controller=new AbortController();pending=controller;
      const tasks=[officialStops(value).catch(()=>[])];
      if(config.mapKey&&normalizePlaceQuery(value).length>=3){
        tasks.push(livePlaceSuggestions(value,controller.signal).catch(()=>[]));
      }
      const [stops,places]=await Promise.all(tasks);
      if(requestNumber!==generation||controller.signal.aborted)return;
      approved=stops||[];
      mapped=places||[];
      render();
    },DEBOUNCE_MS);
  };
  const activate=index=>{
    if(index<0||index>=current.length)return;
    activeIndex=index;
    [...dropdown.querySelectorAll('[role="option"]')].forEach((el,i)=>{
      el.classList.toggle('active',i===index);
      el.setAttribute('aria-selected',String(i===index));
    });
    const optionId=id+'-option-'+index;
    input.setAttribute('aria-activedescendant',optionId);
    dropdown.querySelector('#'+optionId)?.scrollIntoView({block:'nearest'});
  };
  const onInput=()=>{
    delete input.dataset.searchZone;
    delete input.dataset.selectedName;
    delete input.dataset.latitude;
    delete input.dataset.longitude;
    refresh();
  };
  const onKeydown=event=>{
    if(event.key==='Escape'){close();return}
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){
      if(dropdown.classList.contains('hidden'))render();
      if(!current.length)return;
      event.preventDefault();
      activate(event.key==='ArrowDown'?(activeIndex+1)%current.length:
        (activeIndex<=0?current.length-1:activeIndex-1));
    }
    if(event.key==='Enter' && activeIndex>=0 && !dropdown.classList.contains('hidden')){
      event.preventDefault();
      choice(current[activeIndex]);
    }
  };
  const onOutside=event=>{if(!wrapper.contains(event.target))close()};
  const onBlur=()=>{setTimeout(()=>{if(document.activeElement!==input)close()},120)};
  input.addEventListener('input',onInput);
  input.addEventListener('focus',refresh);
  input.addEventListener('keydown',onKeydown);
  input.addEventListener('blur',onBlur);
  document.addEventListener('pointerdown',onOutside);
  return ()=>{
    abortPrevious();
    input.removeEventListener('input',onInput);
    input.removeEventListener('focus',refresh);
    input.removeEventListener('keydown',onKeydown);
    input.removeEventListener('blur',onBlur);
    document.removeEventListener('pointerdown',onOutside);
    dropdown.remove();
  };
}

export function initializeDhakaLocations(){
  const pickup=document.querySelector('#searchForm input[name="pickup"]');
  const destination=document.querySelector('#searchForm input[name="office"]');
  mountLocationAutocomplete(pickup);
  mountLocationAutocomplete(destination);
}

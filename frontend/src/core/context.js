import {locale,t} from './locale.js';
import {createClient} from '@supabase/supabase-js';
export const config={api:import.meta.env.VITE_API_BASE_URL,authUrl:import.meta.env.VITE_SUPABASE_URL,key:import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,mapKey:import.meta.env.VITE_MAPTILER_KEY};
export const configured=Boolean(config.api&&config.authUrl&&config.key&&!config.authUrl.includes('YOUR_PROJECT'));
export const supabase=configured?createClient(config.authUrl,config.key,{auth:{flowType:'pkce'}}):null;
export const $=id=>document.getElementById(id);
export const formatBdt=n=>'৳'+Number(n).toLocaleString(locale,{maximumFractionDigits:0});
export const vehicleNames={bus:'Air-conditioned bus',hiace:'Comfort Hiace',car:'Shared private car'};
export const durationLabels={1:'1 month',3:'3 months',6:'6 months',12:'12 months'};
export const state={user:null,session:null,services:[],bookings:[],page:'search',selectedService:null,selectedSeat:null,bookingModal:null,trackingTimer:null,map:null,mapMarker:null,driverWatch:null,driverLastPing:0};
export const node=(tag,attrs={},content)=>{const el=document.createElement(tag);for(const [k,v] of Object.entries(attrs)){if(k==='className')el.className=v;else if(k==='text')el.textContent=v;else if(k==='disabled')el.disabled=Boolean(v);else el.setAttribute(k,['aria-label','placeholder'].includes(k)?t(String(v)):String(v));}if(typeof content==='string')el.textContent=t(content);else if(content instanceof Node)el.append(content);return el};
export function dhakaDay(add=0){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Dhaka',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());const d=new Date(parts+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+add);return d.toISOString().slice(0,10)}
export function showToast(message){const el=$('toast');el.textContent=t(message);el.classList.remove('hidden');clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>el.classList.add('hidden'),5500)}
let modalTrigger;
export function showModal(title,kicker='BOOK YOUR COMMUTE') {
  const backdrop = $('modalBackdrop');
  if (backdrop.classList.contains('hidden')) modalTrigger = document.activeElement;
  $('modalTitle').textContent = t(title);
  $('modalKicker').textContent = t(kicker);
  $('modalContent').replaceChildren();
  backdrop.classList.remove('hidden');
  $('app').inert = true;
  document.body.style.overflow = 'hidden';
  $('modalClose').focus();
}
export function closeModal() {
  state.selectedService = null;
  $('modalBackdrop').classList.add('hidden');
  $('app').inert = false;
  document.body.style.overflow = '';
  modalTrigger?.focus();
  modalTrigger = null;
}
$('modalClose').onclick = closeModal;
$('modalBackdrop').addEventListener('click', event => {
  if (event.target === $('modalBackdrop')) closeModal();
});
document.addEventListener('keydown', event => {
  const backdrop = $('modalBackdrop');
  if (backdrop.classList.contains('hidden')) return;
  if (event.key === 'Escape') closeModal();
  if (event.key !== 'Tab') return;
  const focusable = [...backdrop.querySelectorAll('button, input, select, textarea, a[href]')]
    .filter(item => !item.disabled && item.getClientRects().length);
  const first = focusable.at(0);
  const last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
});
export async function api(path,{method='GET',json,auth=false}={}){
  if(!configured)throw new Error('Live backend and verified login have not been configured. See setup instructions.');
  const headers={};let body;
  if(json!==undefined){headers['content-type']='application/json';body=JSON.stringify(json)}
  if(auth){const {data,error}=await supabase.auth.getSession();if(error||!data.session)throw new Error('Sign in to continue');headers.authorization='Bearer '+data.session.access_token}
  let res;try{res=await fetch(config.api+path,{method,headers,body,cache:'no-store'})}catch{throw new Error('Unable to reach Trippy API. Check the server connection.')}
  let parsed=null;try{parsed=await res.json()}catch{}
  if(!res.ok)throw new Error(parsed?.message||parsed?.detail||`Server returned ${res.status}`);
  return parsed;
}
export function formatTime(t){if(!t)return '—';const [h,m]=String(t).split(':');const num=Number(h);return `${num%12||12}:${m} ${num>=12?'PM':'AM'}`}

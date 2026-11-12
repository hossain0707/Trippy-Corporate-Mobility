import {t,localText,locale} from '../../core/locale.js';
import {$,node,state,configured,api,vehicleNames,formatBdt,formatTime} from '../../core/context.js';
import {openSeats} from '../booking/index.js';
import {demoCard} from '../demo/index.js';
import {locationSearchTerm} from '../locations/index.js';
export function getSearch(){const form=new FormData($('searchForm'));return {pickup:String(form.get('pickup')).trim(),office:String(form.get('office')).trim(),vehicleClass:String(form.get('vehicleClass')),startDate:String(form.get('startDate')),months:Number(form.get('months'))}}
export async function loadRoutes(){
  const container=$('routeResults');
  $('resultCount').textContent='';
  container.replaceChildren(node('div',{className:'empty-message'},'Finding available rides…'));
  if(!configured){container.replaceChildren(node('div',{className:'empty-message'},'Ride search is temporarily unavailable. Please try again later.'));return}
  const q=getSearch(),params=new URLSearchParams();
  // Preserve the complete selected place for display and demo itineraries.
  // Match actual licensed routes by their broader operating zone when available.
  const pickupInput=$('searchForm').elements.namedItem('pickup');
  const officeInput=$('searchForm').elements.namedItem('office');
  const pickupTerm=locationSearchTerm(pickupInput).trim();
  const officeTerm=locationSearchTerm(officeInput).trim();
  if(pickupTerm)params.set('pickup',pickupTerm);
  if(officeTerm)params.set('office',officeTerm);
  if(q.vehicleClass)params.set('vehicleClass',q.vehicleClass);
  const [realResult,demoResult]=await Promise.allSettled([
    api('/api/services'+(params.size?'?'+params:'')),
    api('/api/demo/services'),
  ]);
  const real=realResult.status==='fulfilled'?realResult.value:[];
  const demo=demoResult.status==='fulfilled'
    ?demoResult.value.filter(s=>!q.vehicleClass||s.vehicle_class===q.vehicleClass):[];
  state.services=real;
  container.replaceChildren();
  const realLabel=real.length ? real.length+' available ride'+(real.length===1?'':'s') : '';
  const demoLabel=demo.length ? demo.length+' demo ride'+(demo.length===1?'':'s') : '';
  $('resultCount').textContent=localText(
    [realLabel,demoLabel].filter(Boolean).join(' · ') || 'No rides found',
    [real.length?'যাত্রা '+real.length.toLocaleString(locale)+'টি':'',demo.length?'ডেমো '+demo.length.toLocaleString(locale)+'টি':''].filter(Boolean).join(' · ') || 'কোনো যাত্রা পাওয়া যায়নি'
  );
  if(realResult.status==='rejected'){
    container.append(node('div',{className:'error-note'},'We couldn’t load live rides. Please try again shortly.'));
  }else if(!real.length && !demo.length){
    container.append(node('div',{className:'empty-message'},'No rides match your search yet. Try another area or request a route.'));
  }
  for(const service of real) container.append(routeCard(service));
  if(demo.length){
    const label=node('div',{className:'demo-search-label'});
    label.append(node('strong',{},'Try a demo booking'),
      node('span',{},'Practice across Dhaka · No real trip or payment'));
    container.append(label);
    for(const service of demo)container.append(demoCard(service,getSearch));
  }
  if(demoResult.status==='rejected'&&demoResult.reason?.message){
    // A demo outage must not block genuine bookings.
    console.warn('Demo catalog unavailable');
  }
}
function routeCard(s){const card=node('article',{className:'route-card'});const chip=node('span',{className:'vehicle-chip '+s.vehicle_class},vehicleNames[s.vehicle_class]);const title=node('h3',{},s.home_zone+' → '+s.office_zone);const details=node('div',{className:'route-details'});
  details.append(node('span',{},'☀ '+t('Morning pickup')+': '+formatTime(s.morning_departure)),node('span',{},'☾ '+t('Evening return')+': '+formatTime(s.evening_departure)),node('span',{},s.code+' · '+localText(s.selectable_seats+' passenger seats', s.selectable_seats.toLocaleString(locale)+'টি যাত্রী আসন')));
  const bottom=node('div',{className:'route-bottom'});const price=node('div');price.append(node('b',{},formatBdt({bus:5000,hiace:6500,car:8000}[s.vehicle_class])),node('small',{},'per month · before discounts'));
  const button=node('button',{type:'button'},'Choose seat ↗');button.onclick=()=>openSeats(s);bottom.append(price,button);card.append(chip,title,details,bottom);return card;
}
$('searchForm').addEventListener('submit',e=>{e.preventDefault();loadRoutes()});


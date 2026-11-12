import {t,localText,locale} from '../../core/locale.js';
import {$,node,state,configured,api,vehicleNames,formatBdt,formatTime} from '../../core/context.js';
import {openSeats} from '../booking/index.js';
import {demoCard} from '../demo/index.js';
export function getSearch(){const form=new FormData($('searchForm'));return {pickup:String(form.get('pickup')).trim(),office:String(form.get('office')).trim(),vehicleClass:String(form.get('vehicleClass')),startDate:String(form.get('startDate')),months:Number(form.get('months'))}}
export async function loadRoutes(){
  const container=$('routeResults');
  $('resultCount').textContent='';
  container.replaceChildren(node('div',{className:'empty-message'},'Checking current routes and availability…'));
  if(!configured){container.replaceChildren(node('div',{className:'empty-message'},'Ride search is temporarily unavailable.'));return}
  const q=getSearch(),params=new URLSearchParams();
  if(q.pickup)params.set('pickup',q.pickup);
  if(q.office)params.set('office',q.office);
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
  $('resultCount').textContent=localText(
    real.length+' active services'+(demo.length?' · '+demo.length+' demo':''),
    'চালু সেবা '+real.length.toLocaleString(locale)+'টি'+(demo.length?' · ডেমো '+demo.length.toLocaleString(locale)+'টি':'')
  );
  if(realResult.status==='rejected'){
    container.append(node('div',{className:'error-note'},'Real ride search unavailable: '+realResult.reason.message));
  }else if(!real.length && !demo.length){
    container.append(node('div',{className:'empty-message'},'No available route matches your search.'));
  }
  for(const service of real) container.append(routeCard(service));
  if(demo.length){
    const label=node('div',{className:'demo-search-label'});
    label.append(node('strong',{},'Practice with a demo service'),
      node('span',{},'Available for demonstration anywhere in Dhaka · Never a real ride'));
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
  const bottom=node('div',{className:'route-bottom'});const price=node('div');price.append(node('b',{},formatBdt({bus:5000,hiace:6500,car:8000}[s.vehicle_class])),node('small',{},'per month before discounts'));
  const button=node('button',{type:'button'},'Choose seat ↗');button.onclick=()=>openSeats(s);bottom.append(price,button);card.append(chip,title,details,bottom);return card;
}
$('searchForm').addEventListener('submit',e=>{e.preventDefault();loadRoutes()});


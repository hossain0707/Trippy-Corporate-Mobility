/** Feature/theam: exact-reference-inspired customer and operations presentation.
 * No booking/payment rules are implemented here. All live data comes from FastAPI.
 * The screen-size toggle changes presentation only; it never changes inventory.
 */
import {$,node,state,formatBdt,formatTime} from '../../core/context.js';
import {t} from '../../core/locale.js';

const plans=[
  {months:1,discount:20,label:'1 Month'},
  {months:3,discount:25,label:'3 Months'},
  {months:6,discount:30,label:'6 Months'},
  {months:12,discount:35,label:'12 Months'},
];

let publicNavigate=null;
const scrollTo=id=>document.getElementById(id)?.scrollIntoView({behavior:'smooth',block:'start'});

function updateView(mode,persist=true){
  const view=mode==='phone'?'phone':'web';
  if(persist)window.localStorage.setItem('trippy-theam-view',view);
  document.body.dataset.trippyView=view;
  $('theamPhoneView').setAttribute('aria-pressed',String(view==='phone'));
  $('theamWebView').setAttribute('aria-pressed',String(view==='web'));
  $('theamPhoneView').classList.toggle('active',view==='phone');
  $('theamWebView').classList.toggle('active',view==='web');
}
const goHome=target=>{
  if(state.page!=='search')publicNavigate?.('search');
  requestAnimationFrame(()=>scrollTo(target||'hero'));
};

function makePlanCard(plan){
  const select=$('months'),current=Number(select?.value||1);
  const selected=current===plan.months;
  const baseBus=5000;
  const intro=plan.months===1;
  const discount=plan.discount;
  const monthly=intro?baseBus:baseBus*(100-discount/100);
  const button=node('button',{type:'button',
    className:'theam-plan-choice'+(selected?' selected':''),
    'aria-pressed':String(selected),'aria-label':plan.label+' subscription'});
  const label=node('b',{},plan.label);
  const badge=node('span',{className:'theam-plan-discount'},intro?'20% welcome':discount+'% OFF');
  const price=node('strong',{},formatBdt(monthly));
  const sub=node('small',{},intro?'New-rider fare from ৳4,000':'per month · bus example');
  const call=node('span',{className:'theam-plan-select'},selected?'Selected ✓':'Select');
  button.append(label,badge,price,sub,call);
  button.onclick=()=>{
    select.value=String(plan.months);
    renderPlans();
    if(state.page!=='search')goHome('hero');
  };
  return button;
}
export function renderPlans(){
  const target=$('theamPlanGrid');
  if(!target)return;
  target.replaceChildren(...plans.map(makePlanCard));
}
export function renderFeatured(services=[]){
  const target=$('theamFeaturedContent');
  if(!target)return;
  const service=services.find(s=>s.vehicle_class==='bus')||services[0];
  const status=$('theamFeaturedStatus');
  const action=$('theamFeaturedAction');
  // The illustration is never represented as proof of an operating fleet.
  if(!service){
    status.textContent='Illustrative corridor · No live route';
    status.classList.remove('is-live');
    action.textContent='Find published routes →';
    action.onclick=()=>goHome('routeResults');
    return;
  }
  status.textContent='Published service';
  status.classList.add('is-live');
  const route=service.route_name||service.home_zone+' → '+service.office_zone;
  const pair=service.pickup_stop_name&&service.dropoff_stop_name?
    service.pickup_stop_name+' → '+service.dropoff_stop_name:route;
  const pic=node('div',{className:'theam-vehicle-preview'});
  pic.append(node('img',{src:'/theam/coach.svg',alt:'Illustrative TRIPPY coach, not a specific registered vehicle'}));
  const info=node('div',{className:'theam-route-preview'});
  info.append(node('h2',{},pair),
    node('p',{},'Published corridor: '+route),
    node('div',{className:'theam-live-route-meta'},
      '◷ Morning '+formatTime(service.morning_board_time||service.morning_departure)+
        ' · Evening '+formatTime(service.evening_board_time||service.evening_departure)),
    node('small',{className:'theam-illustration-note'},
      service.selectable_seats+' mapped seats · Choose your stops to check actual availability'));
  target.replaceChildren(pic,info);
  action.textContent='Choose your stops & seat →';
  action.onclick=()=>goHome('routeResults');
}
export function initTheam(navigate){
  publicNavigate=navigate;
  const requested=new URLSearchParams(window.location.search).get('view');
  const saved=window.localStorage.getItem('trippy-theam-view');
  const initial=requested==='phone'||requested==='web'?requested:
    saved==='phone'||saved==='web'?saved:
    (window.matchMedia('(max-width:720px)').matches?'phone':'web');
  updateView(initial,false);
  $('theamPhoneView').onclick=()=>updateView('phone');
  $('theamWebView').onclick=()=>updateView('web');
  $('theamGetStarted').onclick=()=>$('accountBtn').click();
  $('theamMobileProfile').onclick=()=>$('accountBtn').click();
  $('theamTrackRide').onclick=()=>publicNavigate?.('tracking');
  $('theamNavRequest').onclick=()=>{
    goHome('hero');
    $('demandBtn').click();
  };
  $('theamTabBook').onclick=()=>goHome('searchForm');
  $('theamTabBookings').onclick=()=>publicNavigate?.('passes');
  $('theamTabRequest').onclick=()=>$('demandBtn').click();
  $('theamCompanyRequest').onclick=()=>$('demandBtn').click();
  $('theamFeaturedAction').onclick=()=>goHome('routeResults');
  document.querySelectorAll('[data-scroll]').forEach(button=>{
    button.onclick=()=>goHome(button.dataset.scroll);
  });
  $('months').addEventListener('change',renderPlans);
  document.addEventListener('trippy:routes-loaded',event=>renderFeatured(event.detail?.services||[]));
  renderPlans();
  renderFeatured([]);
  const opsSearch=$('theamOpsSearch');
  opsSearch?.addEventListener('input',()=>{
    const query=opsSearch.value.trim().toLocaleLowerCase();
    for(const el of document.querySelectorAll('#opsDemand .ops-request-card, #opsServices .pass-card, #opsBuilder .ops-registry-row')){
      el.hidden=query.length>0&&!el.textContent.toLocaleLowerCase().includes(query);
    }
  });
  document.querySelectorAll('[data-ops-section]').forEach(button=>{
    button.onclick=()=>{
      document.querySelectorAll('.theam-ops-menu button').forEach(b=>b.classList.toggle('active',b===button));
      const section=button.dataset.opsSection;
      const targets={
        overview:'opsDashboard',routes:'opsBuilder',demand:'theamOpsDemandSection',
        fleet:'opsBuilder',scheduling:'opsBuilder',bookings:'theamOpsServicesSection',
        passengers:'theamOpsPassengerSection',operations:'opsBuilder',
        analytics:'theamOpsAnalyticsSection',settings:'opsBuilder',
      };
      scrollTo(targets[section]||'opsDashboard');
      const tab=section==='fleet'?'fleet':
        section==='routes'?'routes':section==='scheduling'?'schedule':
        section==='settings'?'staff':null;
      if(tab)document.getElementById('ops-tab-'+tab)?.click();
    };
  });
}

function pill(text,kind=''){
  return node('span',{className:'theam-ops-pill '+kind},text);
}
function kpi(label,value,icon,note=''){
  const card=node('article',{className:'theam-ops-metric'});
  const body=node('div');
  body.append(node('b',{},String(value)),node('small',{},label));
  if(note)body.append(node('span',{className:'theam-metric-note'},note));
  card.append(node('span',{className:'theam-metric-icon'},icon),body);
  return card;
}
const sampleStopNames=['Abdullahpur','Uttara','Banani','Mohakhali','Farmgate','Motijheel'];
function chooseRoute(routes,services){
  const active=routes.filter(r=>r.active);
  return active.find(r=>services.some(s=>s.active&&s.route_id===r.id))||active[0]||routes[0];
}
function mapSVG(stops){
  const map=document.createElementNS('http://www.w3.org/2000/svg','svg');
  map.setAttribute('viewBox','0 0 620 360');
  map.setAttribute('role','img');
  map.setAttribute('aria-label','Positions of approved stops along this corridor');
  const line=document.createElementNS('http://www.w3.org/2000/svg','polyline');
  const coords=stops.filter(x=>Number.isFinite(Number(x.latitude))&&Number.isFinite(Number(x.longitude))&&x.latitude!=null&&x.longitude!=null);
  if(coords.length!==stops.length||coords.length<2)return null;
  const xs=coords.map(s=>Number(s.longitude)),ys=coords.map(s=>Number(s.latitude));
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  const rX=Math.max(.005,maxX-minX),rY=Math.max(.005,maxY-minY);
  const points=stops.map(s=>({name:s.name,x:70+(Number(s.longitude)-minX)/rX*470,y:300-(Number(s.latitude)-minY)/rY*240}));
  line.setAttribute('points',points.map(p=>p.x+','+p.y).join(' '));
  line.setAttribute('fill','none');line.setAttribute('stroke','#4af9a2');
  line.setAttribute('stroke-width','6');line.setAttribute('stroke-linecap','round');
  line.setAttribute('stroke-linejoin','round');
  line.setAttribute('filter','drop-shadow(0 0 8px #16d69b)');
  map.append(line);
  for(const [index,p] of points.entries()){
    const circle=document.createElementNS('http://www.w3.org/2000/svg','circle');
    circle.setAttribute('cx',String(p.x));circle.setAttribute('cy',String(p.y));
    circle.setAttribute('r',index===0||index===points.length-1?'10':'8');
    circle.setAttribute('fill',index===points.length-1?'#f8a18e':'#41fba8');
    circle.setAttribute('stroke','#062d2a');circle.setAttribute('stroke-width','3');
    const title=document.createElementNS('http://www.w3.org/2000/svg','title');
    title.textContent=p.name;circle.append(title);map.append(circle);
    const label=document.createElementNS('http://www.w3.org/2000/svg','text');
    label.setAttribute('x',String(Math.min(520,Math.max(10,p.x+12))));
    label.setAttribute('y',String(p.y-13));
    label.setAttribute('fill','#f0fff7');label.setAttribute('font-size','15');
    label.setAttribute('font-family','Arial,sans-serif');label.setAttribute('font-weight','bold');
    label.textContent=p.name;map.append(label);
  }
  return map;
}

function drawDemandChart(target,requests){
  target.replaceChildren();
  const today=new Date();
  const entries=Array.from({length:7},(_,i)=>{
    const day=new Date(today.getFullYear(),today.getMonth(),today.getDate()-6+i);
    const key=day.toISOString().slice(0,10);
    const count=requests.filter(r=>String(r.created_at||'').startsWith(key)).length;
    return {day:day.toLocaleDateString('en-US',{weekday:'short'}),count};
  });
  const max=Math.max(1,...entries.map(x=>x.count));
  const chart=node('div',{className:'theam-demand-bars','aria-label':'Requests received over the last seven days'});
  for(const entry of entries){
    const col=node('div',{className:'theam-demand-column',title:entry.day+': '+entry.count+' requests'});
    const bar=node('span',{className:'theam-demand-bar'});
    bar.style.height=(14+80*entry.count/max)+'%';
    bar.setAttribute('aria-label',entry.count+' requests');
    col.append(node('b',{},String(entry.count)),bar,node('small',{},entry.day));
    chart.append(col);
  }
  const footer=node('div',{className:'theam-demand-chart-footer'});
  footer.append(node('span',{},requests.length+' requests in the visible queue'),
    node('span',{},'Last 7 days · no estimates'));
  target.append(chart,footer);
}
function renderDemandPreview(requests,summary){
  const cards=$('theamOpsRequestsSummary'),candidate=$('theamOpsCandidates');
  cards.replaceChildren();candidate.replaceChildren();
  if(!requests.length)cards.append(node('p',{className:'theam-ops-empty'},'No passenger requests yet.'));
  for(const r of requests.slice(0,4)){
    const row=node('div',{className:'theam-ops-request-mini'});
    row.append(node('span',{className:'theam-ops-person-icon'},'♧'));
    const copy=node('div');
    copy.append(node('b',{},r.home_zone+' → '+r.office_zone),
      node('small',{},r.request_kind==='new_stop'?'New stop request':
        r.request_kind==='more_seats'?'Capacity request':'New corridor request'));
    row.append(copy,pill((r.status||'open').toUpperCase(),r.status==='open'?'is-open':''));
    cards.append(row);
  }
  if(!summary.length){
    candidate.append(node('p',{className:'theam-ops-empty'},'Passenger requests will inform future route-planning decisions.'));
    return;
  }
  for(const r of summary.slice(0,3)){
    const row=node('div',{className:'theam-ops-candidate'});
    const copy=node('div');
    copy.append(node('b',{},r.pickup+' → '+r.destination),
      node('small',{},r.total_requests+' requests · '+r.interested_riders+' interested riders'));
    const review=node('button',{type:'button'},'Review →');
    review.onclick=()=>scrollTo('theamOpsDemandSection');
    row.append(copy,review);candidate.append(row);
  }
}
export async function renderOpsTheam({overview,requests,demandSummary,allServices,stops,vehicles,routes},api){
  const activeRoutes=routes.filter(r=>r.active);
  const activeServices=allServices.filter(s=>s.active);
  const dashboard=$('opsDashboard');
  const passengers=$('theamOpsPassengerSection');
  passengers.replaceChildren();
  passengers.append(node('h3',{},'Passengers & subscriptions'),
    node('p',{},overview.confirmedSubscriptions+' confirmed paid bookings. Individual passenger details remain restricted to authorized service workflows.'));
  dashboard.replaceChildren(
    kpi('Confirmed Bookings',overview.confirmedSubscriptions,'♧'),
    kpi('Active Vehicles',overview.activeVehicles,'▣'),
    kpi('Active Routes',activeRoutes.length,'⌘'),
    kpi('Open Requests',overview.openRequests,'▦'),
    kpi('Active Services',activeServices.length,'▤'),
    kpi('CO₂ Saved','—','♧','Not calculated')
  );
  renderDemandPreview(requests,demandSummary);
  drawDemandChart($('theamOpsDemandInsights'),requests);
  const chosen=chooseRoute(routes,allServices);
  const routeDetails=$('theamOpsRouteDetails'),map=$('theamOpsMap');
  routeDetails.replaceChildren();
  map.replaceChildren();
  if(!chosen){
    routeDetails.append(pill('NO ACTIVE ROUTES','is-open'),
      node('h2',{},'Your route network'),
      node('p',{},'Add verified boarding stops and create a route to populate this dashboard.'),
      node('p',{className:'theam-ops-muted'},'Example: Abdullahpur → Motijheel'));
    const example=node('div',{className:'theam-ops-example'});
    example.append(node('b',{},'Illustrative route only'));
    for(const s of sampleStopNames){
      example.append(node('div',{},'◉ &nbsp; '+s));
    }
    routeDetails.append(example);
    map.append(node('div',{className:'theam-map-empty'},
      'No verified route coordinates available yet. The map updates when Operations publishes real approved stops.'));
  } else {
    routeDetails.append(pill(chosen.active?'APPROVED CORRIDOR':'DRAFT CORRIDOR',chosen.active?'is-live':'is-open'),
      node('h2',{},chosen.name||chosen.home_zone+' → '+chosen.office_zone));
    const service=allServices.find(s=>s.route_id===chosen.id&&s.active);
    if(service)routeDetails.append(node('p',{},'Service: '+service.code+' · Morning '+formatTime(service.morning_departure)+' · Return '+formatTime(service.evening_departure)));
    else routeDetails.append(node('p',{},'No active vehicle assigned to this corridor.'));
    try{
      const data=await api('/api/admin/routes/'+chosen.id+'/stops',{auth:true});
      const morning=data.stops.filter(s=>s.direction==='morning').sort((a,b)=>a.stop_order-b.stop_order);
      const line=node('div',{className:'theam-ops-example'});
      for(const stop of morning)line.append(node('div',{},'◉ &nbsp; '+stop.name));
      routeDetails.append(line);
      const physical=morning.map(s=>({...s,...stops.find(x=>x.id===s.stop_id)}));
      const plot=mapSVG(physical);
      if(plot)map.append(plot);
      else map.append(node('div',{className:'theam-map-empty'},
        'Approved stops are listed; geographic map pins require verified stop coordinates.'));
    }catch{
      map.append(node('p',{className:'theam-map-empty'},'Route mapping is unavailable. Please refresh.'));
    }
  }
  const fleet=$('theamOpsVehicleContent');
  fleet.replaceChildren();
  const next=vehicles.find(v=>v.active&&v.documents_verified&&v.seat_map_verified)||vehicles[0];
  if(!next)fleet.append(node('p',{className:'theam-ops-empty'},'No registered vehicles. Add and verify the fleet before activating a route.'));
  else {
    const visual=node('div',{className:'theam-ops-vehicle-banner'});
    visual.append(node('img',{src:'/theam/coach.svg',alt:'Illustrative coach icon; registered vehicle may differ'}));
    const details=node('div');
    details.append(node('b',{},next.registration_no),
      node('small',{},next.class.toUpperCase()+' · '+next.mapped_seats+' mapped seats'));
    visual.append(details,pill(next.active?'ACTIVE':'INACTIVE',next.active?'is-live':'is-open'));
    fleet.append(visual,node('p',{className:'theam-ops-muted'},'Vehicle compliance: '+(next.documents_verified&&next.seat_map_verified?'Verified documents and seat map':'Pending verification')));
  }
  const status=$('theamOpsServiceStatus');
  status.replaceChildren();
  if(!allServices.length)status.append(node('p',{className:'theam-ops-empty'},'No scheduled services yet.'));
  for(const s of allServices.slice(0,4)){
    const row=node('div',{className:'theam-ops-service-row'});
    const text=node('div');
    text.append(node('b',{},s.code),
      node('small',{},'Morning '+formatTime(s.morning_departure)+' · Return '+formatTime(s.evening_departure)));
    row.append(node('span',{className:'theam-service-icon'},s.active?'▣':'◷'),text,pill(s.active?'ACTIVE':'DRAFT',s.active?'is-live':'is-open'));
    status.append(row);
  }
}

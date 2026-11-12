import {$,node,state,api,formatTime,showToast} from '../../core/context.js';
import {seatPositions} from './seatTemplates.js';
import {openStaffVerification} from '../auth/index.js';
import {loadDemoManagement} from '../demo/admin.js';

let activeWorkspaceTab = 'fleet';
function kpi(label,value){const b=node('div',{className:'ops-kpi'});b.append(node('b',{},String(value)),node('small',{},label));return b}
function field(label,name,type='text',placeholder=''){const wrap=node('label',{},label),input=node('input',{type,name,placeholder,required:''});wrap.append(input);return {wrap,input}}
function selectField(label,name,entries){const wrap=node('label',{},label),input=node('select',{name});for(const [value,text] of entries)input.append(node('option',{value},text));wrap.append(input);return {wrap,input}}
export async function loadOperations(){
  if(!['admin','dispatcher'].includes(state.user?.role))return;
  const dashboard=$('opsDashboard'),demand=$('opsDemand'),services=$('opsServices'),builder=$('opsBuilder');
  dashboard.replaceChildren(node('div',{className:'empty-message'},'Loading fleet…'));demand.replaceChildren();services.replaceChildren();builder.replaceChildren();
  if (!state.user.mfa_verified && import.meta.env.MODE !== 'development') {
    const panel = node('section', {className: 'ops-security-card'});
    panel.append(node('div', {className: 'ops-security-icon', 'aria-hidden': 'true'}, '🔐'));
    const body = node('div');
    body.append(node('h3', {}, 'Verify your staff account'));
    body.append(node('p', {}, 'For your safety, fleet administration requires two-step verification. Open your authenticator app to enroll or enter your current 6-digit code.'));
    const action = node('button', {type: 'button', className: 'primary'}, 'Set up / verify authenticator');
    action.onclick = () => openStaffVerification(() => loadOperations());
    body.append(action);
    panel.append(body);
    dashboard.replaceChildren(panel);
    return;
  }
  try{
    const [overview,requests,allServices,stops,vehicles,routes]=await Promise.all([
      api('/api/admin/overview',{auth:true}),api('/api/admin/demand',{auth:true}),api('/api/admin/services',{auth:true}),api('/api/admin/stops',{auth:true}),api('/api/admin/vehicles',{auth:true}),api('/api/admin/routes',{auth:true})]);
    dashboard.replaceChildren(kpi('Active vehicles',overview.activeVehicles),kpi('Open route requests',overview.openRequests),kpi('Confirmed paid bookings',overview.confirmedSubscriptions));
    if(!requests.length)demand.append(node('div',{className:'empty-message'},'No pending route requests.'));
    for(const r of requests.slice(0,25)){const card=node('div',{className:'pass-card'}),left=node('div');left.append(node('strong',{},r.home_zone+' → '+r.office_zone),node('p',{},`${r.preferred_class||'Any vehicle'} · ${new Date(r.created_at).toLocaleDateString()}`));card.append(left,node('span',{className:'pill'},r.status));demand.append(card)}
    if(!allServices.length)services.append(node('div',{className:'empty-message'},'No scheduled services yet.'));
    for(const s of allServices){const card=node('div',{className:'pass-card'}),left=node('div');left.append(node('strong',{},s.code),node('p',{},`${formatTime(s.morning_departure)} / ${formatTime(s.evening_departure)} · ${s.active?'ACTIVE':'INACTIVE'}`));
      const toggle=node('button',{className:'outline',type:'button'},s.active?'Pause service':'Activate service');
      toggle.onclick=async()=>{toggle.disabled=true;try{await api('/api/admin/services/'+s.id+'/activate',{method:'PATCH',auth:true,json:{active:!s.active}});showToast('Service state updated');loadOperations()}catch(e){showToast(e.message);toggle.disabled=false}};
      card.append(left,toggle);services.append(card)}
    if(state.user.role==='admin'){
      const demoPanel=node('section',{className:'ops-demo-management'});
      builder.append(demoPanel);
      loadDemoManagement(demoPanel,vehicles,loadOperations).catch(e=>{
        demoPanel.append(node('div',{className:'error-note'},'Demo management unavailable: '+e.message));
      });
      buildAdminForms(builder,{stops,vehicles,routes,allServices});
    }
    showReviewQueues(builder,state.user.role).catch(e=>showToast('Review items are temporarily unavailable. '+e.message));
  }catch(e){dashboard.replaceChildren(node('div',{className:'empty-message'},e.message))}
}
function buildAdminForms(root,{stops,vehicles,routes,allServices}){
  root.append(node('h3',{},'Fleet management'));
  const help=node('p',{className:'helper-copy'},
    'Manage vehicles, pickup points, drivers and schedules. New services stay inactive until approved.');
  root.append(help);

  const definitions = [
    ['fleet', 'Vehicles & seats', 'Register vehicles, review seat layouts and approve documents'],
    ['routes', 'Stops & routes', 'Set pickup stops and morning/evening routes'],
    ['schedule', 'Timetables', 'Assign vehicles and departure times to approved routes'],
    ['staff', 'Drivers & roles', 'Manage driver access, licences and assignments'],
  ];
  const tabs = node('div', {className: 'ops-workspace-tabs', role: 'tablist', 'aria-label': 'Fleet management sections'});
  const workspace = node('div', {className: 'ops-workspace'});
  const groups = {}, panels = {}, tabButtons = {};
  for (const [key,label,description] of definitions) {
    const button = node('button', {type: 'button', className: 'ops-workspace-tab', role: 'tab',
      id: 'ops-tab-'+key, 'aria-controls': 'ops-panel-'+key}, label);
    tabButtons[key] = button;
    tabs.append(button);
    const panel = node('section', {id: 'ops-panel-'+key, className: 'ops-workspace-panel',
      role: 'tabpanel', 'aria-labelledby': 'ops-tab-'+key});
    panel.append(node('p', {className: 'ops-workspace-description'}, description));
    const grid = node('div', {className: 'ops-controls'});
    panel.append(grid);
    panels[key] = panel;
    groups[key] = grid;
    workspace.append(panel);
    button.onclick = () => showTab(key);
  }
  function showTab(key) {
    activeWorkspaceTab = key;
    for (const [name] of definitions) {
      const selected = key === name;
      panels[name].classList.toggle('hidden', !selected);
      tabButtons[name].classList.toggle('active', selected);
      tabButtons[name].setAttribute('aria-selected', String(selected));
      tabButtons[name].tabIndex = selected ? 0 : -1;
    }
  }
  tabs.addEventListener('keydown', event => {
    if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    event.preventDefault();
    const keys = definitions.map(([key]) => key);
    let next = keys.indexOf(activeWorkspaceTab);
    if (event.key === 'ArrowLeft') next = (next + keys.length - 1) % keys.length;
    if (event.key === 'ArrowRight') next = (next + 1) % keys.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = keys.length - 1;
    showTab(keys[next]);
    tabButtons[keys[next]].focus();
  });
  root.append(tabs, workspace);
  if (!definitions.some(([key]) => key === activeWorkspaceTab)) activeWorkspaceTab = 'fleet';

  const registry = node('div', {className: 'ops-registry'});
  registry.append(node('h4', {}, 'Registered vehicles · '+vehicles.length));
  if (!vehicles.length) {
    registry.append(node('p', {className:'ops-muted'}, 'No vehicles registered yet. Add an approved vehicle to begin.'));
  }
  for (const vehicle of vehicles) {
    const row = node('div', {className: 'ops-registry-row'});
    const left = node('div');
    left.append(node('strong', {}, vehicle.registration_no));
    left.append(node('small', {}, vehicle.class.toUpperCase()+' · '+vehicle.mapped_seats+'/'+vehicle.licensed_passenger_capacity+' passenger seats'));
    const status = vehicle.active && vehicle.documents_verified && vehicle.seat_map_verified
      ? 'Verified & active' : 'Pending verification';
    row.append(left, node('span', {className: 'ops-status'+(vehicle.active ? ' ops-status-active' : '')},status));
    registry.append(row);
  }
  panels.fleet.insertBefore(registry, groups.fleet);
  const routesRegistry = node('div', {className: 'ops-registry'});
  routesRegistry.append(node('h4', {}, 'Routes · '+routes.length));
  if (!routes.length) routesRegistry.append(node('p', {className:'ops-muted'}, 'No routes yet. Add your pickup and drop-off stops to begin.'));
  for (const route of routes) {
    const row = node('div', {className: 'ops-registry-row'});
    row.append(node('strong', {}, route.home_zone+' → '+route.office_zone));
    row.append(node('span', {className: 'ops-status'+(route.active ? ' ops-status-active' : '')}, route.active?'Active':'Inactive'));
    routesRegistry.append(row);
  }
  panels.routes.insertBefore(routesRegistry, groups.routes);

  // 1. Approved boarding stop
  const stopForm=node('form'),stopName=field('Stop name','name'),stopZone=field('Zone / neighborhood','zone'),lat=field('Latitude','latitude','number','23.7800'),lon=field('Longitude','longitude','number','90.4100');
  for(const x of [lat.input,lon.input]){x.step='any'}
  const approved=node('label',{},'I verified this is an approved, safe boarding stop'),approvedBox=node('input',{type:'checkbox'});approvedBox.style.width='auto';approved.prepend(approvedBox);
  const stopSubmit=node('button',{className:'primary',type:'submit'},'Save boarding stop');stopForm.append(node('h4',{},'Register approved boarding stop'),stopName.wrap,stopZone.wrap,lat.wrap,lon.wrap,approved,stopSubmit);
  stopForm.onsubmit=async e=>{e.preventDefault();stopSubmit.disabled=true;try{await api('/api/admin/stops',{method:'POST',auth:true,json:{name:stopName.input.value,zone:stopZone.input.value,latitude:Number(lat.input.value),longitude:Number(lon.input.value),approved:approvedBox.checked}});showToast('Stop registered');loadOperations()}catch(e){showToast(e.message);stopSubmit.disabled=false}};groups.routes.append(stopForm);
  // 2. Fleet + actual seating layout. Initial template is NOT verified.
  const vForm=node('form'),reg=field('Official registration number','registrationNo'),operator=field('Licensed operator name','operatorName'),klass=selectField('Vehicle class','vehicleClass',[['bus','Bus'],['hiace','Hiace'],['car','Shared car']]),cap=field('Licensed passenger capacity','capacity','number','12');cap.input.min=1;cap.input.max=60;const fitness=field('Fitness certificate expiry','fitnessExpiresOn','date'),insurance=field('Passenger insurance expiry','insuranceExpiresOn','date');const vSubmit=node('button',{className:'primary',type:'submit'},'Register with seat-map draft');
  vForm.append(node('h4',{},'Register vehicle and draft seats'),reg.wrap,operator.wrap,klass.wrap,cap.wrap,fitness.wrap,insurance.wrap,node('p',{className:'ops-help'},'A draft 2+2 bus, 1+2 Hiace, or shared-car layout is created. After checking the actual vehicle, an admin must verify the map and documents before activation.'),vSubmit);
  vForm.onsubmit=async e=>{e.preventDefault();vSubmit.disabled=true;const vehicleClass=klass.input.value,n=Number(cap.input.value);if(vehicleClass==='car'&&n>4){vSubmit.disabled=false;return showToast('Use at most 4 passenger seats in this shared-car template')}const positions=seatPositions(vehicleClass,n);
    try{await api('/api/admin/vehicles',{method:'POST',auth:true,json:{registrationNo:reg.input.value,operatorName:operator.input.value,vehicleClass,licensedPassengerCapacity:n,fitnessExpiresOn:fitness.input.value||null,insuranceExpiresOn:insurance.input.value||null,seats:positions}});showToast('Vehicle saved as inactive, awaiting physical verification');loadOperations()}catch(e){showToast(e.message);vSubmit.disabled=false}};groups.fleet.append(vForm);
  // 3. Verify the registered vehicle after physical audit.
  const checkForm=node('form'),verifyVehicle=selectField('Vehicle to verify','vehicleId',vehicles.map(v=>[v.id,`${v.registration_no} · ${v.class} · ${v.mapped_seats} seats`]));const checkDocs=node('label',{},'Documents, fitness and insurance verified'),docsBox=node('input',{type:'checkbox'});checkDocs.prepend(docsBox);docsBox.style.width='auto';const checkSeats=node('label',{},'Actual seat map and capacity inspected'),seatsBox=node('input',{type:'checkbox'});checkSeats.prepend(seatsBox);seatsBox.style.width='auto';
  const fitnessVerify=field('Current fitness expiry','fitnessExpiresOn','date'),insuranceVerify=field('Current insurance expiry','insuranceExpiresOn','date');const checkSubmit=node('button',{className:'primary',type:'submit'},'Verify & activate vehicle');checkForm.append(node('h4',{},'Approve documents and activate vehicle'),verifyVehicle.wrap,fitnessVerify.wrap,insuranceVerify.wrap,checkDocs,checkSeats,checkSubmit);
  checkForm.onsubmit=async e=>{e.preventDefault();if(!docsBox.checked||!seatsBox.checked)return showToast('Complete both physical verification checks first');checkSubmit.disabled=true;
    try{await api('/api/admin/vehicles/'+verifyVehicle.input.value+'/verify',{method:'PATCH',auth:true,json:{documentsVerified:true,seatMapVerified:true,active:true,fitnessExpiresOn:fitnessVerify.input.value||null,insuranceExpiresOn:insuranceVerify.input.value||null}});showToast('Verified vehicle activated');loadOperations()}catch(e){showToast(e.message);checkSubmit.disabled=false}};groups.fleet.append(checkForm);
  // 4. Route builder with actual stop ordering.
  const rForm=node('form'),rName=field('Route display name','name'),home=field('Home / residential zone','homeZone'),office=field('Office zone','officeZone'),addStop=selectField('Choose stop to append','stop',stops.filter(s=>s.approved&&s.active).map(s=>[s.id,s.name+' · '+s.zone]));
  const order=[],list=node('div',{className:'stop-order-list'}),add=node('button',{className:'outline',type:'button'},'+ Add stop to morning route');
  function renderOrder(){list.replaceChildren();for(let i=0;i<order.length;i++){const row=node('div',{className:'stop-order-row'}),s=stops.find(x=>x.id===order[i]);row.append(node('span',{},`${i+1}. ${s?.name||order[i]}`));const up=node('button',{type:'button'},'↑'),down=node('button',{type:'button'},'↓'),remove=node('button',{type:'button'},'×');up.disabled=i===0;down.disabled=i===order.length-1;up.onclick=()=>{[order[i-1],order[i]]=[order[i],order[i-1]];renderOrder()};down.onclick=()=>{[order[i+1],order[i]]=[order[i],order[i+1]];renderOrder()};remove.onclick=()=>{order.splice(i,1);renderOrder()};row.append(up,down,remove);list.append(row)}}
  add.onclick=()=>{const id=addStop.input.value;if(!id||order.includes(id))return showToast('Stop already added or none available');order.push(id);renderOrder()};
  const rSubmit=node('button',{className:'primary',type:'submit'},'Create morning + reverse evening route');rForm.append(node('h4',{},'Create approved route corridor'),rName.wrap,home.wrap,office.wrap,addStop.wrap,add,list,node('p',{className:'ops-help'},'Pick a minimum of 2 approved stops in actual morning travel order. Evening drop-off sequence is generated in reverse.'),rSubmit);
  rForm.onsubmit=async e=>{e.preventDefault();if(order.length<2)return showToast('Select at least two approved boarding stops');rSubmit.disabled=true;
    try{await api('/api/admin/routes',{method:'POST',auth:true,json:{name:rName.input.value,homeZone:home.input.value,officeZone:office.input.value,morningStops:order,eveningStops:[...order].reverse()}});showToast('Approved corridor created');loadOperations()}catch(e){showToast(e.message);rSubmit.disabled=false}};groups.routes.append(rForm);
  // 5. Scheduled service - inactive until driver assigned.
  const sForm=node('form'),code=field('Service code','code','text','TH-101'),route=selectField('Approved corridor','routeId',routes.filter(r=>r.active).map(r=>[r.id,r.name])),fleet=selectField('Verified fleet vehicle','vehicleId',vehicles.filter(v=>v.active&&v.documents_verified&&v.seat_map_verified).map(v=>[v.id,v.registration_no+' · '+v.class])),morning=field('Morning start (24h)','morningDeparture','time'),evening=field('Evening return (24h)','eveningDeparture','time');
  morning.input.value='07:30';evening.input.value='18:00';const days=field('ISO operation days (comma separated)','days','text','1,2,3,4,7');days.input.value='1,2,3,4,7';const sSubmit=node('button',{className:'primary',type:'submit'},'Create inactive service');
  sForm.append(node('h4',{},'Schedule a verified vehicle'),code.wrap,route.wrap,fleet.wrap,morning.wrap,evening.wrap,days.wrap,node('p',{className:'ops-help'},'Bangladesh operating days are adjustable by company and public holiday policy; 1=Mon, 7=Sun.'),sSubmit);
  sForm.onsubmit=async e=>{e.preventDefault();sSubmit.disabled=true;try{await api('/api/admin/services',{method:'POST',auth:true,json:{code:code.input.value,routeId:route.input.value,vehicleId:fleet.input.value,morningDeparture:morning.input.value,eveningDeparture:evening.input.value,operatingDays:days.input.value.split(',').map(s=>Number(s.trim()))}});showToast('Inactive service created. Assign a driver before activation.');loadOperations()}catch(e){showToast(e.message);sSubmit.disabled=false}};groups.schedule.append(sForm);
  const aForm=node('form'),service=selectField('Service requiring driver','serviceId',allServices.map(s=>[s.id,s.code])),driver=field('Verified driver UUID','driverId'),assign=node('button',{className:'primary',type:'submit'},'Assign verified driver');
  aForm.append(node('h4',{},'Assign approved driver to service'),service.wrap,driver.wrap,node('p',{className:'ops-help'},'Driver must have signed in and been granted a driver role by an administrator.'),assign);
  aForm.onsubmit=async e=>{e.preventDefault();assign.disabled=true;try{await api('/api/admin/driver-assignments',{method:'POST',auth:true,json:{serviceId:service.input.value,driverId:driver.input.value}});showToast('Driver assignment saved. Service can now be activated.');loadOperations()}catch(e){showToast(e.message);assign.disabled=false}};groups.staff.append(aForm);

  // 7. Admin-granted driver/staff authorization. Staff never self-register roles.
  const roleForm=node('form'),roleId=field('Verified user UUID','userId'),roleChoice=selectField('Role','role',[['driver','Driver'],['dispatcher','Dispatcher'],['rider','Rider']]),roleSave=node('button',{className:'primary',type:'submit'},'Update verified user role');
  roleForm.append(node('h4',{},'Grant verified staff role'),roleId.wrap,roleChoice.wrap,roleSave);
  roleForm.onsubmit=async e=>{e.preventDefault();roleSave.disabled=true;try{await api('/api/admin/users/'+roleId.input.value+'/role',{method:'PATCH',auth:true,json:{role:roleChoice.input.value}});showToast('Staff role updated');}catch(err){showToast(err.message)}finally{roleSave.disabled=false}};groups.staff.append(roleForm);
  // 8. Physical driving-license approval is required before dispatch assignment.
  const dForm=node('form'),driverId=field('Verified driver UUID','driverId'),license=field('Driving license reference','licenseReference'),licenseExpiry=field('Driving license expiry','licenseExpiresOn','date'),verifyBtn=node('button',{className:'primary',type:'submit'},'Approve inspected driver license');
  dForm.append(node('h4',{},'Verify driving licence'),driverId.wrap,license.wrap,licenseExpiry.wrap,node('p',{className:'ops-help'},'Verify the actual driving licence and identity offline before marking approved.'),verifyBtn);
  dForm.onsubmit=async e=>{e.preventDefault();verifyBtn.disabled=true;try{await api('/api/admin/drivers/'+driverId.input.value+'/verify',{method:'POST',auth:true,json:{licenseReference:license.input.value,licenseExpiresOn:licenseExpiry.input.value}});showToast('Driving license compliance approved');}catch(err){showToast(err.message)}finally{verifyBtn.disabled=false}};groups.staff.append(dForm);

  // 9. Before verification, replace draft coordinates with the observed physical cabin.
  const seatForm=node('form'),editVehicle=selectField('Unverified vehicle','vehicleId',vehicles.filter(v=>!v.active&&!v.seat_map_verified).map(v=>[v.id,v.registration_no])),seatJson=node('textarea',{rows:'9','aria-label':'Physical passenger seat positions JSON',placeholder:'[{"label":"B01","rowNo":1,"colNo":0}, ...]'}),loadMap=node('button',{className:'outline',type:'button'},'Load draft seat positions'),seatSave=node('button',{className:'primary',type:'submit'},'Save inspected physical seat map');
  loadMap.onclick=async()=>{try{const positions=await api('/api/admin/vehicles/'+editVehicle.input.value+'/seats',{auth:true});seatJson.value=JSON.stringify(positions.map(s=>({label:s.label,rowNo:s.rowNo,colNo:s.colNo})),null,2)}catch(e){showToast(e.message)}};
  seatForm.append(node('h4',{},'Inspect and correct the real cabin'),editVehicle.wrap,loadMap,node('label',{},'PASSENGER SEAT MAP (POSITION JSON)'),seatJson,node('p',{className:'ops-help'},'Only passenger seats. Mark steering wheel and emergency exits as empty positions. Exact coordinates must be checked in the actual vehicle; layout cannot change after a reservation.'),seatSave);
  seatForm.onsubmit=async e=>{e.preventDefault();seatSave.disabled=true;try{const seats=JSON.parse(seatJson.value);await api('/api/admin/vehicles/'+editVehicle.input.value+'/seats',{method:'PUT',auth:true,json:{seats}});showToast('Draft layout updated. Requires independent verification.');loadOperations()}catch(err){showToast(err.message)}finally{seatSave.disabled=false}};groups.fleet.append(seatForm);
  // Fleet workflow: register -> inspect actual seats -> verify and activate.
  groups.fleet.insertBefore(seatForm, checkForm);
  showTab(activeWorkspaceTab);
}


async function showReviewQueues(root,role){
  const [tickets,payments]=await Promise.all([
    api('/api/admin/support',{auth:true}), role==='admin'?api('/api/admin/payments/review',{auth:true}):Promise.resolve([])]);
  const section=node('section',{className:'ops-section'});
  section.append(node('h3',{},`Support and safety reports (${tickets.length})`));
  if(!tickets.length)section.append(node('p',{},'No open reports.'));
  for(const ticket of tickets){
    const item=node('div',{className:'pass-card'}),left=node('div');
    left.append(node('strong',{},`${ticket.category.toUpperCase()} · ${ticket.status}`),node('p',{},ticket.message));
    const action=node('button',{className:'outline',type:'button'},'Mark in progress');
    action.onclick=async()=>{try{await api('/api/admin/support/'+ticket.id,{method:'PATCH',auth:true,json:{status:'in_progress'}});showToast('Support issue updated');loadOperations()}catch(e){showToast(e.message)}};
    item.append(left,action);section.append(item);
  }
  root.append(section);
  if(role==='admin'){
    const paymentSection=node('section',{className:'ops-section'});
    paymentSection.append(node('h3',{},`Payments requiring review (${payments.length})`));
    paymentSection.append(node('p',{className:'ops-help'},'These records require finance reconciliation and possible refunds. Never mark a payment paid without independent provider verification.'));
    if(!payments.length)paymentSection.append(node('p',{},'No payments need review.'));
    for(const entry of payments){
      const row=node('div',{className:'pass-card'}),left=node('div');
      left.append(node('strong',{},`${entry.code} · ${entry.status}`),node('p',{},`${entry.merchant_tran_id} · ${entry.amount_bdt} BDT`));
      row.append(left);paymentSection.append(row);
    }
    root.append(paymentSection);
  }
}

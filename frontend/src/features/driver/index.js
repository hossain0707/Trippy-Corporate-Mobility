import {$,node,state,api,formatTime,showToast} from '../../core/context.js';
export function stopDriverGPS(){
  if(state.driverWatch!==null&&navigator.geolocation)navigator.geolocation.clearWatch(state.driverWatch);
  state.driverWatch=null;state.driverLastPing=0;
  if($('driverStatus'))$('driverStatus').replaceChildren(node('p',{},'Location sharing stopped.'));
}
export async function loadDriver(){
  const el=$('driverServices');el.replaceChildren();if(state.user?.role!=='driver')return el.append(node('div',{className:'empty-message'},'This page is available to authorized drivers.'));
  try{const duties=await api('/api/driver/assignments',{auth:true});
    if(!duties.length)return el.append(node('div',{className:'empty-message'},'No assigned trips yet. Contact dispatch for your schedule.'));
    for(const duty of duties){const card=node('article',{className:'pass-card'}),left=node('div');left.append(node('strong',{},duty.code),node('p',{},`${formatTime(duty.morning_departure)} outward · ${formatTime(duty.evening_departure)} return`));
      const start=node('button',{className:'primary',type:'button'},'Start location sharing');
      start.onclick=()=>{
        if(!navigator.geolocation)return showToast('This browser does not support geolocation.');
        if(state.driverWatch!==null)stopDriverGPS();
        const status=$('driverStatus');status.classList.remove('hidden');status.replaceChildren(node('p',{},'Requesting GPS permission…'));
        state.driverWatch=navigator.geolocation.watchPosition(async position=>{
          if(Date.now()-state.driverLastPing<14000)return;state.driverLastPing=Date.now();
          try{await api('/api/driver/location',{method:'POST',auth:true,json:{serviceId:duty.service_id,latitude:position.coords.latitude,longitude:position.coords.longitude,accuracyMeters:Math.min(2000,position.coords.accuracy||0),measuredAt:new Date(position.timestamp).toISOString()}});
            status.replaceChildren(node('p',{},`GPS sent for ${duty.code} at ${new Date().toLocaleTimeString()}. Accuracy ±${Math.round(position.coords.accuracy)} m.`));
          }catch(e){status.replaceChildren(node('p',{className:'error-note'},e.message))}
        },e=>status.replaceChildren(node('p',{className:'error-note'},'GPS unavailable: '+e.message)),{enableHighAccuracy:true,maximumAge:10000,timeout:20000});
        start.textContent='Sharing location · Tap to stop';start.onclick=()=>{stopDriverGPS();start.textContent='Start sharing GPS';start.onclick=null;loadDriver()};
      };card.append(left,start);el.append(card)}
  }catch(e){el.append(node('div',{className:'empty-message'},e.message))}
}

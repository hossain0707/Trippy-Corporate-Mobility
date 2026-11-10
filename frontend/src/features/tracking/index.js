import {$,node,state,api,config} from '../../core/context.js';
export async function loadTracking(){const list=$('trackList');list.replaceChildren();$('trackResult').classList.add('hidden');if(!state.user){list.append(node('div',{className:'empty-message'},'Sign in with an active, confirmed pass to track your assigned ride.'));return}
  try{const passes=await api('/api/me/reservations',{auth:true});const valid=passes.filter(b=>b.status==='confirmed');if(!valid.length){list.append(node('div',{className:'empty-message'},'No confirmed paid seat passes are available for tracking.'));return}
    for(const b of valid){const card=node('article',{className:'pass-card'}),left=node('div');left.append(node('strong',{},`${b.code} · ${b.seat_label}`),node('p',{},'GPS only shown to authorized passengers.'));const btn=node('button',{className:'primary',type:'button'},'Track vehicle');
      btn.onclick=()=>{loadVehicleLocation(b.service_id,b.code);if(state.trackingTimer)clearInterval(state.trackingTimer);state.trackingTimer=setInterval(()=>{if(state.page==='tracking')loadVehicleLocation(b.service_id,b.code)},15000)};
      card.append(left,btn);list.append(card)}
  }catch(e){list.append(node('div',{className:'empty-message'},e.message))}
}
async function loadVehicleLocation(serviceId,code){const box=$('trackResult');box.classList.remove('hidden');if(!state.map||box.dataset.serviceId!==serviceId)box.replaceChildren(node('p',{},'Checking authorized driver GPS signal…'));
  try{const data=await api(`/api/tracking/${serviceId}`,{auth:true});
    const headline=`${code} · ${data.state==='live'?'Live location':data.state==='stale'?'GPS signal is stale':'No live GPS signal'}`;
    if(state.map&&box.dataset.serviceId===serviceId&&data.location){
      const coords=[Number(data.location.longitude),Number(data.location.latitude)];
      state.mapMarker.setLngLat(coords);state.map.easeTo({center:coords,duration:550});
      if(box.querySelector('h3'))box.querySelector('h3').textContent=headline;
      if(box.querySelector('[data-gps-age]'))box.querySelector('[data-gps-age]').textContent=`Last driver ping: ${data.ageSeconds} seconds ago. Accuracy: ${data.location.accuracy_m??'unknown'} meters.`;
      return;
    }
    if(state.map){state.map.remove();state.map=null;state.mapMarker=null}
    box.dataset.serviceId=serviceId;box.replaceChildren();
    box.append(node('h3',{},headline));
    if(data.location){box.append(node('p',{'data-gps-age':'true'},`Last driver ping: ${data.ageSeconds} seconds ago. Accuracy: ${data.location.accuracy_m??'unknown'} meters.`));
      box.append(node('p',{},`Latitude: ${data.location.latitude} · Longitude: ${data.location.longitude}`));
      if(config.mapKey){
        const mapSlot=node('div',{id:'liveMap','aria-label':'Live vehicle location on street map'});mapSlot.style.cssText='width:100%;height:340px;margin-top:12px;border-radius:15px;overflow:hidden';box.append(mapSlot);
        try{
          const maplibregl=(await import('maplibre-gl')).default;
          const coords=[Number(data.location.longitude),Number(data.location.latitude)];
          state.map=new maplibregl.Map({container:mapSlot,style:`https://api.maptiler.com/maps/streets-v2/style.json?key=${encodeURIComponent(config.mapKey)}`,center:coords,zoom:13,attributionControl:true});
          state.mapMarker=new maplibregl.Marker({color:'#237353'}).setLngLat(coords).addTo(state.map);
        }catch{box.append(node('p',{className:'notice'},'Street map temporarily unavailable. GPS freshness and coordinates are still shown.'))}
      }else box.append(node('p',{className:'notice'},'Street map needs a MapTiler key; authorized GPS coordinates and freshness are shown above.'));
      box.append(node('p',{className:'notice'},'Location is restricted to eligible passengers during scheduled commute windows. Arrival estimates and actual road-route overlays require a routing provider.'));
    }else box.append(node('p',{},'The assigned driver device has not yet published a location.'));
  }catch(e){box.replaceChildren(node('p',{className:'error-note'},e.message))}
}

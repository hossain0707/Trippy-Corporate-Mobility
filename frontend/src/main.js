import './style.css';
import 'maplibre-gl/dist/maplibre-gl.css';
import {$,node,state,api,dhakaDay,showToast,supabase,configured} from './core/context.js';
import {loadRoutes} from './features/search/index.js';
import {loadPasses} from './features/passes/index.js';
import {loadTracking} from './features/tracking/index.js';
import {stopDriverGPS,loadDriver} from './features/driver/index.js';
import {loadOperations} from './features/admin/index.js';
import {openPasswordUpdate,setAccount} from './features/auth/index.js';
import {initializeLanguage} from './core/locale.js';
import {initializeDhakaLocations} from './features/locations/index.js';
import './features/demand/index.js';
import './features/support/index.js';
function setPage(page){if(state.driverWatch!==null&&page!=='driver')stopDriverGPS();state.page=page;document.querySelectorAll('[data-page]').forEach(btn=>btn.classList.toggle('active',btn.dataset.page===page));
  ['search','passes','tracking','driver','ops'].forEach(p=>$('page'+p[0].toUpperCase()+p.slice(1)).classList.toggle('hidden',p!==page));$('hero').classList.toggle('hidden',page!=='search');
  if(state.trackingTimer){clearInterval(state.trackingTimer);state.trackingTimer=null}if(page!=='tracking'&&state.map){state.map.remove();state.map=null;state.mapMarker=null}
  if(page==='passes')loadPasses();if(page==='tracking')loadTracking();if(page==='driver')loadDriver();if(page==='ops')loadOperations();
  window.scrollTo({top:0,behavior:'smooth'});
}
document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>setPage(b.dataset.page));
async function initialize(){const tomorrow=dhakaDay(1);$('startDate').value=tomorrow;$('startDate').min=dhakaDay();$('startDate').max=dhakaDay(60);
  if(new URLSearchParams(location.search).get('payment'))showToast('Payment processing. Check My passes after provider verification. A browser redirect alone never confirms a seat.');
  if (!configured) {
    await loadRoutes();
    return;
  }
  let generation = 0;
  supabase.auth.onAuthStateChange((event, session) => {
    state.session = session;
    if (!session) {
      generation++;
      setAccount(null);
      return;
    }
    if (event === 'PASSWORD_RECOVERY') {
      generation++;
      openPasswordUpdate();
      return;
    }
    if (['INITIAL_SESSION', 'SIGNED_IN', 'USER_UPDATED'].includes(event)) {
      const request = ++generation;
      setTimeout(async () => {
        try {
          const user = await api('/api/me', {auth: true});
          if (request === generation) setAccount(user);
        } catch {
          if (request === generation) showToast('Account services are temporarily unavailable.');
        }
      }, 0);
    }
  });
  await loadRoutes();
}

export function applyRoleNavigation(){
  const role=state.user?.role;
  $('driverNav').classList.toggle('hidden',role!=='driver');
  $('opsNav').classList.toggle('hidden',role!=='admin'&&role!=='dispatcher');
  if(!role||!['driver','admin','dispatcher'].includes(role)){
    if(['driver','ops'].includes(state.page))setPage('search');
  }
}

initializeLanguage();
initializeDhakaLocations();
initialize();

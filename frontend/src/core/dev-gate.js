/** DEV-only customer sign-in/signup gate. UI hiding does not replace IAP/API security.
 * Only included in Dockerfile.dev builds (VITE_DEV_GATE=true).
 */
import {supabase} from './context.js';
const enabled=import.meta.env.VITE_DEV_GATE==='true';
let gate,form,status;

export function showDevAccount(user){
  if(!enabled||!gate)return;
  const app=document.getElementById('app');
  if(!app)return;
  document.documentElement.classList.toggle('theam-dev-auth',!user);
  app.hidden=!user;
  app.style.display=user?'':'none';
  gate.hidden=Boolean(user);
  if(user)form?.reset();
}
async function authenticate(create){
  if(!form||!status)return;
  if(!supabase){
    status.textContent='Sign-in is unavailable. Contact the DEV administrator.';
    return;
  }
  const email=form.elements.email.value.trim(),password=form.elements.password.value;
  if(!email||!password||!form.reportValidity())return;
  for(const button of form.querySelectorAll('button'))button.disabled=true;
  status.textContent='';
  try{
    const credentials={email,password};
    const {data,error}=create
      ?await supabase.auth.signUp({...credentials,options:{emailRedirectTo:location.origin+'/'}})
      :await supabase.auth.signInWithPassword(credentials);
    if(error)throw error;
    status.textContent=data.session?'Verifying account…':'Check your email to confirm your account.';
  }catch{
    status.textContent=create?'Unable to create an account. Check the information and try again.':
      'Unable to sign in. Check your credentials and try again.';
  }finally{
    for(const button of form.querySelectorAll('button'))button.disabled=false;
  }
}
export function initializeDevGate(){
  if(!enabled)return false;
  const app=document.getElementById('app');
  if(!app)throw new Error('Missing DEV application container');
  gate=document.createElement('section');
  gate.id='devGate';
  gate.className='theam-dev-gate';
  gate.innerHTML=`<div class="theam-dev-gate-card">
    <div class="theam-dev-gate-brand">
      <span class="logo-mark" aria-hidden="true">T</span>
      <div><strong>TRIPPY</strong><small>Corporate Mobility · DEV</small></div>
    </div>
    <h1>Sign in to TRIPPY DEV</h1>
    <p>This is a private development environment. Sign in or create a test account to continue.</p>
    <form id="devGateForm" class="form-stack">
      <label>Email<input name="email" type="email" autocomplete="email" required maxlength="254"/></label>
      <label>Password<input name="password" type="password" autocomplete="current-password" required minlength="1" maxlength="72"/></label>
      <button class="primary" type="submit">Sign in</button>
      <button class="outline" type="button" id="devSignup">Sign up</button>
      <p id="devGateStatus" role="status" aria-live="polite"></p>
    </form>
  </div>`;
  document.body.insertBefore(gate,app);
  form=gate.querySelector('#devGateForm');
  status=gate.querySelector('#devGateStatus');
  form.addEventListener('submit',event=>{event.preventDefault();void authenticate(false)});
  gate.querySelector('#devSignup').onclick=()=>{if(form.reportValidity())void authenticate(true)};
  showDevAccount(null);
  return true;
}

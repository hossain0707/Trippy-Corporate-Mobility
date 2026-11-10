import {$,node,state,supabase,configured,api,showToast,showModal,closeModal} from '../../core/context.js';
import {applyRoleNavigation} from '../../main.js';
export function openLogin(onSuccess){showModal('Sign in securely','PHONE VERIFICATION');const body=$('modalContent');const note=node('p',{className:'status-note'},'Receive a one-time code on your Bangladeshi mobile number. SMS delivery requires an enabled provider in Supabase Auth.');const form=node('form',{className:'form-stack'});
  const label=node('label',{},'MOBILE NUMBER (E.164 FORMAT)'),phone=node('input',{type:'tel',placeholder:'+8801XXXXXXXXX',required:'',pattern:'\\+8801[0-9]{9}','aria-label':'Bangladeshi mobile number'});
  label.append(phone);const btn=node('button',{className:'primary',type:'submit'},'Send one-time code');form.append(label,btn);body.append(note,form);
  form.onsubmit=async e=>{e.preventDefault();if(!configured)return showToast('Authentication is not configured');btn.disabled=true;
    const number=phone.value.trim();if(!/^\+8801\d{9}$/.test(number)){btn.disabled=false;return showToast('Enter a valid +8801XXXXXXXXX phone number')}
    try{const {error}=await supabase.auth.signInWithOtp({phone:number});if(error)throw error;
      form.replaceChildren();const otpLabel=node('label',{},'SMS VERIFICATION CODE'),otp=node('input',{type:'text',inputmode:'numeric',autocomplete:'one-time-code',required:'',minlength:'4',maxlength:'8'});
      otpLabel.append(otp);const verify=node('button',{className:'primary',type:'submit'},'Verify & sign in');form.append(otpLabel,verify);
      form.onsubmit=async ev=>{ev.preventDefault();verify.disabled=true;
        try{const {data,error}=await supabase.auth.verifyOtp({phone:number,token:otp.value.trim(),type:'sms'});if(error||!data.user)throw error||new Error('Verification failed');
          state.user=await api('/api/me',{auth:true});$('accountBtn').textContent='My account ✓';applyRoleNavigation();closeModal();showToast('Phone verified. Welcome to Trippy Corporate!');if(onSuccess)onSuccess();
        }catch(e){showToast(e.message);verify.disabled=false}
      };
    }catch(e){showToast(e.message);btn.disabled=false}
  };
}
$('accountBtn').onclick=()=>{if(!state.user){openLogin();return}showModal('My account','VERIFIED PROFILE');const body=$('modalContent');const label=node('p',{className:'status-note'},'Complete your contact details to proceed to secure payment.');
  const form=node('form',{className:'form-stack'}),nameLabel=node('label',{},'FULL NAME'),emailLabel=node('label',{},'BILLING EMAIL ADDRESS');
  const fullName=node('input',{type:'text',required:'',maxlength:'120'}),email=node('input',{type:'email',required:''});fullName.value=state.user.full_name||'';email.value=state.user.email||'';
  nameLabel.append(fullName);emailLabel.append(email);const save=node('button',{className:'primary',type:'submit'},'Save details');form.append(nameLabel,emailLabel,save);
  form.onsubmit=async e=>{e.preventDefault();save.disabled=true;try{state.user=await api('/api/me',{method:'PATCH',auth:true,json:{fullName:fullName.value,email:email.value}});showToast('Details updated');closeModal()}catch(e){showToast(e.message);save.disabled=false}};
  const logout=node('button',{className:'outline',type:'button'},'Sign out');logout.onclick=async()=>{await supabase.auth.signOut();state.user=null;state.session=null;applyRoleNavigation();$('accountBtn').textContent='Sign in ↗';closeModal();showToast('Signed out')};
  body.append(label,form,logout);
};

import {$,node,state,supabase,configured,api,showToast,showModal,closeModal} from '../../core/context.js';
import {applyRoleNavigation} from '../../main.js';
import {t} from '../../core/locale.js';
import {enabledSocialProviders} from './providers.js';

const retryMessage = 'Unable to complete this request. Please try again.';
const redirectTo = new URL(import.meta.env.BASE_URL, location.origin).href;
const providers = enabledSocialProviders(import.meta.env.VITE_SOCIAL_PROVIDERS);
let nextFieldId = 0;

const button = (label, type = 'button', className = 'outline') => node('button', {type, className}, label);

function field(form, label, attributes, value = '') {
  const id = 'auth-input-' + (++nextFieldId);
  const wrap = node('div', {className: 'auth-field'});
  const fieldLabel = node('label', {for: id}, label);
  const input = node('input', {id, required: '', ...attributes});
  input.value = value;
  wrap.append(fieldLabel);
  if (attributes.type === 'password') {
    const group = node('div', {className: 'password-input'});
    const toggle = button('👁 ' + t('Show password'), 'button', 'password-toggle');
    toggle.setAttribute('aria-label', t('Show password'));
    toggle.setAttribute('aria-pressed', 'false');
    toggle.setAttribute('aria-controls', id);
    toggle.onclick = () => {
      const visible = input.type === 'password';
      input.type = visible ? 'text' : 'password';
      toggle.textContent = '👁 ' + t(visible ? 'Hide password' : 'Show password');
      toggle.setAttribute('aria-label', t(visible ? 'Hide password' : 'Show password'));
      toggle.setAttribute('aria-pressed', String(visible));
    };
    group.append(input, toggle);
    wrap.append(group);
  } else {
    wrap.append(input);
  }
  form.append(wrap);
  return input;
}

function submit(form, label, action, errorMessage = retryMessage) {
  const control = button(label, 'submit', 'primary');
  form.append(control);
  form.onsubmit = async event => {
    event.preventDefault();
    control.disabled = true;
    try {
      await action();
    } catch {
      showToast(errorMessage);
    } finally {
      control.disabled = false;
    }
  };
}

export function setAccount(user) {
  state.user = user;
  $('accountBtn').textContent = t(user ? 'My account' : 'Sign in');
  applyRoleNavigation();
}

async function finishLogin(onSuccess) {
  setAccount(await api('/api/me', {auth: true}));
  closeModal();
  onSuccess?.();
}

export function openLogin(onSuccess, mode = 'login') {
  if (!configured) return showToast('Account services are temporarily unavailable.');
  const login = mode === 'login';
  const recovery = mode === 'reset';
  const title = login ? 'Sign in' : recovery ? 'Reset password' : 'Create account';
  showModal(title, 'Trippy Corporate');
  const form = node('form', {className: 'form-stack'});
  const email = field(form, 'Email address', {type: 'email', autocomplete: 'email'});
  const password = recovery ? null : field(form, 'Password', {
    type: 'password', autocomplete: login ? 'current-password' : 'new-password',
    minlength: login ? '1' : '12', maxlength: '72',
  });
  submit(form, recovery ? 'Send reset link' : title, async () => {
    if (recovery) {
      const {error} = await supabase.auth.resetPasswordForEmail(email.value.trim(), {redirectTo});
      if (error) throw error;
      showToast('If the account exists, check your email for a reset link.');
      closeModal();
      return;
    }
    const credentials = {email: email.value.trim(), password: password.value};
    const {data, error} = login
      ? await supabase.auth.signInWithPassword(credentials)
      : await supabase.auth.signUp({...credentials, options: {emailRedirectTo: redirectTo}});
    if (error) throw error;
    if (data.session) return finishLogin(onSuccess);
    showToast('Check your email to verify your account.');
    closeModal();
  }, login ? 'Unable to sign in. Check your details and try again.' : retryMessage);

  const changeMode = button(login ? 'Create account' : 'Sign in');
  changeMode.onclick = () => openLogin(onSuccess, login ? 'signup' : 'login');
  form.append(changeMode);
  if (login) {
    const reset = button('Forgot password?');
    reset.onclick = () => openLogin(onSuccess, 'reset');
    form.append(reset);
    if (import.meta.env.VITE_PHONE_AUTH === 'true') {
      const mobile = button('Use mobile number');
      mobile.onclick = () => openPhoneVerification(false, onSuccess);
      form.append(mobile);
    }
  }
  if (!recovery) {
    for (const [provider, label] of providers) {
      const social = button(label, 'button', 'outline social-signin social-' + provider);
      social.prepend(node('span', {className: 'social-glyph', 'aria-hidden': 'true'},
        {google: 'G', facebook: 'f', azure: 'M', apple: '●'}[provider]));
      social.onclick = async () => {
        social.disabled = true;
        try {
          const {error} = await supabase.auth.signInWithOAuth({provider, options: {redirectTo, ...(provider === 'azure' ? {scopes: 'email'} : {})}});
          if (error) throw error;
        } catch {
          social.disabled = false;
          showToast(retryMessage);
        }
      };
      form.append(social);
    }
  }
  $('modalContent').append(form);
}

function openPhoneVerification(link, onSuccess) {
  showModal(link ? 'Verify mobile number' : 'Use mobile number', 'Trippy Corporate');
  const form = node('form', {className: 'form-stack'});
  const phone = field(form, 'Mobile number', {type: 'tel', pattern: '\\+8801[0-9]{9}', placeholder: '+8801XXXXXXXXX', autocomplete: 'tel'});
  submit(form, 'Send verification code', async () => {
    const number = phone.value.trim();
    const {error} = link
      ? await supabase.auth.updateUser({phone: number})
      : await supabase.auth.signInWithOtp({phone: number});
    if (error) throw error;
    form.replaceChildren();
    const code = field(form, 'Verification code', {inputmode: 'numeric', autocomplete: 'one-time-code', pattern: '[0-9]{6}'});
    submit(form, link ? 'Verify mobile number' : 'Verify & sign in', async () => {
      const {error: verifyError} = await supabase.auth.verifyOtp({
        phone: number, token: code.value.trim(), type: link ? 'phone_change' : 'sms',
      });
      if (verifyError) throw verifyError;
      await finishLogin(onSuccess);
    });
  });
  $('modalContent').append(form);
}

export function openPasswordUpdate() {
  showModal('Set new password', 'Trippy Corporate');
  const form = node('form', {className: 'form-stack'});
  const password = field(form, 'Password', {type: 'password', autocomplete: 'new-password', minlength: '12', maxlength: '72'});
  submit(form, 'Set new password', async () => {
    const {error} = await supabase.auth.updateUser({password: password.value});
    if (error) throw error;
    const {error: logoutError} = await supabase.auth.signOut();
    if (logoutError) throw logoutError;
    openLogin();
  });
  $('modalContent').append(form);
}

function openStaffVerification() {
  showModal('Two-step verification', 'Trippy Corporate');
  const form = node('form', {className: 'form-stack'});
  const start = button('Set up or verify authenticator');
  const setup = async () => {
    const {data, error} = await supabase.auth.mfa.listFactors();
    if (error) throw error;
    let factorId = data.totp.find(factor => factor.status === 'verified')?.id;
    if (!factorId) {
      for (const factor of data.all.filter(item => item.factor_type === 'totp' && item.status === 'unverified')) {
        const {error: removeError} = await supabase.auth.mfa.unenroll({factorId: factor.id});
        if (removeError) throw removeError;
      }
      const {data: enrollment, error: enrollError} = await supabase.auth.mfa.enroll({factorType: 'totp'});
      if (enrollError) throw enrollError;
      factorId = enrollment.id;
      form.append(node('p', {}, 'Scan this code with an authenticator app.'));
      form.append(node('img', {src: enrollment.totp.qr_code, alt: t('Authenticator setup QR code'), width: '180', height: '180'}));
    }
    const code = field(form, 'Verification code', {inputmode: 'numeric', autocomplete: 'one-time-code', pattern: '[0-9]{6}'});
    submit(form, 'Two-step verification', async () => {
      const {error: verifyError} = await supabase.auth.mfa.challengeAndVerify({factorId, code: code.value});
      if (verifyError) throw verifyError;
      await finishLogin();
    });
  };
  start.onclick = async () => {
    start.disabled = true;
    try {
      await setup();
      start.remove();
    } catch {
      start.disabled = false;
      showToast(retryMessage);
    }
  };
  form.append(start);
  $('modalContent').append(form);
}

$('accountBtn').onclick = () => {
  if (!state.user) return openLogin();
  showModal('My account', 'Trippy Corporate');
  const form = node('form', {className: 'form-stack'});
  const fullName = field(form, 'Full name', {autocomplete: 'name', maxlength: '120'}, state.user.full_name || '');
  const email = field(form, 'Billing email', {type: 'email', autocomplete: 'email'}, state.user.email || '');
  submit(form, 'Save details', async () => {
    setAccount({...state.user, ...await api('/api/me', {method: 'PATCH', auth: true, json: {fullName: fullName.value, email: email.value}})});
    showToast('Details updated');
    closeModal();
  });
  if (!state.user.phone && import.meta.env.VITE_PHONE_AUTH === 'true') {
    form.append(node('p', {className: 'status-note'}, 'Add a verified mobile number before payment.'));
    const verify = button('Verify mobile number');
    verify.onclick = () => openPhoneVerification(true);
    form.append(verify);
  }
  if (['admin', 'dispatcher', 'driver'].includes(state.user.role) && !state.user.mfa_verified) {
    const verifyStaff = button('Two-step verification');
    verifyStaff.onclick = openStaffVerification;
    form.append(verifyStaff);
  }
  const logout = button('Sign out');
  logout.onclick = async () => {
    const {error} = await supabase.auth.signOut({scope: 'local'});
    if (error) return showToast(retryMessage);
    setAccount(null);
    closeModal();
  };
  form.append(logout);
  $('modalContent').append(form);
};

import {$,node,state,supabase,configured,api,showToast,showModal,closeModal} from '../../core/context.js';
import {applyRoleNavigation} from '../../main.js';
import {t} from '../../core/locale.js';
import {enabledSocialProviders} from './providers.js';

const retryMessage = 'Unable to complete this request. Please try again.';
const redirectTo = new URL(import.meta.env.BASE_URL, location.origin).href;
const providers = enabledSocialProviders(import.meta.env.VITE_SOCIAL_PROVIDERS);
let nextFieldId = 0;

const button = (label, type = 'button', className = 'outline') => node('button', {type, className}, label);

// Icons are rendered as SVG elements, not font glyphs or password-field emoji.
function passwordIcon(revealed) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  for (const [key, value] of Object.entries({
    viewBox: '0 0 24 24', width: '19', height: '19', fill: 'none',
    stroke: 'currentColor', 'stroke-width': '1.8',
    'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true',
  })) svg.setAttribute(key, value);
  const outline = document.createElementNS(ns, 'path');
  outline.setAttribute('d', 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z');
  const pupil = document.createElementNS(ns, 'circle');
  pupil.setAttribute('cx', '12');
  pupil.setAttribute('cy', '12');
  pupil.setAttribute('r', '3');
  svg.append(outline, pupil);
  if (revealed) {
    const slash = document.createElementNS(ns, 'path');
    slash.setAttribute('d', 'M3 3 21 21');
    svg.append(slash);
  }
  return svg;
}

function field(form, label, attributes, value = '') {
  const id = 'auth-input-' + (++nextFieldId);
  const wrap = node('div', {className: 'auth-field'});
  const fieldLabel = node('label', {for: id}, label);
  const input = node('input', {id, required: '', ...attributes});
  input.value = value;
  wrap.append(fieldLabel);
  if (attributes.type === 'password') {
    const group = node('div', {className: 'password-input'});
    const toggle = button('', 'button', 'password-toggle');
    const updateToggle = revealed => {
      const text = t(revealed ? 'Hide password' : 'Show password');
      toggle.setAttribute('aria-label', text);
      toggle.setAttribute('title', text);
      toggle.setAttribute('aria-pressed', String(revealed));
      toggle.replaceChildren(passwordIcon(revealed));
    };
    toggle.setAttribute('aria-controls', id);
    updateToggle(false);
    toggle.onclick = () => {
      const revealed = input.type === 'password';
      input.type = revealed ? 'text' : 'password';
      updateToggle(revealed);
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
  showModal(title, 'Trippy Corporate', {variant: 'auth'});

  const content = $('modalContent');
  const intro = login
    ? 'Welcome back. Sign in to manage your daily commute.'
    : recovery
      ? 'Enter your email and we will send you a password reset link.'
      : 'Get started with a secure account for your daily commute.';
  content.append(node('p', {className: 'auth-intro'}, intro));

  if (!recovery && providers.length) {
    const options = node('div', {className: 'auth-social-options'});
    for (const [provider, label] of providers) {
      const social = button('', 'button', 'social-signin social-' + provider);
      if (provider === 'google') {
        // Google's official multicolor Super G asset; preserve the logo unchanged.
        social.append(node('img', {
          className: 'social-google-icon',
          src: 'https://developers.google.com/static/identity/images/g-logo.png',
          width: '20', height: '20', alt: '', 'aria-hidden': 'true',
        }));
      } else {
        social.append(node('span', {className: 'social-glyph', 'aria-hidden': 'true'},
          {facebook: 'f', azure: 'M', apple: '●'}[provider]));
      }
      social.append(node('span', {className: 'social-label'}, label));
      social.onclick = async () => {
        social.disabled = true;
        try {
          const {error} = await supabase.auth.signInWithOAuth({
            provider,
            options: {redirectTo, ...(provider === 'azure' ? {scopes: 'email'} : {})},
          });
          if (error) throw error;
        } catch {
          social.disabled = false;
          showToast(retryMessage);
        }
      };
      options.append(social);
    }
    content.append(options);
    const divider = node('div', {className: 'auth-divider', role: 'separator'});
    divider.append(node('span', {}, 'or continue with email'));
    content.append(divider);
  }

  const form = node('form', {className: 'form-stack auth-form'});
  const email = field(form, 'Email address', {type: 'email', autocomplete: 'email', placeholder: 'name@example.com'});
  const password = recovery ? null : field(form, 'Password', {
    type: 'password', autocomplete: login ? 'current-password' : 'new-password',
    minlength: login ? '1' : '12', maxlength: '72',
  });

  if (login) {
    const forgot = node('div', {className: 'auth-forgot'});
    const reset = button('Forgot password?', 'button', 'auth-text-button');
    reset.onclick = () => openLogin(onSuccess, 'reset');
    forgot.append(reset);
    form.append(forgot);
  } else if (!recovery) {
    form.append(node('p', {className: 'auth-hint'}, 'Use at least 12 characters for your password.'));
  }

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
  content.append(form);

  const footer = node('div', {className: 'auth-footer'});
  const changeMode = button(
    recovery ? 'Back to sign in' : login ? 'Create an account' : 'Sign in',
    'button', 'auth-text-button',
  );
  changeMode.onclick = () => openLogin(onSuccess, login ? 'signup' : 'login');
  if (!recovery) {
    footer.append(node('span', {}, login ? 'New to Trippy?' : 'Already have an account?'));
  }
  footer.append(changeMode);
  content.append(footer);

  if (login && import.meta.env.VITE_PHONE_AUTH === 'true') {
    const mobile = button('Use mobile number', 'button', 'auth-phone-link auth-text-button');
    mobile.onclick = () => openPhoneVerification(false, onSuccess);
    content.append(mobile);
  }
}

function openPhoneVerification(link, onSuccess) {
  showModal(link ? 'Verify mobile number' : 'Use mobile number', 'Trippy Corporate', {variant: 'auth'});
  const form = node('form', {className: 'form-stack auth-form'});
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
  showModal('Set new password', 'Trippy Corporate', {variant: 'auth'});
  const form = node('form', {className: 'form-stack auth-form'});
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

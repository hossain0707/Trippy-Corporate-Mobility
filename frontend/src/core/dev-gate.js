import {$, supabase} from './context.js';

const gate = $('devGate');
const form = $('devGateForm');
const status = $('devGateStatus');
const signup = $('devSignup');

export function showDevAccount(user) {
  $('app').hidden = !user;
  $('app').style.display = user ? '' : 'none';
  gate.hidden = Boolean(user);
  if (user) form.reset();
}

async function authenticate(create) {
  if (!supabase) {
    status.textContent = 'Sign-in is unavailable.';
    return;
  }
  const email = form.elements.email.value.trim();
  const password = form.elements.password.value;
  form.querySelectorAll('button').forEach(button => { button.disabled = true; });
  status.textContent = '';
  try {
    const credentials = {email, password};
    const {data, error} = create
      ? await supabase.auth.signUp({...credentials, options: {emailRedirectTo: location.origin + '/'}})
      : await supabase.auth.signInWithPassword(credentials);
    if (error) throw error;
    status.textContent = data.session ? 'Verifying account…' : 'Check your email to confirm your account.';
  } catch {
    status.textContent = create ? 'Unable to create an account. Check your details.' : 'Unable to sign in. Check your details.';
  } finally {
    form.querySelectorAll('button').forEach(button => { button.disabled = false; });
  }
}

form.addEventListener('submit', event => {
  event.preventDefault();
  void authenticate(false);
});
signup.addEventListener('click', () => {
  if (form.reportValidity()) void authenticate(true);
});
showDevAccount(null);

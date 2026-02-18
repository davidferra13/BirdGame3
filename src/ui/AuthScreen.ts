/**
 * AuthScreen
 * Full-screen login/signup/guest selection screen.
 * Shown on first load when no Supabase session exists.
 */

import { signIn, signUp, signInWithGoogle } from '../services/AuthService';
import { authStateManager, AuthState } from '../services/AuthStateManager';
import { migrateGuestDataToAccount } from '../services/GuestMigrationService';
import { setRememberMe } from '../services/RememberMeService';

type AuthMode = 'signin' | 'signup';

export class AuthScreen {
  private container: HTMLElement;
  private visible = false;
  private onComplete: ((state: AuthState) => void) | null = null;
  private unsubAuth: (() => void) | null = null;
  private completionHandled = false;

  private mode: AuthMode = 'signin';
  private formContainer: HTMLElement;
  private errorMessage: HTMLElement;
  private submitBtn: HTMLButtonElement;
  private toggleLink: HTMLElement;

  // Sign In fields
  private signInIdentifier!: HTMLInputElement;
  private signInPassword!: HTMLInputElement;
  private rememberMeCheckbox!: HTMLInputElement;

  // Sign Up fields
  private signUpEmail!: HTMLInputElement;
  private signUpPassword!: HTMLInputElement;
  private signUpUsername!: HTMLInputElement;

  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'auth-screen';
    this.container.setAttribute('role', 'dialog');
    this.container.setAttribute('aria-label', 'Sign in or create account');
    this.container.style.cssText =
      'position:fixed;top:0;left:0;width:100%;height:100%;' +
      'display:none;align-items:center;justify-content:center;' +
      'background:linear-gradient(180deg,#1a2a3a 0%,#2a4a6a 50%,#87ceeb 100%);' +
      'font-family:"Segoe UI",system-ui,sans-serif;color:#fff;z-index:3000;' +
      'pointer-events:auto;';

    // Card
    const card = document.createElement('div');
    card.style.cssText =
      'background:rgba(40,50,60,0.95);border-radius:12px;padding:40px;' +
      'max-width:400px;width:90%;border:1px solid rgba(255,255,255,0.15);' +
      'box-shadow:0 8px 32px rgba(0,0,0,0.5);';

    // Title
    const title = document.createElement('h1');
    title.style.cssText =
      'font-size:36px;font-weight:bold;text-align:center;margin:0 0 8px 0;' +
      'text-shadow:2px 2px 4px rgba(0,0,0,0.5);letter-spacing:3px;';
    title.textContent = 'BIRD GAME 3';
    card.appendChild(title);

    // Subtitle
    const subtitle = document.createElement('div');
    subtitle.style.cssText =
      'font-size:14px;color:rgba(255,255,255,0.6);text-align:center;margin-bottom:30px;';
    subtitle.textContent = 'Sign in to save your progress';
    card.appendChild(subtitle);

    // Form container (swaps between sign in and sign up)
    this.formContainer = document.createElement('div');
    card.appendChild(this.formContainer);

    // Error message
    this.errorMessage = document.createElement('div');
    this.errorMessage.style.cssText =
      'color:#ff6b6b;font-size:13px;text-align:center;margin-bottom:12px;' +
      'min-height:18px;display:none;';
    card.appendChild(this.errorMessage);

    // Submit button
    this.submitBtn = document.createElement('button');
    this.submitBtn.style.cssText =
      'display:block;width:100%;padding:14px;margin-bottom:16px;' +
      'background:rgba(135,206,235,0.3);border:1px solid rgba(135,206,235,0.5);' +
      'color:#fff;font-size:16px;font-weight:bold;letter-spacing:2px;' +
      'cursor:pointer;border-radius:6px;transition:background 0.2s,transform 0.1s;';
    this.submitBtn.addEventListener('mouseenter', () => {
      if (!this.submitBtn.disabled) {
        this.submitBtn.style.background = 'rgba(135,206,235,0.5)';
        this.submitBtn.style.transform = 'scale(1.02)';
      }
    });
    this.submitBtn.addEventListener('mouseleave', () => {
      this.submitBtn.style.background = 'rgba(135,206,235,0.3)';
      this.submitBtn.style.transform = 'scale(1)';
    });
    this.submitBtn.addEventListener('click', () => this.handleSubmit());
    card.appendChild(this.submitBtn);

    // Toggle link (switch between sign in / sign up)
    this.toggleLink = document.createElement('div');
    this.toggleLink.style.cssText =
      'text-align:center;font-size:13px;color:rgba(135,206,235,0.8);' +
      'cursor:pointer;margin-bottom:24px;transition:color 0.2s;';
    this.toggleLink.addEventListener('mouseenter', () =>
      this.toggleLink.style.color = 'rgba(135,206,235,1)');
    this.toggleLink.addEventListener('mouseleave', () =>
      this.toggleLink.style.color = 'rgba(135,206,235,0.8)');
    this.toggleLink.addEventListener('click', () => this.toggleMode());
    card.appendChild(this.toggleLink);

    // Google divider
    const googleDivider = document.createElement('div');
    googleDivider.style.cssText =
      'border-top:1px solid rgba(255,255,255,0.1);margin:0 0 16px 0;' +
      'position:relative;text-align:center;';
    const googleDividerText = document.createElement('span');
    googleDividerText.style.cssText =
      'position:relative;top:-10px;background:rgba(40,50,60,0.95);' +
      'padding:0 12px;font-size:12px;color:rgba(255,255,255,0.4);';
    googleDividerText.textContent = 'OR';
    googleDivider.appendChild(googleDividerText);
    card.appendChild(googleDivider);

    // Sign in with Google button
    const googleBtn = document.createElement('button');
    googleBtn.style.cssText =
      'display:flex;align-items:center;justify-content:center;gap:10px;' +
      'width:100%;padding:12px;margin-bottom:20px;' +
      'background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.2);' +
      'color:#fff;font-size:14px;font-weight:bold;letter-spacing:1px;' +
      'cursor:pointer;border-radius:6px;transition:background 0.2s,transform 0.1s;';

    // Google "G" icon (inline SVG)
    const googleIcon = document.createElement('span');
    googleIcon.innerHTML =
      '<svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.09 24.09 0 0 0 0 21.56l7.98-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>';
    googleBtn.appendChild(googleIcon);

    const googleLabel = document.createElement('span');
    googleLabel.textContent = 'SIGN IN WITH GOOGLE';
    googleBtn.appendChild(googleLabel);

    googleBtn.addEventListener('mouseenter', () => {
      googleBtn.style.background = 'rgba(255,255,255,0.15)';
      googleBtn.style.transform = 'scale(1.02)';
    });
    googleBtn.addEventListener('mouseleave', () => {
      googleBtn.style.background = 'rgba(255,255,255,0.08)';
      googleBtn.style.transform = 'scale(1)';
    });
    googleBtn.addEventListener('click', () => this.handleGoogleSignIn());
    card.appendChild(googleBtn);

    // Separator
    const separator = document.createElement('div');
    separator.style.cssText =
      'border-top:1px solid rgba(255,255,255,0.15);margin:0 0 20px 0;' +
      'position:relative;text-align:center;';
    const separatorText = document.createElement('span');
    separatorText.style.cssText =
      'position:relative;top:-10px;background:rgba(40,50,60,0.95);' +
      'padding:0 12px;font-size:12px;color:rgba(255,255,255,0.4);';
    separatorText.textContent = 'OR';
    separator.appendChild(separatorText);
    card.appendChild(separator);

    // Continue as Guest button
    const guestBtn = document.createElement('button');
    guestBtn.style.cssText =
      'display:block;width:100%;padding:12px;' +
      'background:transparent;border:1px solid rgba(255,255,255,0.2);' +
      'color:rgba(255,255,255,0.7);font-size:14px;font-weight:bold;letter-spacing:2px;' +
      'cursor:pointer;border-radius:6px;transition:background 0.2s,color 0.2s;';
    guestBtn.textContent = 'CONTINUE AS GUEST';
    guestBtn.addEventListener('mouseenter', () => {
      guestBtn.style.background = 'rgba(255,255,255,0.08)';
      guestBtn.style.color = 'rgba(255,255,255,0.9)';
    });
    guestBtn.addEventListener('mouseleave', () => {
      guestBtn.style.background = 'transparent';
      guestBtn.style.color = 'rgba(255,255,255,0.7)';
    });
    guestBtn.addEventListener('click', () => this.handleGuest());
    card.appendChild(guestBtn);

    // Guest note
    const guestNote = document.createElement('div');
    guestNote.style.cssText =
      'text-align:center;font-size:11px;color:rgba(255,255,255,0.35);margin-top:12px;';
    guestNote.textContent = 'Guest progress is saved locally and may be lost if you clear browser data.';
    card.appendChild(guestNote);

    this.container.appendChild(card);
    document.body.appendChild(this.container);

    // Build initial form
    this.buildForm();
  }

  setOnComplete(callback: (state: AuthState) => void): void {
    this.onComplete = callback;
  }

  show(): void {
    this.visible = true;
    this.completionHandled = false;
    this.container.style.display = 'flex';
    this.clearError();
    this.setLoading(false);

    // If already authenticated (e.g. OAuth completed before show() was called),
    // skip straight to completion
    const currentState = authStateManager.getState();
    if (currentState.isAuthenticated) {
      this.completeAuth(currentState);
      return;
    }

    // Listen for external auth changes (e.g. OAuth redirect completing).
    // For explicit sign-in/sign-up, handleSignIn/handleSignUp call completeAuth
    // directly and unsubscribe first to prevent double-fire.
    this.unsubAuth?.();
    this.unsubAuth = authStateManager.subscribe((state) => {
      if (state.isAuthenticated && this.visible && !this.completionHandled) {
        // Fire-and-forget guest data migration (non-blocking)
        if (state.profile) {
          migrateGuestDataToAccount(state.profile).catch(e =>
            console.warn('Guest data migration failed (non-critical):', e)
          );
        }
        this.completeAuth(state);
      }
    });

    // Focus the first input
    requestAnimationFrame(() => {
      if (this.mode === 'signin') {
        this.signInIdentifier?.focus();
      } else {
        this.signUpEmail?.focus();
      }
    });
  }

  hide(): void {
    this.visible = false;
    this.container.style.display = 'none';
    this.unsubAuth?.();
    this.unsubAuth = null;
  }

  /** Ensure auth completion fires exactly once (guards against race between
   *  the onAuthStateChange subscriber and explicit handleSignIn/handleSignUp). */
  private completeAuth(state: AuthState): void {
    if (this.completionHandled) return;
    this.completionHandled = true;
    this.hide();
    this.onComplete?.(state);
  }

  get isVisible(): boolean {
    return this.visible;
  }

  private buildForm(): void {
    this.formContainer.innerHTML = '';

    if (this.mode === 'signin') {
      this.signInIdentifier = this.createInput(this.formContainer, 'email', 'Email');
      this.signInPassword = this.createInput(this.formContainer, 'password', 'Password');
      this.signInPassword.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.handleSubmit();
      });

      // "Stay signed in" checkbox
      const rememberRow = document.createElement('label');
      rememberRow.style.cssText =
        'display:flex;align-items:center;gap:8px;margin-bottom:14px;' +
        'cursor:pointer;font-size:13px;color:rgba(255,255,255,0.7);user-select:none;';
      this.rememberMeCheckbox = document.createElement('input');
      this.rememberMeCheckbox.type = 'checkbox';
      this.rememberMeCheckbox.checked = true;
      this.rememberMeCheckbox.style.cssText =
        'width:16px;height:16px;accent-color:#87ceeb;cursor:pointer;margin:0;';
      const rememberLabel = document.createElement('span');
      rememberLabel.textContent = 'Stay signed in';
      rememberRow.appendChild(this.rememberMeCheckbox);
      rememberRow.appendChild(rememberLabel);
      this.formContainer.appendChild(rememberRow);

      this.submitBtn.textContent = 'SIGN IN';
      this.toggleLink.textContent = "Don't have an account? Sign Up";
    } else {
      this.signUpUsername = this.createInput(this.formContainer, 'text', 'Username (3-20 characters)');
      this.signUpUsername.maxLength = 20;
      this.signUpEmail = this.createInput(this.formContainer, 'email', 'Email');
      this.signUpPassword = this.createInput(this.formContainer, 'password', 'Password (min 6 characters)');
      this.signUpPassword.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.handleSubmit();
      });
      this.submitBtn.textContent = 'SIGN UP';
      this.toggleLink.textContent = 'Already have an account? Sign In';
    }
  }

  private createInput(parent: HTMLElement, type: string, placeholder: string): HTMLInputElement {
    const input = document.createElement('input');
    input.type = type;
    input.placeholder = placeholder;
    input.autocomplete = type === 'email' ? 'email' : type === 'password' ? 'current-password' : 'username';
    input.style.cssText =
      'width:100%;padding:12px;margin-bottom:12px;' +
      'background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.2);' +
      'border-radius:6px;color:#fff;font-size:14px;' +
      'font-family:"Segoe UI",system-ui,sans-serif;outline:none;' +
      'box-sizing:border-box;transition:border-color 0.2s;';
    input.addEventListener('focus', () =>
      input.style.borderColor = 'rgba(135,206,235,0.6)');
    input.addEventListener('blur', () =>
      input.style.borderColor = 'rgba(255,255,255,0.2)');
    parent.appendChild(input);
    return input;
  }

  private toggleMode(): void {
    this.mode = this.mode === 'signin' ? 'signup' : 'signin';
    this.clearError();
    this.buildForm();
  }

  private async handleSubmit(): Promise<void> {
    if (this.submitBtn.disabled) return;

    if (this.mode === 'signin') {
      await this.handleSignIn();
    } else {
      await this.handleSignUp();
    }
  }

  private async handleSignIn(): Promise<void> {
    const identifier = this.signInIdentifier.value.trim();
    const password = this.signInPassword.value;

    if (!identifier || !password) {
      this.showError('Please enter your email and password.');
      return;
    }

    this.setLoading(true);
    this.clearError();
    try {
      console.log('[AUTH] Starting sign-in with identifier:', identifier);
      const result = await signIn({ identifier, password });
      console.log('[AUTH] Sign-in result:', result.success);

      if (!result.success) {
        this.showError(result.error || 'Sign in failed. Please try again.');
        return;
      }

      if (!result.profile) {
        this.showError('Sign in succeeded but profile is missing. Please try again.');
        return;
      }

      console.log('[AUTH] Got profile, persisting preference');
      // Persist the "stay signed in" preference
      setRememberMe(this.rememberMeCheckbox.checked);

      // Fire-and-forget guest data migration (non-blocking)
      migrateGuestDataToAccount(result.profile).catch(e =>
        console.warn('Guest data migration failed (non-critical):', e)
      );

      console.log('[AUTH] Unsubscribing from auth listener');
      // Unsubscribe BEFORE setState to prevent the subscriber from also
      // calling completeAuth (the subscriber is for OAuth/external changes only)
      this.unsubAuth?.();
      this.unsubAuth = null;

      console.log('[AUTH] Calling authStateManager.onSignIn');
      await authStateManager.onSignIn(result.profile);
      console.log('[AUTH] Calling completeAuth');
      this.completeAuth(authStateManager.getState());
      console.log('[AUTH] Sign-in complete!');
    } catch (e) {
      console.error('Unexpected sign-in error:', e);
      this.showError('Unexpected sign in error. Please try again.');
    } finally {
      if (this.visible) {
        this.setLoading(false);
      }
    }
  }

  private async handleSignUp(): Promise<void> {
    const username = this.signUpUsername.value.trim();
    const email = this.signUpEmail.value.trim();
    const password = this.signUpPassword.value;

    if (!email || !password) {
      this.showError('Please enter your email and password.');
      return;
    }

    if (username && (username.length < 3 || username.length > 20)) {
      this.showError('Username must be 3-20 characters.');
      return;
    }

    if (password.length < 6) {
      this.showError('Password must be at least 6 characters.');
      return;
    }

    this.setLoading(true);
    this.clearError();

    const result = await signUp({
      email,
      password,
      username: username || undefined,
    });

    if (!result.success) {
      this.showError(result.error || 'Sign up failed. Please try again.');
      this.setLoading(false);
      return;
    }

    if (result.requiresEmailConfirmation) {
      this.showError('Account created. Check your email to confirm, then sign in.');
      this.mode = 'signin';
      this.buildForm();
      this.signInIdentifier.value = email;
      this.setLoading(false);
      return;
    }

    if (!result.profile) {
      this.showError('Account created. Please sign in to continue.');
      this.mode = 'signin';
      this.buildForm();
      this.signInIdentifier.value = email;
      this.setLoading(false);
      return;
    }

    // New accounts default to staying signed in
    setRememberMe(true);

    // Fire-and-forget guest data migration (non-blocking)
    migrateGuestDataToAccount(result.profile).catch(e =>
      console.warn('Guest data migration failed (non-critical):', e)
    );

    // Unsubscribe BEFORE setState to prevent double-fire
    this.unsubAuth?.();
    this.unsubAuth = null;

    await authStateManager.onSignIn(result.profile);
    this.completeAuth(authStateManager.getState());
  }

  private async handleGoogleSignIn(): Promise<void> {
    this.clearError();
    // Google OAuth defaults to staying signed in
    setRememberMe(true);
    const result = await signInWithGoogle();
    if (!result.success) {
      this.showError(result.error || 'Google sign-in failed. Please try again.');
    }
    // If successful, the page redirects to Google — no further action needed here
  }

  private handleGuest(): void {
    this.hide();
    this.onComplete?.(authStateManager.getState());
  }

  private showError(message: string): void {
    this.errorMessage.textContent = message;
    this.errorMessage.style.display = 'block';
  }

  private clearError(): void {
    this.errorMessage.textContent = '';
    this.errorMessage.style.display = 'none';
  }

  private setLoading(loading: boolean): void {
    this.submitBtn.disabled = loading;
    if (loading) {
      this.submitBtn.style.opacity = '0.6';
      this.submitBtn.style.cursor = 'not-allowed';
      this.submitBtn.textContent = this.mode === 'signin' ? 'SIGNING IN...' : 'SIGNING UP...';
    } else {
      this.submitBtn.style.opacity = '1';
      this.submitBtn.style.cursor = 'pointer';
      this.submitBtn.textContent = this.mode === 'signin' ? 'SIGN IN' : 'SIGN UP';
    }
  }
}

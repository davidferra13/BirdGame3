const STORAGE_KEYS = {
  REFERRAL_CODE: 'birdgame_referral_code',
  REFERRED_BY: 'birdgame_referred_by',
  REFERRAL_CLICKS: 'birdgame_referral_clicks',
};

export class ReferralService {
  private code: string;
  private referredBy: string | null;
  private referralCount: number;

  constructor() {
    this.code = this.getOrCreateCode();
    this.referredBy = this.checkIncomingReferral();
    this.referralCount = this.loadReferralCount();
  }

  private getOrCreateCode(): string {
    let code = localStorage.getItem(STORAGE_KEYS.REFERRAL_CODE);
    if (!code) {
      code = Math.random().toString(36).substring(2, 8).toUpperCase();
      localStorage.setItem(STORAGE_KEYS.REFERRAL_CODE, code);
    }
    return code;
  }

  private checkIncomingReferral(): string | null {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref && ref !== this.code) {
      localStorage.setItem(STORAGE_KEYS.REFERRED_BY, ref);
      // Clean URL without reload
      const url = new URL(window.location.href);
      url.searchParams.delete('ref');
      window.history.replaceState({}, '', url.toString());
      return ref;
    }
    return localStorage.getItem(STORAGE_KEYS.REFERRED_BY);
  }

  private loadReferralCount(): number {
    const count = localStorage.getItem(STORAGE_KEYS.REFERRAL_CLICKS);
    return count ? parseInt(count, 10) : 0;
  }

  incrementReferralCount(): void {
    this.referralCount++;
    localStorage.setItem(STORAGE_KEYS.REFERRAL_CLICKS, this.referralCount.toString());
  }

  getShareUrl(): string {
    const base = window.location.origin + window.location.pathname;
    return `${base}?ref=${this.code}`;
  }

  getReferralCode(): string {
    return this.code;
  }

  getReferralCount(): number {
    return this.referralCount;
  }

  getReferredBy(): string | null {
    return this.referredBy;
  }
}

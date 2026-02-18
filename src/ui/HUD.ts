import { ScoreSystem } from '../systems/ScoreSystem';
import { PlayerStateMachine } from '../systems/PlayerStateMachine';
import { Bird } from '../entities/Bird';
import { PoopManager } from '../entities/PoopManager';
import { BankingSystem } from '../systems/BankingSystem';
import { ProgressionSystem } from '../systems/ProgressionSystem';
import { AbilityManager } from '../systems/abilities/AbilityManager';
import { City } from '../world/City';

export class HUD {
  private container: HTMLElement;

  private multiplierEl: HTMLElement;
  private stateEl: HTMLElement;

  private coinsEl: HTMLElement;
  private bankedEl: HTMLElement;
  private wormsEl: HTMLElement;
  private feathersEl: HTMLElement;
  private goldenEggsEl: HTMLElement;
  private xpEl: HTMLElement;
  private xpBarFill: HTMLElement;
  private levelEl: HTMLElement;

  private bankMsgEl: HTMLElement;
  private bankMsgTimer = 0;
  private bankChannelEl: HTMLElement;
  private bankChannelFill: SVGCircleElement;

  private altSpeedEl: HTMLElement;
  private cooldownFill: HTMLElement;

  private controlsEl: HTMLElement;
  private districtEl: HTMLElement;
  private groundedOverlay: HTMLElement;
  private respawnCountdown: HTMLElement;

  // Challenge notification
  private challengeNotif: HTMLElement;
  private challengeTimer = 0;

  // Combo announcer
  private comboAnnouncer: HTMLElement;
  private streakCounter: HTMLElement;

  // Mission UI
  private missionObjective: HTMLElement;
  private missionCompleted: HTMLElement;

  // Hotspot indicator
  private hotspotIndicator: HTMLElement;

  // Boost indicator
  private boostIndicator: HTMLElement;

  // Braking indicator
  private brakeIndicator: HTMLElement;

  // Dive bomb indicator
  private diveBombIndicator: HTMLElement;

  // Ability charge meter
  private abilityLabel: HTMLElement;
  private abilityChargeFill: HTMLElement;
  private abilityActiveBar: HTMLElement;
  private abilityReadyIndicator: HTMLElement;
  private abilityActiveOverlay: HTMLElement;
  private abilityContainer: HTMLElement;

  // Altitude warning
  private altitudeWarning: HTMLElement;

  // Pet protection easter egg
  private petWarningEl: HTMLElement;
  private petWarningBg: HTMLElement;

  // Murmuration tag display
  private murmTagEl: HTMLElement;

  // Driving HUD
  private drivingPrompt: HTMLElement;
  private speedometerEl: HTMLElement;

  // Change detection cache — skip DOM writes when values haven't changed
  private _prevState = '';
  private _prevStateColor = '';
  private _prevMultiplier = '';
  private _prevCoins = '';
  private _prevBanked = '';
  private _prevLevel = '';
  private _prevXp = '';
  private _prevXpWidth = '';
  private _prevAltSpeed = '';
  private _prevCooldownHeight = '';
  private _prevWorms = '';
  private _prevFeathers = '';
  private _prevGoldenEggs = '';
  private _prevDistrict = '';
  private _prevHotspot = false;
  private _prevBankChannel = '';

  constructor() {
    this.container = document.getElementById('hud')!;
    this.container.innerHTML = '';

    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    // Responsive text stroke helper — white text with thin black outline
    const stroke = '-1px -1px 0 rgba(0,0,0,0.7),1px -1px 0 rgba(0,0,0,0.7),-1px 1px 0 rgba(0,0,0,0.7),1px 1px 0 rgba(0,0,0,0.7)';
    // Responsive scale factor based on viewport width
    const vw = window.innerWidth;
    const scale = Math.max(0.7, Math.min(1, vw / 500));

    // === TOP LEFT: Multiplier, State, Level ===
    const topLeft = this.div(`position:absolute;top:${Math.round(10 * scale)}px;left:${Math.round(10 * scale)}px;`);

    this.stateEl = this.div(
      `font-size:${Math.round(13 * scale)}px;font-weight:bold;letter-spacing:2px;color:#fff;text-shadow:${stroke};margin-bottom:4px;height:${Math.round(16 * scale)}px;`,
    );
    topLeft.appendChild(this.stateEl);

    this.multiplierEl = this.div(
      `font-size:${Math.round(18 * scale)}px;font-weight:bold;color:#fff;text-shadow:${stroke};margin-top:4px;height:${Math.round(22 * scale)}px;`,
    );
    topLeft.appendChild(this.multiplierEl);

    this.altSpeedEl = this.div(`font-size:${Math.round(9 * scale)}px;color:rgba(255,255,255,0.7);text-shadow:${stroke};margin-top:3px;`);
    topLeft.appendChild(this.altSpeedEl);

    this.container.appendChild(topLeft);

    // === TOP RIGHT: Coins, Banked, Level, XP — positioned to avoid minimap ===
    const topRight = this.div(`position:absolute;top:${Math.round(10 * scale)}px;right:${isTouchDevice ? '90' : '16'}px;text-align:right;`);

    this.coinsEl = this.div(`font-size:${Math.round(24 * scale)}px;font-weight:bold;color:#fff;text-shadow:${stroke};`);
    topRight.appendChild(this.coinsEl);

    this.bankedEl = this.div(`font-size:${Math.round(12 * scale)}px;color:#44ffaa;text-shadow:${stroke};margin-top:2px;`);
    topRight.appendChild(this.bankedEl);

    // Secondary currencies row
    const currencyRow = this.div(`display:flex;gap:${Math.round(8 * scale)}px;justify-content:flex-end;margin-top:3px;`);
    this.wormsEl = this.div(`font-size:${Math.round(10 * scale)}px;color:#dd8844;text-shadow:${stroke};`);
    this.feathersEl = this.div(`font-size:${Math.round(10 * scale)}px;color:#44ffaa;text-shadow:${stroke};`);
    this.goldenEggsEl = this.div(`font-size:${Math.round(10 * scale)}px;color:#ffdd44;text-shadow:${stroke};`);
    currencyRow.appendChild(this.wormsEl);
    currencyRow.appendChild(this.feathersEl);
    currencyRow.appendChild(this.goldenEggsEl);
    topRight.appendChild(currencyRow);

    this.levelEl = this.div(`font-size:${Math.round(11 * scale)}px;color:#aaccff;text-shadow:${stroke};margin-top:3px;font-weight:bold;`);
    topRight.appendChild(this.levelEl);

    this.xpEl = this.div(`font-size:${Math.round(9 * scale)}px;color:#aaccff;text-shadow:${stroke};margin-top:2px;`);
    topRight.appendChild(this.xpEl);

    const xpBarOuter = this.div(`width:${Math.round(100 * scale)}px;height:${Math.round(5 * scale)}px;background:rgba(0,0,0,0.4);border-radius:3px;overflow:hidden;margin-top:2px;margin-left:auto;`);
    this.xpBarFill = this.div('height:100%;width:0%;background:linear-gradient(90deg,#6688ff,#aaccff);border-radius:3px;transition:width 0.2s;');
    xpBarOuter.appendChild(this.xpBarFill);
    topRight.appendChild(xpBarOuter);

    this.container.appendChild(topRight);

    // === CENTER: Bank message, Bank channel ===
    this.bankMsgEl = this.div(
      'position:absolute;top:40%;left:50%;transform:translate(-50%,-50%);font-size:36px;font-weight:bold;color:#44ffaa;text-shadow:0 0 15px #44ffaa,2px 2px 4px rgba(0,0,0,0.8);display:none;letter-spacing:4px;',
    );
    this.container.appendChild(this.bankMsgEl);

    // Banking channel circle
    this.bankChannelEl = this.div('position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);display:none;text-align:center;');
    const svgSize = 80;
    const r = 34;
    const circ = 2 * Math.PI * r;
    this.bankChannelEl.innerHTML = `
      <svg width="${svgSize}" height="${svgSize}" viewBox="0 0 ${svgSize} ${svgSize}" style="transform:rotate(-90deg)">
        <circle cx="${svgSize / 2}" cy="${svgSize / 2}" r="${r}" fill="rgba(0,0,0,0.5)" stroke="rgba(255,255,255,0.2)" stroke-width="4"/>
        <circle id="bank-ring" cx="${svgSize / 2}" cy="${svgSize / 2}" r="${r}" fill="none" stroke="#44ffaa" stroke-width="4" stroke-dasharray="${circ}" stroke-dashoffset="${circ}" stroke-linecap="round"/>
      </svg>`;
    const bankLabel = this.div('position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:11px;font-weight:bold;color:#44ffaa;text-shadow:1px 1px 3px rgba(0,0,0,0.8);');
    bankLabel.textContent = 'BANKING';
    this.bankChannelEl.appendChild(bankLabel);
    this.container.appendChild(this.bankChannelEl);
    this.bankChannelFill = this.bankChannelEl.querySelector('#bank-ring')!;

    // Grounded overlay
    this.groundedOverlay = this.div(
      'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;display:none;' +
      'background:radial-gradient(ellipse at center,transparent 40%,rgba(0,0,0,0.6) 100%);',
    );
    this.container.appendChild(this.groundedOverlay);

    this.respawnCountdown = this.div(
      'position:absolute;top:55%;left:50%;transform:translate(-50%,-50%);' +
      'font-size:48px;font-weight:bold;color:#ff4444;text-shadow:0 0 20px #ff0000;display:none;',
    );
    this.container.appendChild(this.respawnCountdown);

    // Hotspot indicator
    this.hotspotIndicator = this.div(
      `position:absolute;top:${Math.round(80 * scale)}px;left:50%;transform:translateX(-50%);` +
      `font-size:${Math.round(12 * scale)}px;font-weight:bold;color:#ff8800;letter-spacing:2px;` +
      `text-shadow:${stroke},0 0 8px #ff6600;display:none;`,
    );
    this.hotspotIndicator.textContent = 'HOTSPOT ZONE';
    this.container.appendChild(this.hotspotIndicator);

    // Boost indicator
    this.boostIndicator = this.div(
      `position:absolute;top:35%;left:50%;transform:translateX(-50%);` +
      `font-size:${Math.round(14 * scale)}px;font-weight:bold;color:#44ddff;letter-spacing:2px;` +
      `text-shadow:${stroke},0 0 6px #44ddff;display:none;`,
    );
    this.boostIndicator.textContent = 'BOOST!';
    this.container.appendChild(this.boostIndicator);

    // Braking indicator
    this.brakeIndicator = this.div(
      `position:absolute;top:35%;left:50%;transform:translateX(-50%);` +
      `font-size:${Math.round(14 * scale)}px;font-weight:bold;color:#ffaa44;letter-spacing:2px;` +
      `text-shadow:${stroke},0 0 6px #ffaa44;display:none;`,
    );
    this.brakeIndicator.textContent = 'BRAKING';
    this.container.appendChild(this.brakeIndicator);

    // Dive bomb indicator
    this.diveBombIndicator = this.div(
      `position:absolute;top:35%;left:50%;transform:translateX(-50%);` +
      `font-size:${Math.round(20 * scale)}px;font-weight:bold;color:#ff4444;letter-spacing:3px;` +
      `text-shadow:${stroke},0 0 12px #ff0000;display:none;`,
    );
    this.diveBombIndicator.textContent = 'DIVE BOMB!';
    this.container.appendChild(this.diveBombIndicator);

    // Challenge notification
    this.challengeNotif = this.div(
      'position:absolute;top:130px;right:16px;font-size:14px;font-weight:bold;' +
      'color:#ffdd44;text-shadow:1px 1px 3px rgba(0,0,0,0.8);display:none;text-align:right;',
    );
    this.container.appendChild(this.challengeNotif);

    // Combo announcer (center screen)
    this.comboAnnouncer = this.div(
      'position:absolute;top:30%;left:50%;transform:translate(-50%,-50%);' +
      'font-size:64px;font-weight:bold;letter-spacing:8px;' +
      'opacity:0;pointer-events:none;transition:none;',
    );
    this.container.appendChild(this.comboAnnouncer);

    // Streak counter (top center)
    this.streakCounter = this.div(
      'position:absolute;top:16px;left:50%;transform:translateX(-50%);' +
      'font-size:20px;font-weight:bold;text-align:center;display:none;',
    );
    this.container.appendChild(this.streakCounter);

    // Mission objective (compact, top left below state)
    this.missionObjective = this.div(
      `position:absolute;top:${Math.round(90 * scale)}px;left:${Math.round(10 * scale)}px;` +
      `font-size:${Math.round(10 * scale)}px;color:#aaccff;text-shadow:${stroke};` +
      `background:rgba(0,0,0,0.35);padding:6px 10px;border-radius:5px;` +
      `border-left:2px solid #6688ff;max-width:${Math.round(220 * scale)}px;display:none;`,
    );
    this.container.appendChild(this.missionObjective);

    // Mission completed notification
    this.missionCompleted = this.div(
      'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);' +
      'font-size:28px;font-weight:bold;color:#ffdd44;text-align:center;' +
      'text-shadow:0 0 20px #ffaa00,2px 2px 4px rgba(0,0,0,0.9);' +
      'opacity:0;pointer-events:none;white-space:pre-line;letter-spacing:2px;',
    );
    this.container.appendChild(this.missionCompleted);

    // === BOTTOM LEFT: Cooldown (compact) ===
    const cdSize = Math.round(40 * scale);
    const bottomLeft = this.div(`position:absolute;bottom:${Math.round(12 * scale)}px;left:${Math.round(10 * scale)}px;text-align:center;`);
    const cdLabel = this.div(`font-size:${Math.round(8 * scale)}px;text-shadow:${stroke};margin-bottom:2px;color:rgba(255,255,255,0.6);`);
    cdLabel.textContent = 'POOP';
    bottomLeft.appendChild(cdLabel);
    const cdOuter = this.div(`width:${cdSize}px;height:${cdSize}px;border-radius:50%;background:rgba(0,0,0,0.4);position:relative;overflow:hidden;`);
    this.cooldownFill = this.div('position:absolute;bottom:0;left:0;width:100%;background:rgba(255,255,255,0.3);transition:height 0.05s;');
    cdOuter.appendChild(this.cooldownFill);
    bottomLeft.appendChild(cdOuter);
    this.container.appendChild(bottomLeft);

    // === BOTTOM LEFT: Ability Charge (above poop cooldown, compact) ===
    this.abilityContainer = this.div(`position:absolute;bottom:${Math.round((20 + cdSize + 16) * scale)}px;left:${Math.round(10 * scale)}px;text-align:center;display:none;`);
    this.abilityLabel = this.div(`font-size:${Math.round(8 * scale)}px;text-shadow:${stroke};margin-bottom:2px;color:rgba(255,255,255,0.6);max-width:${cdSize + 10}px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;`);
    this.abilityLabel.textContent = '[J]';
    this.abilityContainer.appendChild(this.abilityLabel);

    const abilityOuter = this.div(`width:${cdSize}px;height:${cdSize}px;border-radius:50%;background:rgba(0,0,0,0.4);position:relative;overflow:hidden;`);
    this.abilityChargeFill = this.div('position:absolute;bottom:0;left:0;width:100%;background:linear-gradient(0deg,#ff8800,#ffdd44);transition:height 0.1s;');
    abilityOuter.appendChild(this.abilityChargeFill);
    this.abilityActiveBar = this.div('position:absolute;top:0;left:0;width:100%;background:linear-gradient(180deg,#44ddff,#ffffff);transition:height 0.05s;display:none;');
    abilityOuter.appendChild(this.abilityActiveBar);
    this.abilityContainer.appendChild(abilityOuter);

    this.abilityReadyIndicator = this.div(`font-size:${Math.round(9 * scale)}px;font-weight:bold;color:#fff;text-shadow:${stroke},0 0 8px #ffaa00;margin-top:3px;display:none;`);
    this.abilityReadyIndicator.textContent = 'READY!';
    this.abilityContainer.appendChild(this.abilityReadyIndicator);
    this.container.appendChild(this.abilityContainer);

    // Ability active screen overlay (subtle golden vignette)
    this.abilityActiveOverlay = this.div(
      'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;display:none;' +
      'box-shadow:inset 0 0 80px rgba(255,170,0,0.2);',
    );
    this.container.appendChild(this.abilityActiveOverlay);

    // Murmuration tag (top-right, below level)
    this.murmTagEl = this.div(
      'font-size:11px;color:#88aaff;text-shadow:1px 1px 3px rgba(0,0,0,0.7);margin-top:2px;display:none;',
    );
    topRight.appendChild(this.murmTagEl);

    // District indicator (compact, bottom-left, above cooldown — hidden on mobile by default in collapsible HUD)
    this.districtEl = this.div(
      `position:absolute;bottom:${Math.round(140 * scale)}px;left:${Math.round(10 * scale)}px;font-size:${Math.round(12 * scale)}px;font-weight:bold;color:rgba(255,255,255,0.85);text-shadow:${stroke};padding:4px 10px;border-radius:6px;`,
    );
    this.container.appendChild(this.districtEl);

    // Controls hint — HIDDEN on touch devices (zero-noise mobile rule)
    this.controlsEl = this.div(
      `position:absolute;bottom:100px;right:16px;font-size:${Math.round(10 * scale)}px;color:rgba(255,255,255,0.5);text-shadow:${stroke};line-height:1.6;text-align:right;transition:opacity 2s;`,
    );
    if (!isTouchDevice) {
      this.controlsEl.innerHTML =
        'W — Forward / Walk<br>S — Brake / Walk Back<br>A/D — Turn<br>SPACE — Ascend<br>CTRL — Fast Descend<br>SHIFT — Slow Descend<br>CAPS — Bomber Mode<br>CLICK — Poop<br>T — Boost<br>E — Bank';
      this.container.appendChild(this.controlsEl);
      setTimeout(() => { this.controlsEl.style.opacity = '0'; }, 8000);
    }

    // === ALTITUDE WARNING ===
    this.altitudeWarning = this.div(
      'position:absolute;bottom:45%;left:50%;transform:translateX(-50%);' +
      'font-size:18px;font-weight:bold;letter-spacing:3px;' +
      'text-shadow:0 0 10px currentColor;display:none;pointer-events:none;' +
      'padding:8px 24px;border-radius:8px;border:2px solid currentColor;' +
      'background:rgba(0,0,0,0.5);transition:opacity 0.15s;',
    );
    this.container.appendChild(this.altitudeWarning);

    // === PET PROTECTION EASTER EGG ===
    // Background overlay (subtle vignette)
    this.petWarningBg = this.div(
      'position:fixed;top:0;left:0;width:100%;height:100%;' +
      'background:radial-gradient(ellipse at center, transparent 40%, rgba(255,182,193,0.15) 100%);' +
      'pointer-events:none;z-index:8999;display:none;transition:opacity 0.5s;',
    );
    document.body.appendChild(this.petWarningBg);

    // Main warning message
    this.petWarningEl = this.div(
      'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) scale(0.8);' +
      'font-size:28px;font-weight:bold;color:#fff;text-align:center;' +
      'padding:24px 48px;border-radius:20px;z-index:9000;pointer-events:none;display:none;' +
      'background:linear-gradient(135deg, rgba(255,140,160,0.92), rgba(255,100,130,0.92));' +
      'border:3px solid rgba(255,255,255,0.5);' +
      'box-shadow:0 8px 32px rgba(255,100,130,0.4), 0 0 60px rgba(255,180,200,0.2);' +
      'text-shadow:0 2px 8px rgba(0,0,0,0.3);' +
      'transition:opacity 0.4s ease, transform 0.4s cubic-bezier(0.34,1.56,0.64,1);',
    );
    document.body.appendChild(this.petWarningEl);

    // === DRIVING HUD ===
    this.drivingPrompt = this.div(
      'position:absolute;bottom:20%;left:50%;transform:translateX(-50%);' +
      'font-size:18px;font-weight:bold;color:#44ddff;letter-spacing:2px;' +
      'text-shadow:0 0 10px #44ddff,2px 2px 4px rgba(0,0,0,0.8);' +
      'background:rgba(0,0,0,0.5);padding:8px 20px;border-radius:8px;display:none;',
    );
    this.container.appendChild(this.drivingPrompt);

    this.speedometerEl = this.div(
      'position:absolute;bottom:16px;right:16px;text-align:right;display:none;',
    );
    this.container.appendChild(this.speedometerEl);
  }

  update(
    score: ScoreSystem,
    playerState: PlayerStateMachine,
    bird: Bird,
    poopManager: PoopManager,
    banking: BankingSystem,
    progression: ProgressionSystem,
    inHotspot: boolean,
    dt: number,
    city?: City,
    abilityManager?: AbilityManager,
  ): void {
    // State label — show WALKING when bird is on ground (unless in penalty GROUNDED state)
    const label = playerState.stateLabel;
    const isWalking = bird.controller.isGrounded && playerState.state === 'NORMAL';
    const displayLabel = isWalking ? 'WALKING' : label;
    if (this._prevState !== displayLabel) {
      this._prevState = displayLabel;
      this.stateEl.textContent = displayLabel;
    }
    const stateColor = displayLabel === 'DRIVING' ? '#44ddff'
      : displayLabel === 'WALKING' ? '#88cc88'
      : label === 'SHIELDED' ? '#44ddff'
      : (label === 'GROUNDED' || label === 'RESPAWNING') ? '#ff4444'
      : (label === 'SANCTUARY' || label === 'BANKING') ? '#44ffaa'
      : '#ffffff';
    if (this._prevStateColor !== stateColor) {
      this._prevStateColor = stateColor;
      this.stateEl.style.color = stateColor;
    }

    // Multiplier
    const multText = score.multiplier > 1 ? `x${score.multiplier.toFixed(1)}` : '';
    if (this._prevMultiplier !== multText) {
      this._prevMultiplier = multText;
      this.multiplierEl.textContent = multText;
      if (multText) this.multiplierEl.style.color = '#fff';
    }

    // Coins
    const coinsText = `${score.coins}`;
    if (this._prevCoins !== coinsText) {
      this._prevCoins = coinsText;
      this.coinsEl.textContent = coinsText;
    }

    const bankedText = score.bankedCoins > 0 ? `BANKED: ${score.bankedCoins}` : '';
    if (this._prevBanked !== bankedText) {
      this._prevBanked = bankedText;
      if (bankedText) {
        this.bankedEl.textContent = bankedText;
        this.bankedEl.style.display = 'block';
      } else {
        this.bankedEl.style.display = 'none';
      }
    }

    // Secondary currencies
    const totalWorms = score.totalWorms + progression.worms;
    const feathers = progression.feathers;
    const goldenEggs = progression.goldenEggs;
    const wormsText = totalWorms > 0 ? `🪱 ${totalWorms}` : '';
    if (this._prevWorms !== wormsText) { this._prevWorms = wormsText; this.wormsEl.textContent = wormsText; }
    const feathersText = feathers > 0 ? `🪶 ${feathers}` : '';
    if (this._prevFeathers !== feathersText) { this._prevFeathers = feathersText; this.feathersEl.textContent = feathersText; }
    const eggsText = goldenEggs > 0 ? `🥚 ${goldenEggs}` : '';
    if (this._prevGoldenEggs !== eggsText) { this._prevGoldenEggs = eggsText; this.goldenEggsEl.textContent = eggsText; }

    // Level & XP
    const lvlText = `LVL ${progression.level}`;
    if (this._prevLevel !== lvlText) { this._prevLevel = lvlText; this.levelEl.textContent = lvlText; }
    const xpText = `XP ${progression.xp}`;
    if (this._prevXp !== xpText) { this._prevXp = xpText; this.xpEl.textContent = xpText; }
    const xpWidth = `${progression.xpProgress * 100}%`;
    if (this._prevXpWidth !== xpWidth) { this._prevXpWidth = xpWidth; this.xpBarFill.style.width = xpWidth; }

    // Banking channel
    const bankState = playerState.state === 'BANKING' ? 'show' : 'hide';
    if (this._prevBankChannel !== bankState) {
      this._prevBankChannel = bankState;
      this.bankChannelEl.style.display = bankState === 'show' ? 'block' : 'none';
    }
    if (playerState.state === 'BANKING') {
      const circ = 2 * Math.PI * 34;
      this.bankChannelFill.setAttribute('stroke-dashoffset', `${circ * (1 - banking.progress)}`);
    }

    // Grounded overlay with countdown
    if (playerState.state === 'GROUNDED') {
      this.groundedOverlay.style.display = 'block';
      this.respawnCountdown.style.display = 'block';
      const remaining = playerState.groundedTimeRemaining;
      this.respawnCountdown.textContent = `GROUNDED ${remaining.toFixed(1)}s`;
    } else if (playerState.state === 'RESPAWNING') {
      this.groundedOverlay.style.display = 'block';
      this.respawnCountdown.style.display = 'block';
      this.respawnCountdown.textContent = 'RESPAWNING...';
    } else {
      this.groundedOverlay.style.display = 'none';
      this.respawnCountdown.style.display = 'none';
    }

    // Hotspot
    if (this._prevHotspot !== inHotspot) {
      this._prevHotspot = inHotspot;
      this.hotspotIndicator.style.display = inHotspot ? 'block' : 'none';
    }

    // Boost & Brake & Dive Bomb indicators (mutually exclusive position)
    const isBombing = bird.controller.isBomberMode && !bird.controller.isGrounded && !bird.controller.isDiving;
    this.boostIndicator.style.display = bird.controller.isBoosting ? 'block' : 'none';
    this.brakeIndicator.style.display = (!bird.controller.isBoosting && (bird.controller.isBraking || isBombing)) ? 'block' : 'none';
    this.brakeIndicator.textContent = isBombing ? 'BOMBING RUN' : 'BRAKING';
    this.diveBombIndicator.style.display = bird.controller.isDiveBombing ? 'block' : 'none';

    // Alt/speed
    const alt = Math.round(bird.controller.position.y);
    const spd = Math.round(bird.controller.forwardSpeed);
    const altSpeedText = `ALT ${alt}m  SPD ${spd}`;
    if (this._prevAltSpeed !== altSpeedText) {
      this._prevAltSpeed = altSpeedText;
      this.altSpeedEl.textContent = altSpeedText;
    }

    // Cooldown
    const cdHeight = `${poopManager.cooldownProgress * 100}%`;
    if (this._prevCooldownHeight !== cdHeight) {
      this._prevCooldownHeight = cdHeight;
      this.cooldownFill.style.height = cdHeight;
    }

    // Ability charge meter
    if (abilityManager) {
      if (abilityManager.hasAbilityUnlocked) {
        this.abilityContainer.style.display = 'block';
        this.abilityLabel.textContent = `${abilityManager.equippedName} [J]`;

        if (abilityManager.isActive) {
          this.abilityChargeFill.style.display = 'none';
          this.abilityActiveBar.style.display = 'block';
          this.abilityActiveBar.style.height = `${abilityManager.durationProgress * 100}%`;
          this.abilityReadyIndicator.style.display = 'none';
          this.abilityActiveOverlay.style.display = 'block';
        } else {
          this.abilityChargeFill.style.display = 'block';
          this.abilityActiveBar.style.display = 'none';
          this.abilityChargeFill.style.height = `${abilityManager.chargeProgress * 100}%`;
          this.abilityActiveOverlay.style.display = 'none';

          if (abilityManager.isReady) {
            this.abilityReadyIndicator.style.display = 'block';
            this.abilityReadyIndicator.style.opacity =
              `${0.7 + Math.sin(performance.now() * 0.005) * 0.3}`;
          } else {
            this.abilityReadyIndicator.style.display = 'none';
          }
        }
      } else {
        this.abilityContainer.style.display = 'none';
        this.abilityActiveOverlay.style.display = 'none';
      }
    }


    // District indicator
    if (city) {
      const district = city.getDistrict(bird.controller.position);
      const districtName = district ? `📍 ${district.name}` : '📍 Open Sky';
      if (this._prevDistrict !== districtName) {
        this._prevDistrict = districtName;
        this.districtEl.textContent = districtName;
        this.districtEl.style.display = 'block';
      }
    }

    // Bank message timer
    if (this.bankMsgTimer > 0) {
      this.bankMsgTimer -= dt;
      if (this.bankMsgTimer <= 0) this.bankMsgEl.style.display = 'none';
    }

    // Challenge notification timer
    if (this.challengeTimer > 0) {
      this.challengeTimer -= dt;
      if (this.challengeTimer <= 0) this.challengeNotif.style.display = 'none';
    }
  }

  showBankMessage(amount: number, xpGained: number): void {
    this.bankMsgEl.textContent = `BANKED +${amount}  (+${xpGained} XP)`;
    this.bankMsgEl.style.color = '#44ffaa';
    this.bankMsgEl.style.textShadow = '0 0 15px #44ffaa,2px 2px 4px rgba(0,0,0,0.8)';
    this.bankMsgEl.style.display = 'block';
    this.bankMsgTimer = 2.5;
  }

  showGroundedMessage(lost: number): void {
    this.bankMsgEl.textContent = `GROUNDED! -${lost}`;
    this.bankMsgEl.style.color = '#ff4444';
    this.bankMsgEl.style.textShadow = '0 0 15px #ff0000,2px 2px 4px rgba(0,0,0,0.8)';
    this.bankMsgEl.style.display = 'block';
    this.bankMsgTimer = 2.5;
  }

  showLevelUp(level: number): void {
    this.bankMsgEl.textContent = `LEVEL UP! LVL ${level}`;
    this.bankMsgEl.style.color = '#aaccff';
    this.bankMsgEl.style.textShadow = '0 0 15px #6688ff,2px 2px 4px rgba(0,0,0,0.8)';
    this.bankMsgEl.style.display = 'block';
    this.bankMsgTimer = 3.0;
  }

  showChallengeComplete(desc: string): void {
    this.challengeNotif.textContent = `CHALLENGE: ${desc}`;
    this.challengeNotif.style.display = 'block';
    this.challengeTimer = 3.0;
  }

  /** Show pet protection warning — the wholesome easter egg */
  showPetWarning(petType: 'cat' | 'dog', isBlocked: boolean): void {
    const emoji = petType === 'cat' ? '\uD83D\uDC31' : '\uD83D\uDC36';
    const name = petType === 'cat' ? 'kitty' : 'pup';

    if (isBlocked) {
      // Trying to drop from height — stern but cute warning
      const messages = [
        `${emoji} Hey! You better place this ${name} down safely!`,
        `${emoji} Whoa there! Fly lower before letting go!`,
        `${emoji} Not from up here! This ${name} needs a gentle landing!`,
        `${emoji} Nope! Get closer to the ground first!`,
      ];
      this.petWarningEl.textContent = messages[Math.floor(Math.random() * messages.length)];
    } else {
      // Initial pickup message
      const pickupMessages = [
        `${emoji} Oh! You picked up a ${name}! Be gentle!`,
        `${emoji} A wild ${name}! Handle with care!`,
        `${emoji} New friend acquired! Place them down safely!`,
      ];
      this.petWarningEl.textContent = pickupMessages[Math.floor(Math.random() * pickupMessages.length)];
    }

    this.petWarningEl.style.display = 'block';
    this.petWarningBg.style.display = 'block';
    this.petWarningEl.style.opacity = '0';
    this.petWarningBg.style.opacity = '0';
    this.petWarningEl.style.transform = 'translate(-50%,-50%) scale(0.8)';

    // Animate in
    requestAnimationFrame(() => {
      this.petWarningEl.style.opacity = '1';
      this.petWarningBg.style.opacity = '1';
      this.petWarningEl.style.transform = 'translate(-50%,-50%) scale(1)';
    });
  }

  /** Hide the pet warning message */
  hidePetWarning(): void {
    this.petWarningEl.style.opacity = '0';
    this.petWarningBg.style.opacity = '0';
    this.petWarningEl.style.transform = 'translate(-50%,-50%) scale(0.8)';
    setTimeout(() => {
      this.petWarningEl.style.display = 'none';
      this.petWarningBg.style.display = 'none';
    }, 400);
  }

  /** Coin vacuum: animated coin particles flying from unbanked to banked counter */
  playCoinVacuum(): void {
    const coinRect = this.coinsEl.getBoundingClientRect();
    const bankRect = this.bankedEl.getBoundingClientRect();
    const count = 8;
    for (let i = 0; i < count; i++) {
      const dot = document.createElement('div');
      dot.style.cssText =
        'position:fixed;width:8px;height:8px;border-radius:50%;background:#ffdd44;' +
        'box-shadow:0 0 6px #ffdd44;pointer-events:none;z-index:9999;';
      dot.style.left = `${coinRect.left + coinRect.width / 2}px`;
      dot.style.top = `${coinRect.top + coinRect.height / 2}px`;
      document.body.appendChild(dot);

      const delay = i * 40;
      const dx = bankRect.left + bankRect.width / 2 - (coinRect.left + coinRect.width / 2);
      const dy = bankRect.top + bankRect.height / 2 - (coinRect.top + coinRect.height / 2);
      setTimeout(() => {
        dot.style.transition = 'left 0.4s ease-in, top 0.4s ease-in, opacity 0.4s ease-in';
        dot.style.left = `${coinRect.left + coinRect.width / 2 + dx}px`;
        dot.style.top = `${coinRect.top + coinRect.height / 2 + dy}px`;
        dot.style.opacity = '0';
        setTimeout(() => dot.remove(), 450);
      }, delay);
    }
  }

  updateComboAnnouncer(text: string, color: string, opacity: number, scale: number): void {
    this.comboAnnouncer.textContent = text;
    this.comboAnnouncer.style.color = color;
    this.comboAnnouncer.style.textShadow = `0 0 20px ${color},0 0 40px ${color},2px 2px 6px rgba(0,0,0,0.9)`;
    this.comboAnnouncer.style.opacity = opacity.toString();
    this.comboAnnouncer.style.transform = `translate(-50%,-50%) scale(${scale})`;
  }

  updateStreakCounter(streak: number, color: string, glowIntensity: number): void {
    if (streak >= 2) {
      this.streakCounter.textContent = `${streak}x STREAK!`;
      this.streakCounter.style.color = color;
      this.streakCounter.style.textShadow = `0 0 ${glowIntensity}px ${color},1px 1px 3px rgba(0,0,0,0.8)`;
      this.streakCounter.style.display = 'block';
    } else {
      this.streakCounter.style.display = 'none';
    }
  }

  updateMissionObjective(title: string, description: string, current: number, target: number, progress: number): void {
    if (title) {
      const progressBarWidth = Math.round(progress * 100);
      this.missionObjective.innerHTML = `
        <div style="font-weight:bold;margin-bottom:4px;color:#6688ff;">${title}</div>
        <div style="font-size:11px;margin-bottom:6px;color:#ccc;">${description}</div>
        <div style="font-size:10px;color:#aaccff;margin-bottom:2px;">${current} / ${target}</div>
        <div style="width:100%;height:4px;background:rgba(255,255,255,0.1);border-radius:2px;overflow:hidden;">
          <div style="width:${progressBarWidth}%;height:100%;background:linear-gradient(90deg,#6688ff,#aaccff);transition:width 0.3s;"></div>
        </div>
      `;
      this.missionObjective.style.display = 'block';
    } else {
      this.missionObjective.style.display = 'none';
    }
  }

  updateMissionCompleted(text: string, opacity: number): void {
    this.missionCompleted.textContent = text;
    this.missionCompleted.style.opacity = opacity.toString();
  }

  updateAltitudeWarning(level: 'none' | 'caution' | 'danger' | 'critical'): void {
    if (level === 'none') {
      this.altitudeWarning.style.display = 'none';
      return;
    }

    this.altitudeWarning.style.display = 'block';

    switch (level) {
      case 'caution':
        this.altitudeWarning.textContent = 'LOW ALTITUDE';
        this.altitudeWarning.style.color = '#ffcc00';
        this.altitudeWarning.style.borderColor = '#ffcc00';
        this.altitudeWarning.style.opacity = '0.8';
        break;
      case 'danger':
        this.altitudeWarning.textContent = 'DANGER - TOO LOW';
        this.altitudeWarning.style.color = '#ff8800';
        this.altitudeWarning.style.borderColor = '#ff8800';
        this.altitudeWarning.style.opacity = '0.9';
        break;
      case 'critical':
        this.altitudeWarning.textContent = 'PULL UP!';
        this.altitudeWarning.style.color = '#ff2222';
        this.altitudeWarning.style.borderColor = '#ff2222';
        // Flash effect
        this.altitudeWarning.style.opacity = `${0.7 + Math.sin(performance.now() * 0.01) * 0.3}`;
        break;
    }
  }

  showDrivingPrompt(text: string): void {
    this.drivingPrompt.textContent = text;
    this.drivingPrompt.style.display = 'block';
  }

  hideDrivingPrompt(): void {
    this.drivingPrompt.style.display = 'none';
  }

  updateDrivingHUD(speed: number): void {
    this.speedometerEl.style.display = 'block';
    const mph = Math.round(Math.abs(speed) * 2.2);
    this.speedometerEl.innerHTML =
      `<div style="font-size:10px;color:#aaa;letter-spacing:2px;text-shadow:1px 1px 3px rgba(0,0,0,0.8);">DRIVING</div>` +
      `<div style="font-size:28px;font-weight:bold;color:#44ddff;text-shadow:0 0 10px #44ddff,2px 2px 4px rgba(0,0,0,0.8);">${mph} MPH</div>` +
      `<div style="font-size:10px;margin-top:4px;color:#888;text-shadow:1px 1px 2px rgba(0,0,0,0.7);">[Z] Exit Car</div>`;
  }

  hideDrivingHUD(): void {
    this.speedometerEl.style.display = 'none';
  }

  setMurmurationTag(tag: string | null): void {
    if (tag) {
      this.murmTagEl.textContent = `[${tag}]`;
      this.murmTagEl.style.display = 'block';
    } else {
      this.murmTagEl.style.display = 'none';
    }
  }

  private div(style: string): HTMLElement {
    const el = document.createElement('div');
    el.style.cssText = style;
    return el;
  }
}

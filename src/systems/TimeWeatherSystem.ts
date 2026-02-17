import * as THREE from 'three';
import { TIME_SYSTEM, WEATHER } from '../utils/Constants';
import { City } from '../world/City';
// PostProcessing removed for performance
import { Ocean } from '../world/Ocean';

export interface TimeOfDay {
  hour: number; // 0-24
  isDaytime: boolean;
  skyColor: THREE.Color;
  fogColor: THREE.Color;
  sunIntensity: number;
  ambientIntensity: number;
}

export type WeatherType = 'clear' | 'fog' | 'rain' | 'windy';

/**
 * Time and Weather System
 * Manages day/night cycles, dynamic weather, sky shader, and atmospheric effects.
 */
export class TimeWeatherSystem {
  private elapsed = 0;
  private currentHour = 12; // Start at noon
  private weatherChangeTimer = 0;
  currentWeather: WeatherType = 'clear';
  private hdrActive = false;

  // Weather particles
  private rainParticles: THREE.Points | null = null;
  private windDirection = 0;
  private windStrength = 0;

  // Sky shader control
  private setSunPosition: ((elevation: number, azimuth: number) => void) | null = null;

  // Post-processing removed for performance

  // Ocean ref for fog sync
  private ocean: Ocean | null = null;

  constructor(private scene: THREE.Scene, private sun: THREE.DirectionalLight, private city?: City) {
    this.createRainParticles();
  }

  /** Connect the sky shader's sun position setter. */
  setSkyController(setter: (elevation: number, azimuth: number) => void): void {
    this.setSunPosition = setter;
  }

  // setPostProcessing removed — post-processing stripped for performance

  /** Connect ocean for fog color sync. */
  setOcean(ocean: Ocean): void {
    this.ocean = ocean;
  }

  private createRainParticles(): void {
    const particleCount = WEATHER.RAIN_PARTICLE_COUNT;
    const positions = new Float32Array(particleCount * 3);
    const velocities: number[] = [];

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 1000;
      positions[i * 3 + 1] = Math.random() * 200;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 1000;

      velocities.push(40 + Math.random() * 20); // Downward speed
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color: 0xB0D4F1,
      size: 0.5,
      transparent: true,
      opacity: 0.6,
    });

    this.rainParticles = new THREE.Points(geo, mat);
    this.rainParticles.visible = false;
    this.scene.add(this.rainParticles);

    (this.rainParticles as any).velocities = velocities;
  }

  update(dt: number, playerPos: THREE.Vector3): void {
    this.elapsed += dt;

    if (TIME_SYSTEM.ENABLE_CYCLE) {
      this.updateDayNightCycle(dt);
    }

    this.updateWeather(dt, playerPos);
  }

  private updateDayNightCycle(dt: number): void {
    // Progress time
    const hoursPerSecond = 24 / TIME_SYSTEM.CYCLE_DURATION;
    this.currentHour += hoursPerSecond * dt;
    if (this.currentHour >= 24) this.currentHour -= 24;

    const timeOfDay = this.getTimeOfDay();

    // Update sky shader sun position
    if (this.setSunPosition) {
      // Map hour to sun elevation: rises at 5, peaks at 12, sets at 19
      // Below horizon at night (negative elevation)
      const hour = this.currentHour;
      let elevation: number;
      if (hour >= 5 && hour <= 19) {
        // Daytime arc: 0° at horizon, peaks at ~60° at noon
        const dayProgress = (hour - 5) / 14; // 0..1 from sunrise to sunset
        elevation = Math.sin(dayProgress * Math.PI) * 60;
      } else {
        // Night: sun below horizon
        elevation = -10;
      }
      const azimuth = 180 + (hour / 24) * 360; // rotates around
      this.setSunPosition(elevation, azimuth);

      // Update sky shader parameters for time of day
      // (turbidity, rayleigh, mie change with sun angle)
    }

    // No scene fog — clear atmosphere

    // Update sun light intensity
    this.sun.intensity = timeOfDay.sunIntensity;

    // Update sun direction (arc across sky), positioned relative to its target
    // so shadow camera following the player (set in Game.ts) works correctly.
    const sunAngle = (this.currentHour / 24) * Math.PI * 2 - Math.PI / 2;
    this.sun.position.copy(this.sun.target.position).add(
      new THREE.Vector3(
        Math.cos(sunAngle) * 100,
        Math.sin(sunAngle) * 100,
        50
      )
    );

    // Update building lights based on time
    if (this.city) {
      this.city.setNightMode(!timeOfDay.isDaytime);
    }

    // Color grading removed — post-processing stripped for performance
  }

  private updateWeather(dt: number, playerPos: THREE.Vector3): void {
    this.weatherChangeTimer += dt;

    if (this.weatherChangeTimer >= WEATHER.WEATHER_CHANGE_INTERVAL) {
      this.weatherChangeTimer = 0;
      this.changeWeather();
    }

    // Animate rain
    if (this.currentWeather === 'rain' && this.rainParticles) {
      const positions = this.rainParticles.geometry.attributes.position.array as Float32Array;
      const velocities = (this.rainParticles as any).velocities as number[];

      for (let i = 0; i < velocities.length; i++) {
        positions[i * 3 + 1] -= velocities[i] * dt;

        // Reset if below ground
        if (positions[i * 3 + 1] < 0) {
          positions[i * 3] = playerPos.x + (Math.random() - 0.5) * 500;
          positions[i * 3 + 1] = 200;
          positions[i * 3 + 2] = playerPos.z + (Math.random() - 0.5) * 500;
        }
      }

      // Keep rain centered on player
      this.rainParticles.position.set(
        Math.floor(playerPos.x / 100) * 100,
        0,
        Math.floor(playerPos.z / 100) * 100
      );

      this.rainParticles.geometry.attributes.position.needsUpdate = true;
    }

    // Update wind
    if (this.currentWeather === 'windy') {
      this.windDirection += dt * 0.2;
      this.windStrength = WEATHER.WIND_STRENGTH_RANGE[1];
    } else {
      this.windStrength = WEATHER.WIND_STRENGTH_RANGE[0];
    }
  }

  private changeWeather(): void {
    // No fog weather — only rain, wind, or clear
    const weatherTypes: WeatherType[] = ['clear', 'clear', 'rain', 'windy'];
    const newWeather = weatherTypes[Math.floor(Math.random() * weatherTypes.length)];
    this.currentWeather = newWeather;

    // Update visuals
    if (this.rainParticles) {
      this.rainParticles.visible = newWeather === 'rain';
    }

    console.log('Weather changed to:', newWeather);
  }

  private getTimeOfDay(): TimeOfDay {
    const hour = this.currentHour;

    // Sunrise: 5-7
    // Day: 7-17
    // Sunset: 17-19
    // Night: 19-5

    let skyColor: THREE.Color;
    let fogColor: THREE.Color;
    let sunIntensity: number;
    let ambientIntensity: number;
    let isDaytime: boolean;

    if (hour >= 5 && hour < 7) {
      // Sunrise
      const t = (hour - 5) / 2;
      skyColor = new THREE.Color().lerpColors(
        new THREE.Color(0x1a1a2e), // Night
        new THREE.Color(0xff6b35),  // Sunrise orange
        t
      );
      fogColor = new THREE.Color().lerpColors(
        new THREE.Color(0x3a3a5e),
        new THREE.Color(0xe8b090),
        t,
      );
      sunIntensity = 0.5 + t * 1.0;
      ambientIntensity = 0.3 + t * 0.3;
      isDaytime = true;
    } else if (hour >= 7 && hour < 17) {
      // Day
      skyColor = new THREE.Color(0x87ceeb);
      fogColor = new THREE.Color(0xc8d8e8);
      sunIntensity = 1.5;
      ambientIntensity = 0.6;
      isDaytime = true;
    } else if (hour >= 17 && hour < 19) {
      // Sunset
      const t = (hour - 17) / 2;
      skyColor = new THREE.Color().lerpColors(
        new THREE.Color(0xff6b35),  // Sunset orange
        new THREE.Color(0x1a1a2e),  // Night
        t
      );
      fogColor = new THREE.Color().lerpColors(
        new THREE.Color(0xd0a088),
        new THREE.Color(0x4a3a5e),
        t,
      );
      sunIntensity = 1.0 - t * 0.5;
      ambientIntensity = 0.6 - t * 0.3;
      isDaytime = false;
    } else {
      // Night
      skyColor = new THREE.Color(0x1a1a2e);
      fogColor = new THREE.Color(0x2a2a4e);
      sunIntensity = 0.2; // Moonlight
      ambientIntensity = 0.3;
      isDaytime = false;
    }

    return {
      hour,
      isDaytime,
      skyColor,
      fogColor,
      sunIntensity,
      ambientIntensity,
    };
  }

  getWindEffect(): { direction: number; strength: number } {
    return {
      direction: this.windDirection,
      strength: this.windStrength,
    };
  }

  getCurrentTime(): { hour: number; minute: number; isDaytime: boolean } {
    const hour = Math.floor(this.currentHour);
    const minute = Math.floor((this.currentHour - hour) * 60);
    const timeOfDay = this.getTimeOfDay();
    return { hour, minute, isDaytime: timeOfDay.isDaytime };
  }

  setWeather(weather: WeatherType): void {
    this.currentWeather = weather;
    this.weatherChangeTimer = 0;
  }

  setTimeOfDay(hour: number): void {
    this.currentHour = Math.max(0, Math.min(24, hour));
  }

  /** When an HDR environment map is active, skip sky/fog color overrides. */
  setHDRActive(active: boolean): void {
    this.hdrActive = active;
  }
}

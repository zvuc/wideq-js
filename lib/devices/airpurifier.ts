import { Device } from '../core/device';
import { asEnum, lookupEnum } from '../utils';

enum RotateSpeed {
  LOW = 2,
  MID = 4,
  HIGH = 6,
  FASTWIND = 7,
  AUTO = 8
}

/**
 * Operation Mode for an Air Purifier device.
 */
export enum AirPurifierOperationMode {
  SLEEP = '@AP_MAIN_MID_OPMODE_SLEEP_W',
  SILENT = '@AP_MAIN_MID_OPMODE_SILENT_W',
  CLEAN = '@AP_MAIN_MID_OPMODE_CLEAN_W'
}

/**
 * Fan Speed for an Air Purifier device.
 */
export enum AirPurifierFanSpeed {
  LOW = '@AP_MAIN_MID_WINDSTRENGTH_LOW_W',
  MID = '@AP_MAIN_MID_WINDSTRENGTH_MID_W',
  HIGH = '@AP_MAIN_MID_WINDSTRENGTH_HIGH_W',
  FASTWIND = '@AP_MAIN_MID_WINDSTRENGTH_FASTWIND_W',
  AUTO = '@AP_MAIN_MID_WINDSTRENGTH_AUTO_W'
}

/**
 * Whether a device is on or off.
 */
export enum AirPurifierOperation {
  ON = '@operation_on',
  OFF = '@operation_off'
}

export class AirPurifierDevice extends Device {
  public get f2c(): any {
    const mapping = this.model.value('TempFahToCel');
    if (mapping) {
      if (mapping.type === 'Enum') {
        return Object.entries(mapping.options).reduce((obj, [f, c]) => ({
          ...obj,
          [Number(f)]: c,
         }), {});
      }
    }

    return {};
  }

  public get c2f(): any {
    const mapping = this.model.value('TempCelToFah');
    const out = {};
    if (mapping) {
      if (mapping.type === 'Enum') {
        return Object.entries(mapping.options).reduce((obj, [f, c]) => ({
          ...obj,
          [Number(f)]: c,
         }), {});
      }
    }

    return out;
  }

  public async setCelsius(c: any) {
    await this.setControl('TempCfg', c);
  }

  public async setFahrenheit(f: any) {
    await this.setCelsius(this.f2c[f]);
  }

  /**
   * Turn off or on the device's zones.
   *
   * The `zones` parameter is a list of dicts with these keys:
   * - "No": The zone index. A string containing a number,
   *   starting from 1.
   * - "Cfg": Whether the zone is enabled. A string, either "1" or
   *   "0".
   * - "State": Whether the zone is open. Also "1" or "0".
   */
  public async setZones(zones: any) {
    const onCount: number = zones.reduce((accum: number, zone: any) => accum + Number(zone), 0);
    if (onCount > 0) {
      const zoneCmd = zones.filter((zone: any) => zone.Cfg === '1').map((zone: any) => `${zone.No}_${zone.State}`).join('/');
      await this.setControl('DuctZone', zoneCmd);
    }
  }

  public async getZones() {
    return this.getConfig('DuctZone');
  }

  public async setFanSpeed(speed: AirPurifierFanSpeed) {
    const speedValue = this.model.enumValue('WindStrength', speed);
    await this.setControl('WindStrength', speedValue);
  }

  public async setMode(mode: AirPurifierOperationMode) {
    const opValue = this.model.enumValue('OpMode', mode ? AirPurifierOperation.ON : AirPurifierOperation.OFF);
    await this.setControl('OpMode', opValue);
  }

  public async setOn(isOn: boolean) {
    const op = isOn ? AirPurifierOperation.ON : AirPurifierOperation.OFF;
    const opValue = this.model.enumValue('Operation', op);

    await this.setControl('Operation', opValue);
  }

  public async getFilterState() {
    return this.getConfig('Filter');
  }

  public async getMFilterState() {
    return this.getConfig('MFilter');
  }

  public async getEnergyTarget() {
    return this.getConfig('EnergyDesiredValue');
  }

  public async getLight() {
    const value = await this.getControl('DisplayControl');
    return value === '0';
  }

  public async getVolume() {
    const value = this.getControl('SpkVolume');
    return Number(value);
  }

  public async poll() {
    if (!this.monitor) {
      return null;
    }

    const resp = await this.monitor.poll();
    if (resp) {
      const data = this.model.decodeMonitor(resp);
      return new AirPurifierStatus(this, data);
    }

    return null;
  }
}
export class AirPurifierStatus {
  public constructor(
    public device: AirPurifierDevice,
    public data: any,
  ) { }

  public get currentTempInCelsius() {
    return Number(this.data.TempCur);
  }

  public get currentTempInFahrenheit() {
    return Number(this.device.c2f[this.currentTempInCelsius]);
  }

  public get targetTempInCelsius() {
    return Number(this.data.TempCfg);
  }

  public get targetTempInFahrenheit() {
    return Number(this.device.c2f[this.targetTempInCelsius]);
  }

  public get sensorPM1() {
    return Number(this.data.SensorPM1);
  }
  public get sensorPM2() {
    return Number(this.data.SensorPM2);
  }
  public get sensorPM10() {
    return Number(this.data.SensorPM10);
  }
  public get airPollution() {
    return Number(this.data.AirPolution); // typo on LG's end
  }
  public get totalAirPollution() {
    return Number(this.data.TotalAirPolution); // typo on LG's end
  }

  public get mode() {
    const key = lookupEnum('OpMode', this.data, this.device);
    return asEnum(AirPurifierOperationMode, key) === AirPurifierOperationMode.CLEAN;
  }

  public get fanSpeed() {
    const key = lookupEnum('WindStrength', this.data, this.device);
    return asEnum(AirPurifierFanSpeed, key);
  }

  public get isOn() {
    const key = lookupEnum('Operation', this.data, this.device);
    return asEnum(AirPurifierOperation, key) !== AirPurifierOperation.OFF;
  }
}

declare module "lunar-javascript" {
  export const Solar: {
    fromYmdHms(year: number, month: number, day: number, hour: number, minute: number, second: number): any;
  };
  export const Lunar: {
    fromYmdHms(year: number, month: number, day: number, hour: number, minute: number, second: number): any;
  };
}

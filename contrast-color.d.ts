declare module "contrast-color" {
  export function contrastColor({
    bgColor,
    fgDarkColor,
    fgLightColor,
    customNamedColors,
  }: {
    bgColor: string;
    fgDarkColor?: string;
    fgLightColor?: string;
    customNamedColors?: { [key: string]: string };
  }): string;
}

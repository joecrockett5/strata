export const deviceWidths = { mobile: 375, tablet: 768, desktop: 1280 } as const;
export type Device = keyof typeof deviceWidths;

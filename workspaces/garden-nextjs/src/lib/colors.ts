// Jaypie color definitions
// Source of truth for all Jaypie color palettes

export type ColorShades = {
  50: string;
  100: string;
  200: string;
  300: string;
  400: string;
  500: string;
  600: string;
  700: string;
  750?: string;
  800: string;
  900: string;
  950?: string;
};

// Neutral palettes (zinc for backgrounds, gray for foregrounds)
const boar: ColorShades = {
  50: "#f8f6f5",
  100: "#edebea",
  200: "#d8d5d3",
  300: "#bfbbb8",
  400: "#9a9592",
  500: "#706b68",
  600: "#565250",
  700: "#403d3b",
  750: "#343231",
  800: "#282726",
  900: "#161514",
  950: "#0c0b0b",
};

const bore: ColorShades = {
  50: "#f4f4f3",
  100: "#e5e5e4",
  200: "#cccbca",
  300: "#aeadab",
  400: "#8e8d8b",
  500: "#6c6b6a",
  600: "#545352",
  700: "#3f3e3e",
  750: "#353534",
  800: "#2c2c2b",
  900: "#191918",
  950: "#0d0d0c",
};

// Zinc uses boar values (backgrounds), gray uses bore values (foregrounds)
export const zinc = boar;
export const gray = bore;

// Brown palette
export const brown: ColorShades = {
  50: "#f8f6f4",
  100: "#efe9e5",
  200: "#ddd3c9",
  300: "#c4b5a6",
  400: "#a08d7a",
  500: "#7a6652",
  600: "#635242",
  700: "#4c3f33",
  800: "#362d25",
  900: "#201b16",
};

// Brand palettes
export const ink: ColorShades = {
  50: "#f8f5f7",
  100: "#ede9ec",
  200: "#d9d3d7",
  300: "#c0b7bd",
  400: "#9b9097",
  500: "#726870",
  600: "#585058",
  700: "#413940",
  800: "#2a2428",
  900: "#161013",
};

export const mist: ColorShades = {
  50: "#f5f6f8",
  100: "#e5e9ee",
  200: "#d5dbe2",
  300: "#b7c0ca",
  400: "#929da9",
  500: "#6d7a89",
  600: "#55616d",
  700: "#3f4953",
  800: "#2b323a",
  900: "#181c22",
};

// Standard color palettes
export const amber: ColorShades = {
  50: "#faf6ee",
  100: "#f4ebda",
  200: "#e8d5b5",
  300: "#d4b888",
  400: "#b89456",
  500: "#96703a",
  600: "#78582e",
  700: "#5c4324",
  800: "#42301a",
  900: "#261c10",
};

export const blue: ColorShades = {
  50: "#f3f5f8",
  100: "#e1e7f0",
  200: "#bcc9de",
  300: "#8da3c4",
  400: "#5c78a3",
  500: "#3d5a8a",
  600: "#31476d",
  700: "#263654",
  800: "#1b263b",
  900: "#111724",
};

export const cyan: ColorShades = {
  50: "#f1f5f7",
  100: "#dce8ed",
  200: "#b3ced9",
  300: "#7faabb",
  400: "#4c8294",
  500: "#356070",
  600: "#2a4c59",
  700: "#213a45",
  800: "#182a31",
  900: "#0f191d",
};

export const emerald: ColorShades = {
  50: "#f1f6f5",
  100: "#ddebe8",
  200: "#b5d4cd",
  300: "#82b5aa",
  400: "#4e8f82",
  500: "#356b5f",
  600: "#2a554b",
  700: "#21423a",
  800: "#182f29",
  900: "#0f1c19",
};

export const fuchsia: ColorShades = {
  50: "#f7f3f6",
  100: "#ede3eb",
  200: "#d9c3d4",
  300: "#be9ab4",
  400: "#9d6e8e",
  500: "#7d4e6e",
  600: "#633e57",
  700: "#4c2f43",
  800: "#36212f",
  900: "#20141c",
};

export const green: ColorShades = {
  50: "#f2f6f3",
  100: "#e0ebe2",
  200: "#bdd4c2",
  300: "#8fb69a",
  400: "#5e9070",
  500: "#3d6b4d",
  600: "#30553d",
  700: "#26422f",
  800: "#1b2f22",
  900: "#111c14",
};

export const indigo: ColorShades = {
  50: "#f4f4f8",
  100: "#e4e4f0",
  200: "#c5c5de",
  300: "#9d9dc4",
  400: "#7272a3",
  500: "#54548a",
  600: "#43436d",
  700: "#333354",
  800: "#24243b",
  900: "#161624",
};

export const lime: ColorShades = {
  50: "#f5f6ee",
  100: "#e8ebd6",
  200: "#d0d6ab",
  300: "#adb87a",
  400: "#869450",
  500: "#64703c",
  600: "#4f5830",
  700: "#3c4325",
  800: "#2a2f1a",
  900: "#191c10",
};

export const orange: ColorShades = {
  50: "#fdf8f3",
  100: "#f9ede2",
  200: "#f2d9c4",
  300: "#e8c19f",
  400: "#d9a070",
  500: "#a86d3d",
  600: "#8b5533",
  700: "#6f4428",
  800: "#573620",
  900: "#2d1c11",
};

export const pink: ColorShades = {
  50: "#f8f3f5",
  100: "#efe3e8",
  200: "#ddc3ce",
  300: "#c49aab",
  400: "#a66e82",
  500: "#864e62",
  600: "#6a3e4e",
  700: "#512f3b",
  800: "#3a2129",
  900: "#221419",
};

export const purple: ColorShades = {
  50: "#f6f4f8",
  100: "#ebe4f0",
  200: "#d4c5de",
  300: "#b49dc4",
  400: "#9072a3",
  500: "#70548a",
  600: "#59436d",
  700: "#443354",
  800: "#30243b",
  900: "#1d1624",
};

export const red: ColorShades = {
  50: "#f9f3f2",
  100: "#f0e0dd",
  200: "#e0c4be",
  300: "#c9a099",
  400: "#a8736a",
  500: "#8b4d42",
  600: "#6f3d35",
  700: "#572f29",
  800: "#3d211d",
  900: "#241412",
};

export const rose: ColorShades = {
  50: "#f8f3f4",
  100: "#efe3e5",
  200: "#ddc3c8",
  300: "#c49aa2",
  400: "#a66e78",
  500: "#864e58",
  600: "#6a3e46",
  700: "#512f36",
  800: "#3a2126",
  900: "#221417",
};

export const sky: ColorShades = {
  50: "#f2f5f8",
  100: "#dfe8f0",
  200: "#b8cede",
  300: "#88a9c4",
  400: "#5882a3",
  500: "#3d6a8a",
  600: "#31546d",
  700: "#264054",
  800: "#1b2e3b",
  900: "#111b24",
};

export const slate: ColorShades = {
  50: "#f3f4f6",
  100: "#e2e4e7",
  200: "#c8cbcf",
  300: "#aaadb2",
  400: "#8a8d93",
  500: "#686b70",
  600: "#515458",
  700: "#3d3f42",
  800: "#2b2c2f",
  900: "#18191b",
};

export const teal: ColorShades = {
  50: "#f1f5f6",
  100: "#dce9eb",
  200: "#b3d1d6",
  300: "#7fb0b8",
  400: "#4c8891",
  500: "#35656d",
  600: "#2a5057",
  700: "#213e43",
  800: "#182c30",
  900: "#0f1a1c",
};

export const violet: ColorShades = {
  50: "#f5f4f8",
  100: "#e8e4f0",
  200: "#cdc5de",
  300: "#a99dc4",
  400: "#8272a3",
  500: "#64548a",
  600: "#50436d",
  700: "#3d3354",
  800: "#2b243b",
  900: "#1a1624",
};

export const yellow: ColorShades = {
  50: "#f9f7ee",
  100: "#f2edd8",
  200: "#e4dab0",
  300: "#cfc07e",
  400: "#b3a04c",
  500: "#8a7a38",
  600: "#6d602c",
  700: "#534922",
  800: "#3b3418",
  900: "#23200f",
};

// All colors as a single object
export const colors = {
  amber,
  blue,
  brown,
  cyan,
  emerald,
  fuchsia,
  gray,
  green,
  indigo,
  ink,
  lime,
  mist,
  orange,
  pink,
  purple,
  red,
  rose,
  sky,
  slate,
  teal,
  violet,
  yellow,
  zinc,
};

// Flattened color map for runtime lookups (e.g., "amber-500" -> "#96703a")
export function buildColorPalette(): Record<string, string> {
  const palette: Record<string, string> = {};
  for (const [colorName, shades] of Object.entries(colors)) {
    for (const [shade, hex] of Object.entries(shades)) {
      palette[`${colorName}-${shade}`] = hex;
    }
  }
  return palette;
}

export const colorPalette = buildColorPalette();

// Helper to resolve color names to hex values
export function getColor(name: string): string {
  if (colorPalette[name]) {
    return colorPalette[name];
  }
  if (/^#?[0-9a-fA-F]{3,8}$/.test(name)) {
    return name.startsWith("#") ? name : `#${name}`;
  }
  return name;
}

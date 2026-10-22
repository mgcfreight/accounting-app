import { heroui } from "@heroui/react";

// HeroUI v2's Tailwind plugin, loaded from src/app/globals.css with @plugin.
// The theme is mokal-app's NextUI theme (tailwind.config.ts there), so
// components render in the same colours.
export default heroui({
  addCommonColors: false,
  defaultTheme: "light",
  defaultExtendTheme: "light",
  layout: {},
  themes: {
    light: {
      layout: {},
      colors: {
        primary: "#324878",
        secondary: "#7C4EAF",
        success: "#17C964",
        warning: "#F5A524",
        danger: "#F31260",
      },
    },
    dark: {
      layout: {},
      colors: {},
    },
  },
});

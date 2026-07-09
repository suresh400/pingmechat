import PropTypes from "prop-types";
import { useMemo, useEffect } from "react";
// @mui
import { CssBaseline } from "@mui/material";
import {
  createTheme,
  ThemeProvider as MUIThemeProvider,
  StyledEngineProvider,
} from "@mui/material/styles";
// hooks
import useSettings from "../hooks/useSettings.js";
//
import palette from "./palette";
import typography from "./typography";
import breakpoints from "./breakpoints";
import componentsOverride from "./overrides";
import shadows, { customShadows } from "./shadows";

// ----------------------------------------------------------------------

ThemeProvider.propTypes = {
  children: PropTypes.node,
};

export default function ThemeProvider({ children }) {
  const { themeMode, themeDirection, customPrimaryColor, customCss } = useSettings();

  const isLight = themeMode === "light";

  // Dynamic CSS injection
  useEffect(() => {
    let styleTag = document.getElementById("custom-theme-css");
    if (!styleTag) {
      styleTag = document.createElement("style");
      styleTag.id = "custom-theme-css";
      document.head.appendChild(styleTag);
    }
    styleTag.innerHTML = customCss || "";
  }, [customCss]);

  const themeOptions = useMemo(
    () => {
      const basePalette = isLight ? palette.light : palette.dark;
      const finalPalette = {
        ...basePalette,
        primary: customPrimaryColor ? {
          lighter: customPrimaryColor,
          light: customPrimaryColor,
          main: customPrimaryColor,
          dark: customPrimaryColor,
          darker: customPrimaryColor,
          contrastText: '#fff'
        } : basePalette.primary
      };

      return {
        palette: finalPalette,
        typography,
        breakpoints,
        shape: { borderRadius: 8 },
        direction: themeDirection,
        shadows: isLight ? shadows.light : shadows.dark,
        customShadows: isLight ? customShadows.light : customShadows.dark,
      };
    },
    [isLight, themeDirection, customPrimaryColor]
  );

  const theme = createTheme(themeOptions);

  theme.components = componentsOverride(theme);

  return (
    <StyledEngineProvider injectFirst>
      <MUIThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MUIThemeProvider>
    </StyledEngineProvider>
  );
}

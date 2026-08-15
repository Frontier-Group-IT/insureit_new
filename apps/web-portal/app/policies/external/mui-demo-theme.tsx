"use client";

import type { ReactNode } from "react";
import { ThemeProvider, createTheme } from "@mui/material/styles";

const externalPolicyMuiTheme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#17365D",
      dark: "#0D2746",
      light: "#EAF2FB",
      contrastText: "#FFFFFF",
    },
    secondary: {
      main: "#635BFF",
      dark: "#4F46E5",
      light: "#EEECFF",
    },
    success: { main: "#0F8A68" },
    warning: { main: "#D97706" },
    error: { main: "#D14343" },
    info: { main: "#2563EB" },
    text: {
      primary: "#12203B",
      secondary: "#64748B",
    },
    divider: "#E2E8F0",
    background: {
      default: "#F5F7FB",
      paper: "#FFFFFF",
    },
  },
  typography: {
    fontFamily: "var(--font-manrope), Manrope, ui-sans-serif, system-ui, sans-serif",
    h4: {
      fontFamily: "var(--font-display), Space Grotesk, var(--font-manrope), sans-serif",
      fontSize: "1.4rem",
      lineHeight: 1.2,
      fontWeight: 700,
      letterSpacing: "-0.025em",
    },
    h5: {
      fontFamily: "var(--font-display), Space Grotesk, var(--font-manrope), sans-serif",
      fontSize: "1.08rem",
      lineHeight: 1.25,
      fontWeight: 700,
      letterSpacing: "-0.015em",
    },
    h6: {
      fontSize: "0.88rem",
      fontWeight: 800,
    },
    body1: {
      fontSize: "0.82rem",
      lineHeight: 1.5,
    },
    body2: {
      fontSize: "0.76rem",
      lineHeight: 1.45,
    },
    caption: {
      fontSize: "0.68rem",
      lineHeight: 1.4,
      fontWeight: 600,
    },
    button: {
      textTransform: "none",
      fontSize: "0.72rem",
      fontWeight: 800,
      letterSpacing: 0,
    },
  },
  shape: {
    borderRadius: 10,
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true, size: "small" },
      styleOverrides: {
        root: {
          minHeight: 36,
          borderRadius: 9,
          paddingInline: 14,
        },
        containedPrimary: {
          boxShadow: "0 4px 12px rgba(23,54,93,.13)",
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          minHeight: 38,
          borderRadius: 9,
          backgroundColor: "#FFFFFF",
          transition: "border-color .14s ease, box-shadow .14s ease",
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: "#9EB4CF",
          },
          "&.Mui-focused": {
            boxShadow: "0 0 0 2px rgba(99,91,255,.09)",
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: "#635BFF",
            borderWidth: 1,
          },
        },
        input: {
          paddingTop: 9,
          paddingBottom: 9,
          fontSize: 12.5,
          fontWeight: 600,
          color: "#17203A",
        },
        notchedOutline: {
          borderColor: "#CBD5E1",
        },
      },
    },
    MuiAutocomplete: {
      styleOverrides: {
        inputRoot: {
          paddingTop: "2px !important",
          paddingBottom: "2px !important",
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          fontSize: 11.5,
          fontWeight: 700,
          color: "#526079",
        },
      },
    },
    MuiFormHelperText: {
      styleOverrides: {
        root: {
          marginLeft: 2,
          marginTop: 3,
          fontSize: 10,
          fontWeight: 600,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          height: 24,
          borderRadius: 999,
          fontWeight: 800,
          fontSize: 10,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        rounded: {
          borderRadius: 12,
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        root: { minHeight: 36 },
        indicator: {
          height: 2,
          borderRadius: 999,
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          minHeight: 36,
          minWidth: 68,
          paddingTop: 7,
          paddingBottom: 7,
          textTransform: "none",
          fontSize: 11,
          fontWeight: 800,
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 14,
          border: "1px solid #E2E8F0",
        },
      },
    },
  },
});

export function ExternalPolicyMuiTheme({ children }: { children: ReactNode }) {
  return <ThemeProvider theme={externalPolicyMuiTheme}>{children}</ThemeProvider>;
}

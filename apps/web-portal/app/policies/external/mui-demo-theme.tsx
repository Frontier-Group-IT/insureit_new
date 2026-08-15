"use client";

// Preview redeploy trigger after Vercel environment refresh (2026-08-15).
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
      fontSize: "1.7rem",
      lineHeight: 1.15,
      fontWeight: 700,
      letterSpacing: "-0.035em",
    },
    h5: {
      fontFamily: "var(--font-display), Space Grotesk, var(--font-manrope), sans-serif",
      fontSize: "1.2rem",
      lineHeight: 1.25,
      fontWeight: 700,
      letterSpacing: "-0.02em",
    },
    h6: {
      fontSize: "0.95rem",
      fontWeight: 800,
    },
    body1: {
      fontSize: "0.875rem",
      lineHeight: 1.6,
    },
    body2: {
      fontSize: "0.78rem",
      lineHeight: 1.55,
    },
    caption: {
      fontSize: "0.7rem",
      lineHeight: 1.45,
      fontWeight: 600,
    },
    button: {
      textTransform: "none",
      fontSize: "0.75rem",
      fontWeight: 800,
      letterSpacing: 0,
    },
  },
  shape: {
    borderRadius: 12,
  },
  shadows: [
    "none",
    "0 1px 2px rgba(15,23,42,.04)",
    "0 4px 16px rgba(23,54,93,.06)",
    "0 8px 24px rgba(23,54,93,.08)",
    "0 12px 34px rgba(23,54,93,.10)",
    "0 16px 42px rgba(23,54,93,.11)",
    "0 20px 52px rgba(23,54,93,.12)",
    "0 24px 64px rgba(23,54,93,.13)",
    "0 28px 70px rgba(23,54,93,.14)",
    "0 32px 80px rgba(23,54,93,.15)",
    "0 36px 90px rgba(23,54,93,.16)",
    "0 40px 100px rgba(23,54,93,.17)",
    "0 44px 110px rgba(23,54,93,.18)",
    "0 48px 120px rgba(23,54,93,.19)",
    "0 52px 130px rgba(23,54,93,.20)",
    "0 56px 140px rgba(23,54,93,.21)",
    "0 60px 150px rgba(23,54,93,.22)",
    "0 64px 160px rgba(23,54,93,.23)",
    "0 68px 170px rgba(23,54,93,.24)",
    "0 72px 180px rgba(23,54,93,.25)",
    "0 76px 190px rgba(23,54,93,.26)",
    "0 80px 200px rgba(23,54,93,.27)",
    "0 84px 210px rgba(23,54,93,.28)",
    "0 88px 220px rgba(23,54,93,.29)",
    "0 92px 230px rgba(23,54,93,.30)",
  ],
  components: {
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          minHeight: 40,
          borderRadius: 12,
          paddingInline: 16,
        },
        containedPrimary: {
          boxShadow: "0 10px 24px rgba(23,54,93,.16)",
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          minHeight: 44,
          borderRadius: 12,
          backgroundColor: "#FFFFFF",
          transition: "border-color .16s ease, box-shadow .16s ease, background-color .16s ease",
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: "#9EB4CF",
          },
          "&.Mui-focused": {
            boxShadow: "0 0 0 3px rgba(99,91,255,.10)",
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: "#635BFF",
            borderWidth: 1,
          },
        },
        input: {
          fontSize: 13,
          fontWeight: 600,
          color: "#17203A",
        },
        notchedOutline: {
          borderColor: "#CBD5E1",
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          fontSize: 12,
          fontWeight: 700,
          color: "#526079",
        },
      },
    },
    MuiFormHelperText: {
      styleOverrides: {
        root: {
          marginLeft: 2,
          fontSize: 10.5,
          fontWeight: 600,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          fontWeight: 800,
          fontSize: 10.5,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        rounded: {
          borderRadius: 18,
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: {
          height: 3,
          borderRadius: 999,
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          minHeight: 42,
          minWidth: 76,
          textTransform: "none",
          fontSize: 11.5,
          fontWeight: 800,
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 20,
          border: "1px solid #E2E8F0",
        },
      },
    },
  },
});

export function ExternalPolicyMuiTheme({ children }: { children: ReactNode }) {
  return <ThemeProvider theme={externalPolicyMuiTheme}>{children}</ThemeProvider>;
}

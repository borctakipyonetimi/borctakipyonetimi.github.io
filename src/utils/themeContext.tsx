import React, { createContext, useContext, useState, useEffect } from "react";

export interface ColorTheme {
  id: string;
  name: string;
  label: string;
  emoji: string;
  primary: string;
  accent: string;
  className: string;
}

export const COLOR_THEMES: ColorTheme[] = [
  {
    id: "purple",
    name: "MOR",
    label: "MOR (Purple)",
    emoji: "🟣",
    primary: "#8B5CF6",
    accent: "#C4B5FD",
    className: "theme-purple",
  },
  {
    id: "green",
    name: "YEŞİL",
    label: "YEŞİL (Emerald)",
    emoji: "🟢",
    primary: "#10B981",
    accent: "#6EE7B7",
    className: "theme-green",
  },
  {
    id: "blue",
    name: "MAVİ",
    label: "MAVİ (Ocean)",
    emoji: "🔵",
    primary: "#0EA5E9",
    accent: "#38BDF8",
    className: "theme-blue",
  },
  {
    id: "pink",
    name: "PEMBE",
    label: "PEMBE (Neon Pink)",
    emoji: "🌸",
    primary: "#EC4899",
    accent: "#F472B6",
    className: "theme-pink",
  },
  {
    id: "orange",
    name: "AMBER",
    label: "AMBER (Gold/Orange)",
    emoji: "🟠",
    primary: "#F59E0B",
    accent: "#FCD34D",
    className: "theme-orange",
  },
  {
    id: "cyan",
    name: "TURKUAZ",
    label: "TURKUAZ (Cyber Cyan)",
    emoji: "💎",
    primary: "#06B6D4",
    accent: "#67E8F9",
    className: "theme-cyan",
  },
  {
    id: "coral",
    name: "MERCAN",
    label: "MERCAN (Coral Red)",
    emoji: "🪸",
    primary: "#F43F5E",
    accent: "#FDA4AF",
    className: "theme-coral",
  },
  {
    id: "indigo",
    name: "İNDİGO",
    label: "İNDİGO (Deep Indigo)",
    emoji: "🔮",
    primary: "#6366F1",
    accent: "#A5B4FC",
    className: "theme-indigo",
  },
];

export const getThemeById = (id?: string): ColorTheme => {
  if (!id || id === "default") return COLOR_THEMES[7]; // indigo
  if (id === "amber") return COLOR_THEMES[4]; // orange
  if (id === "emerald") return COLOR_THEMES[1]; // green
  if (id === "ocean") return COLOR_THEMES[2]; // blue
  const found = COLOR_THEMES.find((t) => t.id === id);
  return found || COLOR_THEMES[7];
};

interface ThemeContextType {
  colorTheme: string;
  activeTheme: ColorTheme;
  setColorTheme: (themeId: string) => void;
  themes: ColorTheme[];
}

const ThemeContext = createContext<ThemeContextType>({
  colorTheme: "indigo",
  activeTheme: COLOR_THEMES[7],
  setColorTheme: () => {},
  themes: COLOR_THEMES,
});

export const applyThemeToDom = (themeId: string) => {
  const theme = getThemeById(themeId);
  const allThemeClasses = [
    "theme-default",
    "theme-purple",
    "theme-green",
    "theme-blue",
    "theme-pink",
    "theme-orange",
    "theme-cyan",
    "theme-coral",
    "theme-indigo",
  ];

  allThemeClasses.forEach((cls) => {
    document.documentElement.classList.remove(cls);
    document.body.classList.remove(cls);
  });

  document.documentElement.classList.add(theme.className);
  document.body.classList.add(theme.className);

  // Set CSS variables on root element
  document.documentElement.style.setProperty("--theme-primary", theme.primary);
  document.documentElement.style.setProperty("--theme-accent", theme.accent);
  document.documentElement.style.setProperty("--theme-glow", `${theme.primary}40`);

  // Update theme-color meta tag for mobile browsers and PWA
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute("content", theme.primary);
  }
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [colorTheme, setColorThemeState] = useState<string>(() => {
    return localStorage.getItem("colorTheme") || "indigo";
  });

  const activeTheme = getThemeById(colorTheme);

  const setColorTheme = (themeId: string) => {
    setColorThemeState(themeId);
    localStorage.setItem("colorTheme", themeId);
    applyThemeToDom(themeId);
  };

  useEffect(() => {
    applyThemeToDom(colorTheme);
  }, [colorTheme]);

  return (
    <ThemeContext.Provider value={{ colorTheme, activeTheme, setColorTheme, themes: COLOR_THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);

import { Metadata } from "next";

export const siteConfig: Metadata = {
  title: { default: "Falco", template: "%s | Falco" },
  description: "Five-minute Bitcoin markets, settled on Celo.",
  applicationName: "Falco",
  keywords: ["Celo", "Bitcoin", "Prediction Markets", "AI Agents", "DeFi"],
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
    shortcut: "/favicon.ico",
  },
};

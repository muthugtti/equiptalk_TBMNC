import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: 'swap',
});

// Runs before React hydration to apply the persisted (or system) theme to
// <html>, preventing a flash of the wrong theme on first paint.
const themeScript = `
(function () {
  try {
    var stored = localStorage.getItem('equiptalk-theme');
    var theme = stored === 'light' || stored === 'dark'
      ? stored
      : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    var root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.style.colorScheme = theme;
  } catch (e) {}
})();
`;

export const metadata: Metadata = {
  title: "Equiptalk AI",
  description: "Intelligent Equipment Management, Powered by AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined" rel="stylesheet" />
      </head>
      <body
        suppressHydrationWarning
        className={`${inter.variable} font-sans antialiased bg-background-light dark:bg-background-dark text-gray-900 dark:text-gray-100`}
      >
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}

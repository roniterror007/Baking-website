import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Golden Delights — Handmade happiness, Bangalore",
  description: "Handcrafted cakes, cheesecakes, brownies and blondies in Bangalore. Discover your next little delight or create a cake that's entirely yours.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script id="golden-theme" dangerouslySetInnerHTML={{ __html: "try{document.documentElement.dataset.theme=localStorage.getItem('golden-theme')==='light'?'light':'dark'}catch{document.documentElement.dataset.theme='dark'}" }} /></head>
      <body>{children}</body>
    </html>
  );
}

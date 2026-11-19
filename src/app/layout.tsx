import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Fonts are bundled in ./fonts (SIL Open Font License) instead of fetched from
// Google Fonts, so a build never fails because the font download did.
const figtree = localFont({
  variable: "--font-figtree",
  src: [
    { path: "./fonts/figtree-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/figtree-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/figtree-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fonts/figtree-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  display: "swap",
});

const instrumentSerif = localFont({
  variable: "--font-instrument",
  src: [{ path: "./fonts/instrument-serif-latin-400-normal.woff2", weight: "400", style: "normal" }],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Classic Consigns by KYS",
  description: "Consignment point of sale and store management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${figtree.variable} ${instrumentSerif.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.theme==='dark')document.documentElement.classList.add('dark')}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

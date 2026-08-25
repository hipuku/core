import type { Metadata } from "next";
import { Gabarito, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const gabarito = Gabarito({
  variable: "--font-gabarito",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "core — decision log",
  description:
    "A team decision log for architecture decision records, with a permission-gated lifecycle and full history.",
};

// Typed explicitly rather than with Next's generated `LayoutProps`: that global
// lives in `.next/types`, so `tsc --noEmit` on a clean checkout — which is what
// CI does — cannot see it. The root layout takes no route params, so the
// generated type was buying nothing.
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${gabarito.variable} ${geistMono.variable}`}>
      <body>
        {children}
        <Toaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  );
}

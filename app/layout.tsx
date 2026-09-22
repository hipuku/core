import type { Metadata } from "next";
import { Gabarito, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
// globals.css first: it imports haus-tokens/layers.css, which declares the
// @layer order (…semantics, motion, components). haus-components' styles fill
// the haus.components layer and must come after that declaration, or the layer
// registers out of order and component styles lose to the role layer.
import "./globals.css";
import "haus-components/styles.css";

const gabarito = Gabarito({
  variable: "--font-gabarito",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const description =
  "A decision log for architecture decision records, with a permission-gated lifecycle, a history of each decision's text and a log of its status changes.";

// metadataBase makes the og:image that Next derives from app/opengraph-image.png
// absolute, which link previews (LinkedIn, Slack) need.
export const metadata: Metadata = {
  metadataBase: new URL("https://core.hipuku.dev"),
  title: "core: decision log",
  description,
  openGraph: {
    type: "website",
    url: "/",
    siteName: "core",
    title: "core: decision log",
    description,
  },
  twitter: { card: "summary_large_image" },
};

// Typed explicitly rather than with Next's generated `LayoutProps`: that global
// lives in `.next/types`, so `tsc --noEmit` on a clean checkout, which is what
// CI does, cannot see it. The root layout takes no route params, so the
// generated type was buying nothing.
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-haus-theme="core" className={`${gabarito.variable} ${geistMono.variable}`}>
      <body>
        {children}
        {/* haus Toast draws the surface now, through lib/toast, so sonner's own
            styling is off: `richColors` and `closeButton` would paint a second
            card under the first and a second dismiss beside it. sonner keeps
            what it is good at, the queue and the position. */}
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}

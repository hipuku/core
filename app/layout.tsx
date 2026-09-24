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

// metadataBase makes the og:image absolute, which link previews (LinkedIn,
// Slack) need. The card is declared here rather than as app/opengraph-image.png
// because the file convention's alt text reached the static pages and not
// /sign-in, which is rendered per request and is the page that gets shared.
const ogImage = {
  // Versioned, since platforms cache a preview by its URL.
  url: "/og.png?v=3",
  width: 1200,
  height: 630,
  alt: "core. Team decision log. Made by hipuku.",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://core.hipuku.dev"),
  title: "core: decision log",
  description,
  openGraph: {
    type: "website",
    url: "/sign-in",
    siteName: "core",
    title: "core: decision log",
    description,
    images: [ogImage],
  },
  twitter: { card: "summary_large_image", images: [ogImage] },
};

// What core is, for search engines: a free web app by hipuku, built from a
// public repository. The same shape the hipuku tools declare, linked to the
// person on hipuku.dev by @id.
const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": "https://core.hipuku.dev/#website",
      "name": "core",
      "url": "https://core.hipuku.dev/",
      "publisher": {
        "@id": "https://hipuku.dev/#person"
      }
    },
    {
      "@type": "WebApplication",
      "@id": "https://core.hipuku.dev/#app",
      "name": "core",
      "url": "https://core.hipuku.dev/sign-in",
      "description": description,
      "applicationCategory": "DeveloperApplication",
      "operatingSystem": "Any",
      "browserRequirements": "Requires JavaScript.",
      "isAccessibleForFree": true,
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD"
      },
      "license": "https://opensource.org/licenses/MIT",
      "author": {
        "@type": "Person",
        "@id": "https://hipuku.dev/#person",
        "name": "hipuku",
        "url": "https://hipuku.dev"
      },
      "publisher": {
        "@id": "https://hipuku.dev/#person"
      },
      "image": "https://core.hipuku.dev/og.png",
      "isBasedOn": {
        "@id": "https://github.com/hipuku/core"
      }
    },
    {
      "@type": "SoftwareSourceCode",
      "@id": "https://github.com/hipuku/core",
      "name": "core",
      "codeRepository": "https://github.com/hipuku/core",
      "programmingLanguage": "TypeScript",
      "license": "https://opensource.org/licenses/MIT",
      "author": {
        "@id": "https://hipuku.dev/#person"
      }
    }
  ]
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
        <script
          type="application/ld+json"
          // JSON.stringify escapes nothing HTML-significant here: every value is
          // a fixed string written above.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
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

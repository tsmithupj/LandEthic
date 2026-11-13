import type { Metadata } from "next";
import { Arvo, Public_Sans } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import 'mapbox-gl/dist/mapbox-gl.css';
import { StoreProvider } from "@/lib/store";
import { ReportProblemProvider } from "@/components/ReportProblem";

const arvo = Arvo({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  variable: "--font-arvo",
  display: "swap",
});

const publicSans = Public_Sans({
  subsets: ["latin"],
  variable: "--font-public-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "LandEthic.io — AI-powered land stewardship",
  description:
    "Enter your property address and get a personalized, ecosystem-aware land management plan. Soil, birds, plants, and wildlife — all in one place.",
  keywords: ["land management", "wildlife habitat", "conservation", "deer hunting", "native plants", "soil health"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      afterSignOutUrl="/"
      appearance={{
        variables: {
          colorPrimary: "#3B6D11",
          colorBackground: "#FBF6EC",
          colorText: "#2A2116",
          colorTextSecondary: "#6B5D48",
          colorInputBackground: "#FFFFFF",
          fontFamily: "var(--font-public-sans), -apple-system, sans-serif",
          borderRadius: "0.625rem",
        },
        elements: {
          formButtonPrimary: "bg-forest-700 hover:bg-forest-800",
          card: "shadow-none border border-paper-line",
          headerTitle: "font-display text-ink",
          socialButtonsBlockButton: "border-paper-line",
        },
      }}
    >
      <html
        lang="en"
        className={`h-full antialiased ${arvo.variable} ${publicSans.variable}`}
      >
        <body className="min-h-full flex flex-col bg-cream text-ink">
          <ReportProblemProvider>
            <StoreProvider>{children}</StoreProvider>
          </ReportProblemProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}

import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import 'mapbox-gl/dist/mapbox-gl.css';
import { StoreProvider } from "@/lib/store";

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
      appearance={{
        variables: {
          colorPrimary: "#3B6D11",
          colorBackground: "#ffffff",
          borderRadius: "0.75rem",
        },
        elements: {
          formButtonPrimary: "bg-[#3B6D11] hover:bg-[#2D5409]",
          card: "shadow-none border border-gray-100",
          headerTitle: "text-gray-900",
          socialButtonsBlockButton: "border-gray-200",
        },
      }}
    >
      <html
        lang="en"
        className="h-full antialiased"
      >
        <body className="min-h-full flex flex-col">
          <StoreProvider>{children}</StoreProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}

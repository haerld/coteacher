import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import ClientLayout from "@/components/ClientLayout";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  title: "CoTeacher",
  description:
    "Your classroom co-pilot — track attendance, manage classes, and more.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={poppins.variable}>
      <body
        className={`${poppins.variable} antialiased bg-amber-50 text-gray-900 min-h-screen`}
      >
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}

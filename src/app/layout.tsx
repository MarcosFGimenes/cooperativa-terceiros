import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cooperativa Terceiros",
  description: "Portal de gestão de terceiros da cooperativa.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}

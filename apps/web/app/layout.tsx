import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "WorkWorld — CodeWorks Dev Harness",
  description: "Development harness for the WorkWorld simulation foundation.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#0f1420", color: "#e8ecf4" }}>
        {children}
      </body>
    </html>
  );
}

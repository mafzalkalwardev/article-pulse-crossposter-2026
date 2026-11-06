import "./globals.css";

export const metadata = {
  title: "Article Pulse",
  description: "Your personal workspace for turning real work into searchable articles and publishing them everywhere.",
};

export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}

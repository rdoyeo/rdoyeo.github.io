import type { Metadata } from "next";
import { Bricolage_Grotesque, IBM_Plex_Mono, Figtree, Newsreader, Noto_Serif_KR, Noto_Sans_KR } from "next/font/google";
import "./globals.css";

const sans = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex" });

const headings = Figtree({ subsets: ["latin"], variable: "--font-figtree" });
const serif = Newsreader({ subsets: ["latin"], variable: "--font-newsreader" });
const koreanSerif = Noto_Serif_KR({ subsets: ["latin"], variable: "--font-korean-serif", preload: false });
const koreanSans = Noto_Sans_KR({ subsets: ["latin"], variable: "--font-korean-sans", preload: false });

export const metadata: Metadata = {
  title: "Doyeon",
  description: "Doyeon's personal website and projects.",
  icons: { icon: "/doyeon-icon-transparent-256.png" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem('doyeon-theme');document.documentElement.dataset.theme=t==='light'?'light':'dark';document.documentElement.style.colorScheme=t==='light'?'light':'dark'}catch(e){}` }} /></head><body className={`${sans.variable} ${mono.variable} ${headings.variable} ${serif.variable} ${koreanSerif.variable} ${koreanSans.variable} antialiased`}>{children}</body></html>;
}

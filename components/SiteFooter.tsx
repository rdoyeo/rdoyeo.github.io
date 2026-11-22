import { cvUrl } from '../content/socials';

const socials = [
  { label: 'GITHUB', href: 'https://github.com/' },
  { label: 'LINKEDIN', href: 'https://www.linkedin.com/' },
  { label: 'RSS', href: 'https://example.com/rss' },
];

export default function SiteFooter() {
  return (
    <footer className="relative z-[1] mx-auto box-border flex w-full max-w-[1280px] flex-none flex-wrap justify-between gap-4 border-t border-[var(--line)] px-8 pt-6 pb-8 font-mono text-[12px] font-medium tracking-[0.08em] text-[var(--muted)] @max-[700px]:gap-x-4 @max-[700px]:gap-y-2 @max-[700px]:px-4 @max-[700px]:pt-3.5 @max-[700px]:pb-4">
      <span>© 2026 DOYEON</span>
      <nav aria-label="Social links and CV" className="flex flex-wrap gap-6">
        {socials.map(({ label, href }) => <a key={label} href={href} className="footer-link">{label}</a>)}
        {cvUrl ? <a href={cvUrl} className="footer-link">CV</a> : <span aria-disabled="true" title="CV not yet available">CV</span>}
      </nav>
    </footer>
  );
}

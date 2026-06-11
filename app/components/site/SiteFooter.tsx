import Link from "next/link";
import Image from "next/image";

export function SiteFooter() {
  return (
    <footer className="px-6 pb-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 pt-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Image src="/falco-logo.png" alt="Falco" width={50} height={50} className="h-6 w-6 object-contain" />
          <span className="text-lg font-medium">falco</span>
        </div>
        <nav className="flex items-center gap-5 text-xs text-muted-foreground">
          <Link href="/docs" className="transition-colors hover:text-foreground">API</Link>
          <Link href="https://github.com" target="_blank" className="transition-colors hover:text-foreground">GitHub</Link>
          <Link href="https://celo.org" target="_blank" className="transition-colors hover:text-foreground">Celo</Link>
        </nav>
      </div>
    </footer>
  );
}

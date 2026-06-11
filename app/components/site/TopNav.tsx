import Link from "next/link";
import Image from "next/image";

export function TopNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/0 bg-background/40 backdrop-blur supports-[backdrop-filter]:bg-background/30">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-6 px-6">
        <Link href="/" className="flex items-center gap-2 text-base font-semibold tracking-tight">
          <Image src="/falco-logo.png" alt="Falco" width={36} height={36} className="h-9 w-9 object-contain" />
          <span className="text-xl font-medium">falco</span>
        </Link>
        <nav className="hidden items-center gap-5 text-sm text-muted-foreground sm:flex">
          <Link href="/markets" className="transition-colors hover:text-foreground">Markets</Link>
          <Link href="/agents"  className="transition-colors hover:text-foreground">Agents</Link>
          <Link href="/docs"    className="transition-colors hover:text-foreground">API</Link>
        </nav>
        <div className="ml-auto text-xs text-muted-foreground">Celo Sepolia</div>
      </div>
    </header>
  );
}

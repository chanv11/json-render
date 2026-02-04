import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";

export function Header() {
  return (
    <header className="sticky top-0 z-50 bg-background">
      <div className="flex h-14 items-center justify-between px-4 gap-6">
        <div className="flex items-center gap-2">
          <Link href="https://vercel.com" title="Made with love by Vercel">
            <svg
              data-testid="geist-icon"
              height="18"
              strokeLinejoin="round"
              viewBox="0 0 16 16"
              width="18"
              style={{ color: "currentcolor" }}
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M8 1L16 15H0L8 1Z"
                fill="currentColor"
              ></path>
            </svg>
          </Link>
          <span className="text-(--ds-gray-500)">
            <svg
              data-testid="geist-icon"
              height="16"
              strokeLinejoin="round"
              viewBox="0 0 16 16"
              width="16"
              style={{ color: "currentcolor" }}
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M4.01526 15.3939L4.3107 14.7046L10.3107 0.704556L10.6061 0.0151978L11.9849 0.606077L11.6894 1.29544L5.68942 15.2954L5.39398 15.9848L4.01526 15.3939Z"
                fill="currentColor"
              ></path>
            </svg>
          </span>
          <Link href="/">
            <span className="font-medium tracking-tight text-lg">
              otakus-render
            </span>
          </Link>
        </div>
        <nav className="flex items-center gap-4">
          {/* <Link
            href="/playground"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <span className="sm:hidden">Play</span>
            <span className="hidden sm:inline">Playground</span>
          </Link> */}
          {/* <Link
            href="/docs"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Docs
          </Link>
          <a
            href="https://github.com/vercel-labs/json-render"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            GitHub
          </a> */}
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}

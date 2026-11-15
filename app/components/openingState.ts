let portfolioVisited = false;
let lastPortfolioPathname: string | null = null;
let portfolioClientNavigated = false;

export function shouldShowPortfolioOpening(): boolean {
  return typeof window === "undefined" || !portfolioVisited;
}

export function markPortfolioVisited(): void {
  if (typeof window !== "undefined") portfolioVisited = true;
}

export function trackPortfolioPathname(pathname: string): void {
  if (lastPortfolioPathname !== null && lastPortfolioPathname !== pathname) {
    portfolioClientNavigated = true;
  }
  lastPortfolioPathname = pathname;
}

export function hasPortfolioClientNavigated(): boolean {
  return portfolioClientNavigated;
}

/**
 * Shared idle coordination.
 *
 * Only ONE logo on the page may run an automatic (idle) transformation at a
 * time, and a short cooldown follows each one so two logos never take turns
 * back-to-back. Hover/focus interactions bypass this on purpose: user intent
 * always wins.
 */
class IdleCoordinator {
  private owner: unknown = null;
  private cooldownUntil = 0;

  acquire(owner: unknown): boolean {
    const now = typeof performance !== "undefined" ? performance.now() : 0;
    if (this.owner && this.owner !== owner) return false;
    if (!this.owner && now < this.cooldownUntil) return false;
    this.owner = owner;
    return true;
  }

  release(owner: unknown, cooldownMs = 3000) {
    if (this.owner !== owner) return;
    this.owner = null;
    this.cooldownUntil = performance.now() + cooldownMs;
  }
}

export const idleCoordinator = new IdleCoordinator();

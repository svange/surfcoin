/**
 * Minimal Solana wallet connect + message signing, no adapter UI kit.
 *
 * We target the injected-provider shape that Phantom, Solflare, and Backpack
 * all expose (`connect`, `signMessage`, `signTransaction`), preferring
 * Phantom's namespaced handle. This keeps the bundle tiny; a full
 * @solana/wallet-adapter stack would add ~300KB for a one-button flow.
 */

interface SolanaProvider {
  isPhantom?: boolean
  publicKey?: { toString(): string } | null
  connect(opts?: { onlyIfTrusted?: boolean }): Promise<{ publicKey: { toString(): string } }>
  disconnect?(): Promise<void>
  signMessage(message: Uint8Array, display?: 'utf8' | 'hex'): Promise<{ signature: Uint8Array }>
  signTransaction?(tx: unknown): Promise<unknown>
}

declare global {
  interface Window {
    phantom?: { solana?: SolanaProvider }
    solana?: SolanaProvider
    solflare?: SolanaProvider
    backpack?: SolanaProvider
  }
}

export interface WalletInfo {
  name: string
  provider: SolanaProvider
}

export function detectWallets(): WalletInfo[] {
  const found: WalletInfo[] = []
  const phantom = window.phantom?.solana ?? (window.solana?.isPhantom ? window.solana : undefined)
  if (phantom) found.push({ name: 'Phantom', provider: phantom })
  if (window.solflare) found.push({ name: 'Solflare', provider: window.solflare })
  if (window.backpack) found.push({ name: 'Backpack', provider: window.backpack })
  if (!found.length && window.solana) found.push({ name: 'Wallet', provider: window.solana })
  return found
}

export function base64FromBytes(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
}

export async function connectWallet(provider: SolanaProvider): Promise<string> {
  const res = await provider.connect()
  return res.publicKey.toString()
}

export async function signMessage(provider: SolanaProvider, message: string): Promise<string> {
  const { signature } = await provider.signMessage(new TextEncoder().encode(message), 'utf8')
  return base64FromBytes(signature)
}

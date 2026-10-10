/**
 * @soryos/sandbox
 * Registry des providers de sandbox.
 */

import { SandboxProvider } from "./provider";
import { ProviderId } from "./types";
import { LocalProvider } from "./providers/local";

// Import dynamique pour éviter les erreurs de bundling
let E2BProvider: typeof import("./providers/e2b").E2BProvider | null = null;
let VercelProvider: typeof import("./providers/vercel").VercelProvider | null = null;
let GoogleCloudRunProvider: typeof import("./providers/google-cloud-run").GoogleCloudRunProvider | null = null;
let GitHubCodespacesProvider: typeof import("./providers/github-codespaces").GitHubCodespacesProvider | null = null;

class SandboxRegistry {
  private providers = new Map<ProviderId, SandboxProvider>();

  constructor() {
    // Local provider est toujours disponible
    this.register(new LocalProvider());
  }

  register(provider: SandboxProvider): void {
    this.providers.set(provider.id, provider);
  }

  get(id: ProviderId): SandboxProvider | undefined {
    return this.providers.get(id);
  }

  getAll(): SandboxProvider[] {
    return Array.from(this.providers.values());
  }

  has(id: ProviderId): boolean {
    return this.providers.has(id);
  }

  /**
   * Crée un provider de manière dynamique (pour éviter les erreurs de bundling).
   */
  async createProvider(id: ProviderId, sessionId?: string): Promise<SandboxProvider> {
    switch (id) {
      case "local":
        return new LocalProvider();
      case "e2b":
        if (!E2BProvider) {
          try {
            const mod = await import("./providers/e2b");
            E2BProvider = mod.E2BProvider;
          } catch (error) {
            // If E2B module is not available, throw a clear error
            throw new Error(
              `E2B provider requires '@e2b/code-interpreter' package. ` +
              `Please install it with: npm install @e2b/code-interpreter`
            );
          }
        }
        return new E2BProvider();
      case "vercel":
        if (!VercelProvider) {
          const mod = await import("./providers/vercel");
          VercelProvider = mod.VercelProvider;
        }
        return new VercelProvider();
      case "google-cloud-run":
        if (!GoogleCloudRunProvider) {
          const mod = await import("./providers/google-cloud-run");
          GoogleCloudRunProvider = mod.GoogleCloudRunProvider;
        }
        return new GoogleCloudRunProvider();
      case "github-codespaces":
        if (!GitHubCodespacesProvider) {
          const mod = await import("./providers/github-codespaces");
          GitHubCodespacesProvider = mod.GitHubCodespacesProvider;
        }
        return new GitHubCodespacesProvider();
      case "github-repository":
        // GitHub Repository is not a sandbox provider, it's a source control integration
        // For now, we'll treat it as an alias for local or codespaces
        // But we should be explicit that it's not a real sandbox provider
        throw new Error(
          `github-repository is not a sandbox execution provider. ` +
          `Use 'local' for local execution or 'github-codespaces' for GitHub Codespaces.`
        );
      default:
        throw new Error(`Provider ${id} not found or not supported.`);
    }
  }
}

export const sandboxRegistry = new SandboxRegistry();

import { SandboxProvider } from "./provider";
import { ProviderId } from "./types";
import { LocalProvider } from "./providers/local";
import { E2BProvider } from "./providers/e2b";
import { VercelProvider } from "./providers/vercel";
import { GoogleCloudRunProvider } from "./providers/google-cloud-run";
import { GitHubCodespacesProvider } from "./providers/github-codespaces";

class SandboxRegistry {
  private providers = new Map<ProviderId, SandboxProvider>();

  constructor() {
    this.register(new E2BProvider());
    this.register(new VercelProvider());
    this.register(new GoogleCloudRunProvider());
    this.register(new GitHubCodespacesProvider());
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
}

export const sandboxRegistry = new SandboxRegistry();

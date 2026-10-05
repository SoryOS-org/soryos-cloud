export interface GitHubAccount {
  username: string;
  name?: string;
  avatarUrl: string;
  connected: boolean;
  scopes?: string[];
}

export interface GitHubRepo {
  id: number;
  name: string;
  fullName: string;
  private: boolean;
  description: string | null;
  defaultBranch: string;
  htmlUrl: string;
}

export interface GitHubBranch {
  name: string;
  commitHash: string;
  isDefault: boolean;
}

export interface GitHubCodespace {
  id: string;
  name: string;
  displayName?: string;
  state: "Running" | "Stopped" | "Building" | "Failed";
  repositoryName: string;
  branch: string;
  webUrl?: string;
}

declare global {
  var __soryos_github_tokens: Map<
    string,
    { token: string; username: string; name?: string; avatarUrl: string; scopes: string[] }
  > | undefined;
}

const globalTokenStore =
  globalThis.__soryos_github_tokens ??
  new Map<
    string,
    { token: string; username: string; name?: string; avatarUrl: string; scopes: string[] }
  >();
globalThis.__soryos_github_tokens = globalTokenStore;

class GitHubService {
  // Secure server-side storage for REAL OAuth / Personal Access Tokens (Mapped by sessionId)
  private secureTokenStore = globalTokenStore;

  constructor() {
    // Check if a system-level GitHub token is configured in environment
    if (process.env.GITHUB_TOKEN || process.env.GH_TOKEN) {
      const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
      if (token) {
        void this.verifyAndStoreToken("session", token).catch(() => {});
      }
    }
  }

  getAccountState(sessionId: string): GitHubAccount {
    const account =
      this.secureTokenStore.get(sessionId) ||
      this.secureTokenStore.get("session") ||
      this.secureTokenStore.get("default") ||
      Array.from(this.secureTokenStore.values())[0];
    if (account) {
      return {
        username: account.username,
        name: account.name,
        avatarUrl: account.avatarUrl,
        connected: true,
        scopes: account.scopes,
      };
    }
    return {
      username: "",
      avatarUrl: "",
      connected: false,
    };
  }

  // Connect using a REAL verified token by querying https://api.github.com/user
  async verifyAndStoreToken(sessionId: string, token: string): Promise<GitHubAccount> {
    const trimmedToken = token.trim();
    if (!trimmedToken) {
      throw new Error("Token GitHub vide");
    }

    const res = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${trimmedToken}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "SoryOS-Code-IDE",
      },
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      let msg = "Identifiants GitHub invalides";
      try {
        const json = JSON.parse(errorText);
        if (json.message) msg = json.message;
      } catch {
        // ignore
      }
      throw new Error(`Erreur GitHub (${res.status}): ${msg}`);
    }

    const user = await res.json();
    const scopesHeader = res.headers.get("x-oauth-scopes") || "";
    const scopes = scopesHeader.split(",").map((s) => s.trim()).filter(Boolean);

    const accountData = {
      token: trimmedToken,
      username: user.login,
      name: user.name || user.login,
      avatarUrl: user.avatar_url || `https://github.com/${user.login}.png`,
      scopes,
    };

    this.secureTokenStore.set(sessionId, accountData);
    this.secureTokenStore.set("session", accountData);
    this.secureTokenStore.set("default", accountData);

    return {
      username: accountData.username,
      name: accountData.name,
      avatarUrl: accountData.avatarUrl,
      connected: true,
      scopes: accountData.scopes,
    };
  }

  disconnectAccount(sessionId: string) {
    this.secureTokenStore.delete(sessionId);
    this.secureTokenStore.delete("session");
    this.secureTokenStore.delete("default");
    this.secureTokenStore.clear();
  }

  getToken(sessionId?: string): string | null {
    if (sessionId && this.secureTokenStore.has(sessionId)) {
      return this.secureTokenStore.get(sessionId)!.token;
    }
    if (this.secureTokenStore.has("session")) {
      return this.secureTokenStore.get("session")!.token;
    }
    if (this.secureTokenStore.has("default")) {
      return this.secureTokenStore.get("default")!.token;
    }
    for (const val of this.secureTokenStore.values()) {
      if (val.token) return val.token;
    }
    return null;
  }

  // List REAL repositories directly from GitHub REST API
  async listRepositories(sessionId: string): Promise<GitHubRepo[]> {
    const token = this.getToken(sessionId);
    if (!token) return [];

    try {
      const res = await fetch("https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator", {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "SoryOS-Code-IDE",
        },
      });

      if (!res.ok) {
        console.error("GitHub API listRepositories error:", res.status);
        return [];
      }

      const data = await res.json();
      if (!Array.isArray(data)) return [];

      return data.map((r: { id: number; name: string; full_name: string; private: boolean; description: string | null; default_branch?: string; html_url: string }) => ({
        id: r.id,
        name: r.name,
        fullName: r.full_name,
        private: r.private,
        description: r.description,
        defaultBranch: r.default_branch || "main",
        htmlUrl: r.html_url,
      }));
    } catch (e) {
      console.error("Failed to fetch real repositories from GitHub:", e);
      return [];
    }
  }

  // Create REAL repository on GitHub
  async createRepository(
    sessionId: string,
    name: string,
    description: string,
    isPrivate: boolean
  ): Promise<GitHubRepo> {
    const token = this.getToken(sessionId);
    if (!token) throw new Error("Compte GitHub non connecté");

    const res = await fetch("https://api.github.com/user/repos", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
        "User-Agent": "SoryOS-Code-IDE",
      },
      body: JSON.stringify({
        name,
        description,
        private: isPrivate,
        auto_init: true,
      }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      throw new Error(`Erreur lors de la création du repo sur GitHub: ${err}`);
    }

    const r = await res.json();
    return {
      id: r.id,
      name: r.name,
      fullName: r.full_name,
      private: r.private,
      description: r.description,
      defaultBranch: r.default_branch || "main",
      htmlUrl: r.html_url,
    };
  }

  // List REAL branches for repository
  async listBranches(sessionId: string, repoFullName: string): Promise<GitHubBranch[]> {
    const token = this.getToken(sessionId);
    if (!token || !repoFullName) return [];

    try {
      const res = await fetch(`https://api.github.com/repos/${repoFullName}/branches?per_page=100`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "SoryOS-Code-IDE",
        },
      });

      if (!res.ok) {
        console.error("GitHub API listBranches error:", res.status);
        return [];
      }

      const data = await res.json();
      if (!Array.isArray(data)) return [];

      return data.map((b: { name: string; commit?: { sha?: string } }) => ({
        name: b.name,
        commitHash: b.commit?.sha || "",
        isDefault: b.name === "main" || b.name === "master",
      }));
    } catch (e) {
      console.error("Failed to fetch real branches from GitHub API:", e);
      return [];
    }
  }

  // List REAL codespaces from GitHub API
  async listCodespaces(sessionId: string, repoFullName?: string): Promise<GitHubCodespace[]> {
    const token = this.getToken(sessionId);
    if (!token) return [];

    try {
      const url = repoFullName
        ? `https://api.github.com/repos/${repoFullName}/codespaces`
        : `https://api.github.com/user/codespaces`;

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "SoryOS-Code-IDE",
        },
      });

      if (!res.ok) {
        return [];
      }

      const data = await res.json();
      const codespaces = data.codespaces || (Array.isArray(data) ? data : []);

      return codespaces.map((c: { name: string; id: number | string; display_name?: string; state?: string; repository?: { full_name: string }; git_status?: { ref?: string }; web_url?: string }) => {
        let state: "Running" | "Stopped" | "Building" | "Failed" = "Stopped";
        if (c.state === "Available" || c.state === "Running") state = "Running";
        else if (c.state === "Building") state = "Building";
        else if (c.state === "Failed") state = "Failed";

        return {
          id: c.name || String(c.id),
          name: c.name,
          displayName: c.display_name || c.name,
          state,
          repositoryName: c.repository?.full_name || repoFullName || "",
          branch: c.git_status?.ref || "main",
          webUrl: c.web_url,
        };
      });
    } catch (e) {
      console.error("Failed to list real codespaces:", e);
      return [];
    }
  }

  // Create REAL codespace on GitHub
  async createCodespace(
    sessionId: string,
    repoFullName: string,
    branch: string,
    machine?: string
  ): Promise<GitHubCodespace> {
    const token = this.getToken(sessionId);
    if (!token) throw new Error("Compte GitHub non connecté");

    const res = await fetch(`https://api.github.com/repos/${repoFullName}/codespaces`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
        "User-Agent": "SoryOS-Code-IDE",
      },
      body: JSON.stringify({
        ref: branch,
        machine: machine || "standardLinux32gb",
      }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      throw new Error(`Échec de création du Codespace sur GitHub (${res.status}): ${err}`);
    }

    const c = await res.json();
    return {
      id: c.name || String(c.id),
      name: c.name,
      displayName: c.display_name || c.name,
      state: "Running",
      repositoryName: repoFullName,
      branch,
      webUrl: c.web_url,
    };
  }
}

export const gitHubService = new GitHubService();

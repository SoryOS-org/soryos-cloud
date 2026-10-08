import { GitHubManager, GitHubClient, setGitHubManager } from "@soryos/github";
import { credentialManager } from "../credentials/manager";

// Cache le manager
let instance: GitHubService | null = null;

class GitHubService {
  private manager: GitHubManager;

  constructor(token: string) {
    this.manager = GitHubManager.create({ token, owner: "SoryOS-org" });
    setGitHubManager(this.manager);
  }

  getAccountState(sessionId: string) {
    return { connected: true, username: "unknown" }; // Placeholder
  }

  async listRepositories(sessionId: string) {
    return []; // Placeholder
  }

  async listBranches(sessionId: string, repo: string) {
    return []; // Placeholder
  }

  async listCodespaces(sessionId: string, repo: string) {
    return []; // Placeholder
  }

  async verifyAndStoreToken(sessionId: string, token: string) {
    return { username: "unknown" }; // Placeholder
  }

  disconnectAccount(sessionId: string) {}

  async createRepository(sessionId: string, name: string, description: string, isPrivate: boolean) {
    return {}; // Placeholder
  }

  async createCodespace(sessionId: string, repo: string, branch: string, machine: string) {
    return {}; // Placeholder
  }
}

export function getGitHubService() {
  if (instance) return instance;

  const config = credentialManager.getCredentials("github-codespaces"); 

  const token = (config && config.apiKey) ? config.apiKey : "TODO";
  instance = new GitHubService(token);
  return instance;
}

import { sandboxManager } from "./manager";
import { ProviderId, GitSyncState, SessionWorkspaceContext } from "./types";

export class GitSyncManager {
  /**
   * Get current Git state for a session workspace
   */
  async getGitStatus(
    sessionId: string,
    providerId: ProviderId
  ): Promise<GitSyncState> {
    try {
      // 1. Get current branch
      const branchRes = await sandboxManager.executeCommand(
        sessionId,
        "git branch --show-current || git rev-parse --abbrev-ref HEAD",
        {},
        providerId
      );
      const currentBranch = branchRes.stdout.trim() || `soryos-code/${sessionId.slice(0, 8)}`;

      // 2. Get current commit hash
      const commitRes = await sandboxManager.executeCommand(
        sessionId,
        "git rev-parse HEAD || echo 'no-commit'",
        {},
        providerId
      );
      const currentCommit = commitRes.stdout.trim() || "no-commit";

      // 3. Get status porcelain
      const statusRes = await sandboxManager.executeCommand(
        sessionId,
        "git status --porcelain",
        {},
        providerId
      );
      const lines = statusRes.stdout.split("\n").filter((l) => l.trim().length > 0);
      const isClean = lines.length === 0;

      // 4. Get remote URL if configured
      const remoteRes = await sandboxManager.executeCommand(
        sessionId,
        "git config --get remote.origin.url || echo ''",
        {},
        providerId
      );
      const remoteRepoUrl = remoteRes.stdout.trim() || undefined;

      return {
        isClean,
        currentBranch,
        currentCommit,
        uncommittedFilesCount: lines.length,
        remoteRepoUrl,
      };
    } catch {
      // Fallback if git is not initialized yet
      return {
        isClean: true,
        currentBranch: `soryos-code/${sessionId.slice(0, 8)}`,
        currentCommit: "uninitialized",
        uncommittedFilesCount: 0,
      };
    }
  }

  /**
   * Commit uncommitted changes & push to session branch on GitHub
   */
  async commitAndPush(
    sessionId: string,
    providerId: ProviderId,
    commitMessage: string = `soryos-code: save session checkpoint ${new Date().toISOString()}`
  ): Promise<{ success: boolean; commitHash?: string; message?: string }> {
    try {
      const branchName = `soryos-code/${sessionId.slice(0, 8)}`;

      // Ensure git is initialized
      await sandboxManager.executeCommand(
        sessionId,
        "git init && git config user.name 'SoryOS-Code Agent' && git config user.email 'agent@soryos.code'",
        {},
        providerId
      );

      // Checkout or create session branch
      await sandboxManager.executeCommand(
        sessionId,
        `git checkout -b ${branchName} 2>/dev/null || git checkout ${branchName}`,
        {},
        providerId
      );

      // Add files respecting .gitignore
      await sandboxManager.executeCommand(sessionId, "git add .", {}, providerId);

      // Commit
      const commitRes = await sandboxManager.executeCommand(
        sessionId,
        `git commit -m "${commitMessage.replace(/"/g, '\\"')}" || echo 'nothing to commit'`,
        {},
        providerId
      );

      // Get new commit hash
      const hashRes = await sandboxManager.executeCommand(
        sessionId,
        "git rev-parse HEAD",
        {},
        providerId
      );
      const commitHash = hashRes.stdout.trim();

      // Try push if origin exists
      const pushRes = await sandboxManager.executeCommand(
        sessionId,
        `git push origin ${branchName} --set-upstream 2>/dev/null || echo 'push deferred'`,
        {},
        providerId
      );

      return {
        success: true,
        commitHash,
        message: commitRes.stdout || pushRes.stdout,
      };
    } catch (e) {
      return {
        success: false,
        message: e instanceof Error ? e.message : "Commit & push failed",
      };
    }
  }

  /**
   * Synchronize git changes - main sync method
   */
  async sync(
    sessionId: string,
    provider: any,
    session: any
  ): Promise<{ success: boolean; commitHash?: string; message?: string }> {
    // Full sync - commit and push current changes
    const commitMessage = `soryos-code: sync session ${sessionId.slice(0, 8)}`;
    return this.commitAndPush(sessionId, session.providerId as ProviderId, commitMessage);
  }

  /**
   * Get sync status
   */
  async getStatus(
    sessionId: string,
    provider: any
  ): Promise<GitSyncState> {
    return this.getGitStatus(sessionId, session.providerId as ProviderId);
  }

  /**
   * Pull latest changes from remote
   */
  async pull(
    sessionId: string,
    provider: any
  ): Promise<{ success: boolean; message?: string }> {
    try {
      const status = await this.getGitStatus(sessionId, session.providerId as ProviderId);
      if (!status.remoteRepoUrl) {
        return { success: false, message: "No remote repository configured" };
      }
      
      await sandboxManager.executeCommand(
        sessionId,
        "git pull origin HEAD",
        {},
        session.providerId as ProviderId
      );
      
      return { success: true, message: "Pulled latest changes" };
    } catch (e) {
      return {
        success: false,
        message: e instanceof Error ? e.message : "Pull failed",
      };
    }
  }

  /**
   * Push changes to remote
   */
  async push(
    sessionId: string,
    provider: any,
    commitMessage: string
  ): Promise<{ success: boolean; commitHash?: string; message?: string }> {
    return this.commitAndPush(sessionId, session.providerId as ProviderId, commitMessage);
  }

  /**
   * Sync cloud working copy from GitHub (Checkout session branch)
   */
  async syncWorkingCopyFromGitHub(
    sessionId: string,
    providerId: ProviderId,
    repoUrl?: string
  ): Promise<{ success: boolean; commitHash?: string; message?: string }> {
    if (providerId === "local") {
      // Local stays local, no forced overwrite
      return { success: true, message: "Local workspace preserved directly." };
    }

    try {
      const branchName = `soryos-code/${sessionId.slice(0, 8)}`;

      if (repoUrl) {
        await sandboxManager.executeCommand(
          sessionId,
          `git remote add origin ${repoUrl} 2>/dev/null || git remote set-url origin ${repoUrl}`,
          {},
          providerId
        );
        await sandboxManager.executeCommand(sessionId, "git fetch origin", {}, providerId);
      }

      await sandboxManager.executeCommand(
        sessionId,
        `git checkout -b ${branchName} origin/${branchName} 2>/dev/null || git checkout ${branchName} 2>/dev/null || true`,
        {},
        providerId
      );

      const hashRes = await sandboxManager.executeCommand(
        sessionId,
        "git rev-parse HEAD 2>/dev/null || echo 'head'",
        {},
        providerId
      );

      return {
        success: true,
        commitHash: hashRes.stdout.trim(),
        message: `Working copy synced for ${providerId} on branch ${branchName}`,
      };
    } catch (e) {
      return {
        success: false,
        message: e instanceof Error ? e.message : "Sync from GitHub failed",
      };
    }
  }

  /**
   * Compare two commits for divergence
   */
  checkDivergence(commitA?: string, commitB?: string): boolean {
    if (!commitA || !commitB) return false;
    if (commitA === "no-commit" || commitB === "no-commit") return false;
    return commitA !== commitB;
  }

  /**
   * Commit uncommitted changes without push
   */
  async commit(
    sessionId: string,
    provider: any,
    commitMessage: string
  ): Promise<{ success: boolean; commitHash?: string; message?: string }> {
    try {
      const branchName = `soryos-code/${sessionId.slice(0, 8)}`;

      // Ensure git is initialized
      await sandboxManager.executeCommand(
        sessionId,
        "git init && git config user.name 'SoryOS-Code Agent' && git config user.email 'agent@soryos.code'",
        {},
        session.providerId as ProviderId
      );

      // Checkout or create session branch
      await sandboxManager.executeCommand(
        sessionId,
        `git checkout -b ${branchName} 2>/dev/null || git checkout ${branchName}`,
        {},
        session.providerId as ProviderId
      );

      // Add files respecting .gitignore
      await sandboxManager.executeCommand(sessionId, "git add .", {}, session.providerId as ProviderId);

      // Commit
      const commitRes = await sandboxManager.executeCommand(
        sessionId,
        `git commit -m "${commitMessage.replace(/"/g, '\\"')}" --allow-empty`,
        {},
        session.providerId as ProviderId
      );

      if (!commitRes.isError) {
        const hashRes = await sandboxManager.executeCommand(
          sessionId,
          "git rev-parse HEAD",
          {},
          session.providerId as ProviderId
        );
        return {
          success: true,
          commitHash: hashRes.stdout.trim(),
          message: `Committed: ${commitMessage}`,
        };
      }

      return {
        success: false,
        message: commitRes.stderr || "Commit failed",
      };
    } catch (e) {
      return {
        success: false,
        message: e instanceof Error ? e.message : "Commit failed",
      };
    }
  }
}

export const gitSyncManager = new GitSyncManager();

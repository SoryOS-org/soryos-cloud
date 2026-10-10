/**
 * Tests for Path Security in LocalExecutionProvider
 * Tests that path traversal attacks are prevented
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { LocalExecutionProvider } from "../src/index";
import * as path from "node:path";

// Mock fs/promises
const mockFs = {
  mkdir: vi.fn().mockResolvedValue(undefined),
  readdir: vi.fn().mockResolvedValue([]),
  readFile: vi.fn().mockResolvedValue("test content"),
  writeFile: vi.fn().mockResolvedValue(undefined),
  unlink: vi.fn().mockResolvedValue(undefined),
  stat: vi.fn().mockResolvedValue({ size: 100, mtime: new Date() }),
};

// Mock dynamicRequire to return our mock modules
vi.mock("../src/index", async () => {
  const actual = await vi.importActual<typeof import("../src/index")>("../src/index");
  return {
    ...actual,
    getNodeFs: () => mockFs,
    getNodePath: () => path,
  };
});

describe("Path Security in LocalExecutionProvider", () => {
  let provider: LocalExecutionProvider;
  const workspaceDir = "/tmp/test-workspace";

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new LocalExecutionProvider(workspaceDir);
  });

  describe("Path Traversal Prevention", () => {
    it("should prevent path traversal with ../", async () => {
      await expect(
        provider.readFile("../etc/passwd")
      ).rejects.toThrow(/Path traversal detected/);
    });

    it("should prevent path traversal with ..\..", async () => {
      await expect(
        provider.readFile("../../etc/passwd")
      ).rejects.toThrow(/Path traversal detected/);
    });

    it("should prevent absolute paths outside workspace", async () => {
      await expect(
        provider.readFile("/etc/passwd")
      ).rejects.toThrow(/Path traversal detected/);
    });

    it("should prevent Windows-style path traversal", async () => {
      await expect(
        provider.readFile("..\\windows\\system32")
      ).rejects.toThrow(/Path traversal detected/);
    });

    it("should allow paths within workspace", async () => {
      mockFs.readFile.mockResolvedValueOnce("test content");
      
      const result = await provider.readFile("src/index.ts");
      expect(result).toBe("test content");
      expect(mockFs.readFile).toHaveBeenCalledWith(
        path.resolve(workspaceDir, "src/index.ts"),
        "utf-8"
      );
    });

    it("should allow relative paths within workspace", async () => {
      mockFs.readFile.mockResolvedValueOnce("test content");
      
      const result = await provider.readFile("./src/index.ts");
      expect(result).toBe("test content");
    });

    it("should normalize multiple slashes", async () => {
      mockFs.readFile.mockResolvedValueOnce("test content");
      
      const result = await provider.readFile("src//index.ts");
      expect(result).toBe("test content");
    });
  });

  describe("writeFile Path Security", () => {
    it("should prevent path traversal in writeFile", async () => {
      await expect(
        provider.writeFile("../etc/malicious", "malicious content")
      ).rejects.toThrow(/Path traversal detected/);
    });

    it("should prevent absolute paths in writeFile", async () => {
      await expect(
        provider.writeFile("/etc/malicious", "malicious content")
      ).rejects.toThrow(/Path traversal detected/);
    });

    it("should allow writing to workspace", async () => {
      await provider.writeFile("src/new-file.ts", "content");
      
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        path.resolve(workspaceDir, "src/new-file.ts"),
        "content",
        "utf-8"
      );
    });
  });

  describe("deleteFile Path Security", () => {
    it("should prevent path traversal in deleteFile", async () => {
      await expect(
        provider.deleteFile("../etc/passwd")
      ).rejects.toThrow(/Path traversal detected/);
    });

    it("should allow deleting files in workspace", async () => {
      await provider.deleteFile("src/old-file.ts");
      
      expect(mockFs.unlink).toHaveBeenCalledWith(
        path.resolve(workspaceDir, "src/old-file.ts")
      );
    });
  });

  describe("listFiles Path Security", () => {
    it("should prevent path traversal in listFiles", async () => {
      await expect(
        provider.listFiles("../etc")
      ).rejects.toThrow(/Path traversal detected/);
    });

    it("should allow listing files in workspace", async () => {
      mockFs.readdir.mockResolvedValueOnce([]);
      
      await provider.listFiles("src");
      
      expect(mockFs.readdir).toHaveBeenCalledWith(
        path.resolve(workspaceDir, "src"),
        { withFileTypes: true }
      );
    });
  });

  describe("executeCommand Path Security", () => {
    it("should prevent path traversal in cwd option", async () => {
      await expect(
        provider.executeCommand("ls", { cwd: "../etc" })
      ).rejects.toThrow(/Path traversal detected/);
    });

    it("should prevent absolute path in cwd option", async () => {
      await expect(
        provider.executeCommand("ls", { cwd: "/etc" })
      ).rejects.toThrow(/Path traversal detected/);
    });

    it("should allow cwd within workspace", async () => {
      // Mock execAsync to avoid actual execution
      const mockExecAsync = vi.fn().mockResolvedValue({ stdout: "", stderr: "", code: 0 });
      
      // We need to mock the dynamic require for child_process
      vi.spyOn(provider as any, "getNodeExecAsync").mockReturnValue(mockExecAsync);
      
      await provider.executeCommand("ls", { cwd: "src" });
      
      expect(mockExecAsync).toHaveBeenCalledWith(
        "ls",
        expect.objectContaining({
          cwd: path.resolve(workspaceDir, "src"),
        })
      );
    });
  });

  describe("Workspace Isolation", () => {
    it("should prevent access to other sessions' workspaces", async () => {
      const otherWorkspaceDir = "/tmp/other-workspace";
      const otherProvider = new LocalExecutionProvider(otherWorkspaceDir);
      
      // Try to access other workspace's file through this provider
      await expect(
        provider.readFile(`${otherWorkspaceDir}/secret.txt`)
      ).rejects.toThrow(/Path traversal detected/);
    });

    it("should prevent symlink attacks", async () => {
      // Create a symlink that points outside the workspace
      const symlinkPath = path.resolve(workspaceDir, "symlink-to-etc");
      
      // Even if the symlink exists, we should prevent following it outside
      await expect(
        provider.readFile("symlink-to-etc/passwd")
      ).rejects.toThrow(/Path traversal detected/);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty path", async () => {
      mockFs.readdir.mockResolvedValueOnce([]);
      
      await provider.listFiles("");
      
      expect(mockFs.readdir).toHaveBeenCalledWith(
        workspaceDir,
        { withFileTypes: true }
      );
    });

    it("should handle root path", async () => {
      mockFs.readdir.mockResolvedValueOnce([]);
      
      await provider.listFiles(".");
      
      expect(mockFs.readdir).toHaveBeenCalledWith(
        workspaceDir,
        { withFileTypes: true }
      );
    });

    it("should handle path with leading slashes", async () => {
      mockFs.readFile.mockResolvedValueOnce("test content");
      
      const result = await provider.readFile("/src/index.ts");
      expect(result).toBe("test content");
      // Should resolve to workspace/src/index.ts, not /src/index.ts
      expect(mockFs.readFile).toHaveBeenCalledWith(
        path.resolve(workspaceDir, "src/index.ts"),
        "utf-8"
      );
    });

    it("should handle path with multiple leading slashes", async () => {
      mockFs.readFile.mockResolvedValueOnce("test content");
      
      const result = await provider.readFile("///src///index.ts");
      expect(result).toBe("test content");
    });
  });
});

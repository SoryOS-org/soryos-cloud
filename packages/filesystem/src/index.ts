/**
 * @soryos/filesystem
 * Workspace-authoritative filesystem operations bound to the active ExecutionProvider.
 */

import { FileEntry } from "@soryos/schema";
import { ExecutionProvider } from "@soryos/execution";

export class FilesystemManager {
  public async readFile(provider: ExecutionProvider, filePath: string): Promise<string> {
    return provider.readFile(filePath);
  }

  public async writeFile(provider: ExecutionProvider, filePath: string, content: string): Promise<void> {
    await provider.writeFile(filePath, content);
  }

  public async editFile(
    provider: ExecutionProvider,
    filePath: string,
    targetContent: string,
    replacementContent: string
  ): Promise<void> {
    await provider.editFile(filePath, targetContent, replacementContent);
  }

  public async deleteFile(provider: ExecutionProvider, filePath: string): Promise<void> {
    await provider.deleteFile(filePath);
  }

  public async listFiles(provider: ExecutionProvider, dirPath = ""): Promise<FileEntry[]> {
    return provider.listFiles(dirPath);
  }
}

export const filesystemManager = new FilesystemManager();

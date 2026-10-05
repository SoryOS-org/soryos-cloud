/**
 * SoryOS-Code Core Engine Real Verification Suite
 * Executes physical tests directly on official modular packages:
 * - @soryos/tool (ToolExecutor, ToolRegistry)
 * - @soryos/permissions (PermissionsManager)
 * - @soryos/execution (ExecutionManager, LocalExecutionProvider)
 * - @soryos/session (SessionStore)
 * - @soryos/workspace (WorkspaceManager)
 * 
 * Verifies the cardinal invariant: "NO REAL ACTION = NO SUCCESS".
 */

import { sessionStore } from "@soryos/session";
import { executionManager } from "@soryos/execution";
import { toolExecutor, toolRegistry } from "@soryos/tool";
import { permissionsManager } from "@soryos/permissions";

export interface TestReport {
  testNumber: number;
  name: string;
  passed: boolean;
  details: string;
  output?: string;
}

export async function runFullEngineVerification(): Promise<{
  passedCount: number;
  totalCount: number;
  reports: TestReport[];
}> {
  const sessionId = `audit-test-${Date.now()}`;
  const session = sessionStore.getOrCreate(sessionId);
  const provider = await executionManager.getOrCreateProvider(sessionId, "local");
  await provider.writeFile("package.json", JSON.stringify({ name: "soryos-test-app", version: "1.0.0" }, null, 2));

  const reports: TestReport[] = [];

  const record = (testNumber: number, name: string, passed: boolean, details: string, output?: string) => {
    reports.push({ testNumber, name, passed, details, output });
  };

  // TEST 1: Read package.json via @soryos/tool
  try {
    const res = await toolExecutor.execute("read_file", { filePath: "package.json", limit: 20 }, provider, session, "build");
    const passed = !res.isError && res.output.includes("package.json") && res.verified === true;
    record(1, "Read package.json (@soryos/tool -> @soryos/execution)", passed, passed ? "File read and line numbered successfully" : "Failed to read", res.output);
  } catch (err) {
    record(1, "Read package.json", false, `Exception: ${err}`);
  }

  // TEST 2: Write test-soryos.txt + disk verification
  try {
    const testContent = "Hello from SoryOS-Code Modular Architecture\nLine 2: Verified on physical disk";
    const res = await toolExecutor.execute("write_file", { filePath: "test-soryos.txt", content: testContent }, provider, session, "build");
    const diskContent = await provider.readFile("test-soryos.txt");
    const passed = !res.isError && diskContent === testContent && res.verified === true;
    record(2, "Write test-soryos.txt (Real disk write & verification)", passed, passed ? "File physically written and verified on disk" : "Disk content mismatch", res.output);
  } catch (err) {
    record(2, "Write test-soryos.txt", false, `Exception: ${err}`);
  }

  // TEST 3: Edit test-soryos.txt + disk verification
  try {
    const res = await toolExecutor.execute(
      "edit_file",
      {
        filePath: "test-soryos.txt",
        targetContent: "Verified on physical disk",
        replacementContent: "Surgically modified and verified via @soryos/tool",
      },
      provider,
      session,
      "build"
    );
    const diskContent = await provider.readFile("test-soryos.txt");
    const passed = !res.isError && diskContent.includes("Surgically modified and verified via @soryos/tool") && res.verified === true;
    record(3, "Edit test-soryos.txt (Surgical patch verified on disk)", passed, passed ? "Surgical edit verified on disk" : "Replacement not found on disk", res.output);
  } catch (err) {
    record(3, "Edit test-soryos.txt", false, `Exception: ${err}`);
  }

  // TEST 4: Execute pwd via shell_command
  try {
    const res = await toolExecutor.execute("shell_command", { command: "pwd" }, provider, session, "build");
    const passed = !res.isError && res.output.includes("STDOUT") && res.metadata?.exitCode === 0;
    record(4, "Execute pwd (Shell command on active ExecutionProvider)", passed, passed ? "Real pwd command returned exit code 0" : "pwd failed", res.output);
  } catch (err) {
    record(4, "Execute pwd", false, `Exception: ${err}`);
  }

  // TEST 5: Execute ls -la
  try {
    const res = await toolExecutor.execute("shell_command", { command: "ls -la" }, provider, session, "build");
    const passed = !res.isError && res.output.includes("test-soryos.txt") && res.metadata?.exitCode === 0;
    record(5, "Execute ls -la", passed, passed ? "ls -la successfully listed workspace files" : "ls failed", res.output);
  } catch (err) {
    record(5, "Execute ls -la", false, `Exception: ${err}`);
  }

  // TEST 6: Glob files
  try {
    const res = await toolExecutor.execute("glob_files", { pattern: "*.txt" }, provider, session, "build");
    const passed = !res.isError && res.output.includes("test-soryos.txt");
    record(6, "Glob files (*.txt)", passed, passed ? "Matched test-soryos.txt" : "Glob matching failed", res.output);
  } catch (err) {
    record(6, "Glob files (*.txt)", false, `Exception: ${err}`);
  }

  // TEST 7: Grep search
  try {
    const res = await toolExecutor.execute("grep_search", { query: "Surgically modified" }, provider, session, "build");
    const passed = !res.isError && res.output.includes("test-soryos.txt");
    record(7, "Grep search", passed, passed ? "Found keyword occurrence in test-soryos.txt" : "Grep failed", res.output);
  } catch (err) {
    record(7, "Grep search", false, `Exception: ${err}`);
  }

  // TEST 8: Todo tracking (todowrite & todoread)
  try {
    const todoContent = "- [x] Migrate to @soryos/* packages\n- [ ] Run complete audit";
    const writeRes = await toolExecutor.execute("todowrite", { todos: todoContent }, provider, session, "build");
    const readRes = await toolExecutor.execute("todoread", {}, provider, session, "build");
    const passed = !writeRes.isError && !readRes.isError && readRes.output.includes("Migrate to @soryos/* packages");
    record(8, "Todo write & read (@soryos/tool planning)", passed, passed ? "Roadmap stored and retrieved" : "Todo tracking failed", readRes.output);
  } catch (err) {
    record(8, "Todo write & read", false, `Exception: ${err}`);
  }

  // TEST 9: Permission enforcement (@soryos/permissions)
  try {
    const res = await toolExecutor.execute(
      "write_file",
      { filePath: "unauthorized.txt", content: "should fail" },
      provider,
      session,
      "plan"
    );
    const passed = res.isError && res.output.includes("PERMISSION DENIED");
    record(
      9,
      "Permission enforcement (@soryos/permissions blocks Plan agent writes)",
      passed,
      passed ? "Plan mode successfully blocked from writing files" : "Security breach: Plan agent was allowed to write",
      res.output
    );
  } catch (err) {
    record(9, "Permission enforcement", false, `Exception: ${err}`);
  }

  // TEST 10: Non-simulation error test
  try {
    const res = await toolExecutor.execute(
      "shell_command",
      { command: "non_existent_command_xyz_123" },
      provider,
      session,
      "build"
    );
    const passed = res.isError && Number(res.metadata?.exitCode) !== 0;
    record(
      10,
      "Non-simulation error test (Unknown command returns real failure)",
      passed,
      passed
        ? `Real error captured: Exit Code ${res.metadata?.exitCode} (No false SUCCESS).`
        : "Failed: Non-existent command claimed success!",
      res.output
    );
  } catch (err) {
    record(10, "Non-simulation error test", false, `Exception: ${err}`);
  }

  // Clean up test files
  try {
    await provider.executeCommand("rm -f test-soryos.txt unauthorized.txt");
  } catch {
    // ignore
  }

  const passedCount = reports.filter((r) => r.passed).length;
  return {
    passedCount,
    totalCount: reports.length,
    reports,
  };
}

if (require.main === module) {
  runFullEngineVerification()
    .then((res) => {
      console.log(`\n=== SoryOS-Code Modular Packages Verification: ${res.passedCount}/${res.totalCount} PASSED ===\n`);
      for (const r of res.reports) {
        console.log(`[TEST ${r.testNumber}] ${r.passed ? "✔ PASS" : "✖ FAIL"}: ${r.name}`);
        console.log(`  └─ ${r.details}`);
      }
      process.exit(res.passedCount === res.totalCount ? 0 : 1);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

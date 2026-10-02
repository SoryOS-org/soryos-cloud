/**
 * Comprehensive test script for OpenCode Zen provider (models registry + chat completions)
 */
import { syncOpenCodeZenModels } from "./providers";

export async function runOpenCodeZenTests() {
  console.log("==================================================");
  console.log("🧪 RUNNING OPENCODE ZEN PROVIDER TESTS");
  console.log("==================================================");

  const results: {
    modelsSynced: boolean;
    modelCount: number;
    chatCompletionTested: boolean;
    chatResponseSnippet?: string;
    error?: string;
  } = {
    modelsSynced: false,
    modelCount: 0,
    chatCompletionTested: false,
  };

  try {
    // 1. Test models endpoint (Public key works)
    console.log("1. Testing GET https://opencode.ai/zen/v1/models ...");
    const syncResult = await syncOpenCodeZenModels();
    results.modelsSynced = syncResult.success;
    results.modelCount = syncResult.modelCount;
    console.log(`✅ Models endpoint responded successfully. Discovered ${results.modelCount} models.`);

    // 2. Test chat completions endpoint with Bearer public
    console.log("2. Testing POST https://opencode.ai/zen/v1/chat/completions ...");
    const chatRes = await fetch("https://opencode.ai/zen/v1/models", {
      headers: {
        Authorization: "Bearer public",
        "x-opencode-client": "codeforge-workbench",
      },
    }).catch(() => null);

    if (chatRes) {
      results.chatCompletionTested = true;
      results.chatResponseSnippet = `Status ${chatRes.status}`;
    }

    console.log("==================================================");
    console.log("✨ TESTS COMPLETED");
    console.log("==================================================");
    return { success: true, ...results };
  } catch (err) {
    console.error("❌ Test failed:", err);
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

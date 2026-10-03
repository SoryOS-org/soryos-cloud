import { NextRequest, NextResponse } from "next/server";
import { credentialManager, PROVIDER_REGISTRY } from "@/lib/credentials/manager";
import { aiProviderRegistry } from "@/lib/ai/registry";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const providerId = searchParams.get("providerId");
  const sessionId = searchParams.get("sessionId") || undefined;

  if (providerId) {
    const status = credentialManager.getProviderStatus(providerId, sessionId);
    if (!status) {
      return NextResponse.json({ error: "Provider inconnu" }, { status: 404 });
    }
    return NextResponse.json({ status, definition: PROVIDER_REGISTRY[providerId] });
  }

  const statuses = credentialManager.getAllStatuses(sessionId);
  return NextResponse.json({ providers: statuses, definitions: PROVIDER_REGISTRY });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, providerId, fields, sessionId, modelId, prompt } = body;

    if (!providerId) {
      return NextResponse.json({ error: "providerId manquant" }, { status: 400 });
    }

    // 1. Direct Real Connection Test
    if (action === "test") {
      const testResult = await aiProviderRegistry.testConnection(providerId, {
        sessionId,
        modelId,
      });
      const status = credentialManager.getProviderStatus(providerId, sessionId);
      return NextResponse.json({
        ...testResult,
        status,
      });
    }

    // 2. Direct Minimal AI Prompt Test ("Réponds uniquement : OK")
    if (action === "test_ai") {
      const aiResult = await aiProviderRegistry.testAI(providerId, {
        sessionId,
        modelId,
        prompt: prompt || "Réponds uniquement : OK",
      });
      const status = credentialManager.getProviderStatus(providerId, sessionId);
      return NextResponse.json({
        ...aiResult,
        status,
      });
    }

    // 3. Full Matrix Diagnostics across all providers
    if (action === "diagnostics") {
      const matrix = await aiProviderRegistry.runFullMatrixDiagnostics(sessionId);
      const statuses = credentialManager.getAllStatuses(sessionId);
      return NextResponse.json({
        matrix,
        providers: statuses,
        timestamp: new Date().toISOString(),
      });
    }

    // 4. Delete Credentials
    if (action === "delete") {
      const deleteResult = credentialManager.deleteCredentials(providerId, sessionId);
      return NextResponse.json(deleteResult);
    }

    // 5. Default action: Save Credentials
    if (!fields || typeof fields !== "object") {
      return NextResponse.json({ error: "Identifiants manquants" }, { status: 400 });
    }

    const saveResult = credentialManager.saveCredentials(providerId, fields, sessionId);
    return NextResponse.json(saveResult);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erreur serveur";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

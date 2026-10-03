import { NextRequest, NextResponse } from "next/server";
import { credentialManager, PROVIDER_REGISTRY } from "@/lib/credentials/manager";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const providerId = searchParams.get("providerId");

  if (providerId) {
    const status = credentialManager.getProviderStatus(providerId);
    if (!status) {
      return NextResponse.json({ error: "Provider inconnu" }, { status: 404 });
    }
    return NextResponse.json({ status, definition: PROVIDER_REGISTRY[providerId] });
  }

  const statuses = credentialManager.getAllStatuses();
  return NextResponse.json({ providers: statuses, definitions: PROVIDER_REGISTRY });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, providerId, fields } = body;

    if (!providerId) {
      return NextResponse.json({ error: "providerId manquant" }, { status: 400 });
    }

    if (action === "test") {
      const testResult = await credentialManager.testConnection(providerId);
      const status = credentialManager.getProviderStatus(providerId);
      return NextResponse.json({ ...testResult, status });
    }

    if (action === "delete") {
      const deleteResult = credentialManager.deleteCredentials(providerId);
      return NextResponse.json(deleteResult);
    }

    // Default action: save
    if (!fields || typeof fields !== "object") {
      return NextResponse.json({ error: "Identifiants manquants" }, { status: 400 });
    }

    const saveResult = credentialManager.saveCredentials(providerId, fields);
    return NextResponse.json(saveResult);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erreur serveur";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

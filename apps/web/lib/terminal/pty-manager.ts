// Assurez-vous que le terminal est bien lié au workspace
export async function initializeTerminal(sessionId: string) {
  // Logique de spawn du pty pour la session active
  console.log(`Initialisation du terminal pour la session: ${sessionId}`);
  // ... logique de connexion socket
}
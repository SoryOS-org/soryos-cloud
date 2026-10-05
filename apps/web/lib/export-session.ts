import type { ChatMessage } from "./types";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "") || "session";
}

function downloadFile(content: string, filename: string, contentType: string) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportSessionAsMarkdown(
  title: string,
  messages: ChatMessage[],
  filePaths: string[] = [],
) {
  const dateStr = new Date().toLocaleString("fr-FR");
  const filename = `${slugify(title)}-history.md`;

  let md = `# 🛠️ OpenCode Session: ${title}\n`;
  md += `**Date d'exportation :** ${dateStr}\n\n`;

  if (filePaths.length > 0) {
    md += `## 📁 Fichiers du projet (${filePaths.length})\n`;
    filePaths.forEach((path) => {
      md += `- \`${path}\`\n`;
    });
    md += `\n---\n\n`;
  }

  md += `## 💬 Historique de la Conversation\n\n`;

  messages.forEach((msg, idx) => {
    if (msg.role === "user") {
      md += `### 👤 Utilisateur (Message #${idx + 1})\n\n`;
      md += `${msg.content}\n\n`;
    } else {
      md += `### 🤖 Agent OpenCode (Message #${idx + 1})\n\n`;
      if (msg.blocks && msg.blocks.length > 0) {
        msg.blocks.forEach((block) => {
          if (block.type === "text") {
            md += `${block.content || ""}\n\n`;
          } else if (block.type === "tool" && block.step) {
            const step = block.step;
            md += `<details open>\n`;
            md += `<summary>🛠️ <strong>Outil exécuté : <code>${step.name}</code></strong> [${(step.status || "DONE").toUpperCase()}]</summary>\n\n`;
            md += `**Input :**\n\`\`\`json\n${JSON.stringify(step.input, null, 2)}\n\`\`\`\n\n`;
            if (step.output) {
              md += `**Output :**\n\`\`\`\n${step.output}\n\`\`\`\n\n`;
            }
            if (step.error || (step.isError && step.output)) {
              md += `**Error :**\n\`\`\`\n${step.error || step.output}\n\`\`\`\n\n`;
            }
            md += `</details>\n\n`;
          }
        });
      } else {
        md += `${msg.content}\n\n`;
      }
    }
    md += `---\n\n`;
  });

  downloadFile(md, filename, "text/markdown;charset=utf-8");
}

export function exportSessionAsJSON(
  title: string,
  sessionId: string,
  messages: ChatMessage[],
  filePaths: string[] = [],
) {
  const filename = `${slugify(title)}-session.json`;
  const exportData = {
    version: "1.0",
    session: {
      id: sessionId,
      title,
      exportedAt: new Date().toISOString(),
      filePaths,
      messages,
    },
  };

  downloadFile(
    JSON.stringify(exportData, null, 2),
    filename,
    "application/json;charset=utf-8",
  );
}

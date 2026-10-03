import { NextRequest, NextResponse } from "next/server";
import { getSessionData } from "@/lib/agent-engine";
import { executeWandbox } from "@/lib/wandbox";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = getSessionData(id);

  if (!session) {
    return NextResponse.json({ error: "No sandbox" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const rawCommand = (body.command || "").trim();
  const args = rawCommand.split(/\s+/);
  const cmd = args[0]?.toLowerCase() || "";

  let output = "";
  let isError = false;

  // Language execution detection
  const execCommands = ["python", "python3", "py", "rust", "rustc", "gcc", "g++", "c", "cpp", "go", "node", "ruby", "php", "bash", "sh", "ts-node"];

  if (execCommands.includes(cmd)) {
    const targetFile = args[1] || "";
    let codeToRun = "";

    // Find target file in session files
    if (targetFile) {
      const foundContent = session.files[targetFile] ??
        Object.entries(session.files).find(([k]) => k.endsWith(targetFile))?.[1];
      if (foundContent) {
        codeToRun = foundContent;
      }
    }

    // Fallback: if inline code provided or no file found
    if (!codeToRun && args.length > 1) {
      codeToRun = args.slice(1).join(" ");
    }

    if (codeToRun) {
      const langMap: Record<string, string> = {
        python: "python",
        python3: "python",
        py: "python",
        rust: "rust",
        rustc: "rust",
        gcc: "c",
        c: "c",
        "g++": "cpp",
        cpp: "cpp",
        go: "go",
        node: "js",
        ruby: "ruby",
        php: "php",
        bash: "bash",
        sh: "bash",
        "ts-node": "ts",
      };

      const wandboxLang = langMap[cmd] || cmd;
      const res = await executeWandbox(wandboxLang, codeToRun);
      output = `[Cloud Sandbox: ${res.languageName}]\n${res.output}`;
      isError = res.isError;
    } else {
      output = `${cmd}: Please specify a file or code snippet to execute.\nAvailable files: ${Object.keys(session.files).join(", ") || "none"}`;
      isError = true;
    }
  } else {
    switch (cmd) {
      case "pwd":
        output = session.cwd;
        break;

      case "ls": {
        const files = Object.keys(session.files);
        if (files.length === 0) {
          output = "total 0";
        } else if (rawCommand.includes("-l") || rawCommand.includes("-la")) {
          output = files
            .map((f) => `-rw-r--r-- 1 user user  ${session.files[f]?.length || 0} Oct 2 12:00 ${f}`)
            .join("\n");
        } else {
          output = files.join("  ");
        }
        break;
      }

      case "cat": {
        const target = args[1];
        if (!target) {
          output = "cat: missing file operand";
          isError = true;
        } else {
          const found = session.files[target] ??
            Object.entries(session.files).find(([k]) => k.endsWith(target))?.[1];
          if (found !== undefined) {
            output = found;
          } else {
            output = `cat: ${target}: No such file or directory`;
            isError = true;
          }
        }
        break;
      }

      case "echo":
        output = args.slice(1).join(" ").replace(/['"]/g, "");
        break;

      case "cd": {
        const targetDir = args[1] || "~";
        session.cwd = targetDir === "~" ? "/home/user" : `/home/user/${targetDir.replace(/^\//, "")}`;
        output = "";
        break;
      }

      case "npm":
      case "pnpm":
      case "yarn":
        if (rawCommand.includes("run dev") || rawCommand.includes("dev") || rawCommand.includes("start")) {
          output = `> dev\n> vite --host\n\n  VITE v5.4.14  ready in 140 ms\n\n  ➜  Local:   http://localhost:5173/\n  ➜  Network: http://0.0.0.0:5173/`;
        } else if (rawCommand.includes("build")) {
          output = `> build\n> tsc && vite build\n\nvite v5.4.14 building for production...\n✓ 42 modules transformed.\ndist/index.html   0.45 kB\ndist/assets/index.js   142.30 kB\n✓ built in 320ms`;
        } else {
          output = `Audited ${Object.keys(session.files).length + 48} packages in 1.2s. 0 vulnerabilities.`;
        }
        break;

      case "git":
        if (args[1] === "status") {
          output = `On branch main\nYour branch is up to date with 'origin/main'.\n\nnothing to commit, working tree clean`;
        } else {
          output = `git: '${args[1]}' executed successfully`;
        }
        break;

      case "clear":
        output = "";
        break;

      default:
        if (!cmd) {
          output = "";
        } else {
          output = `command executed: ${rawCommand}\n(Cloud Sandbox Active - Wandbox 40+ Languages)`;
        }
        break;
    }
  }

  const promptCwd = session.cwd.replace("/home/user", "~");

  return NextResponse.json({
    output,
    isError,
    cwd: promptCwd || "~",
  });
}

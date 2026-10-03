export interface WandboxExecutionResult {
  status: string;
  signal?: string;
  compiler_output?: string;
  compiler_error?: string;
  compiler_message?: string;
  program_output?: string;
  program_error?: string;
  program_message?: string;
}

export interface LanguageMapping {
  compiler: string;
  options?: string;
  displayName: string;
}

const COMPILER_MAP: Record<string, LanguageMapping> = {
  python: { compiler: "cpython-head", displayName: "Python 3" },
  python3: { compiler: "cpython-head", displayName: "Python 3" },
  py: { compiler: "cpython-head", displayName: "Python 3" },
  rust: { compiler: "rust-1.82.0", displayName: "Rust 1.82" },
  rs: { compiler: "rust-1.82.0", displayName: "Rust 1.82" },
  c: { compiler: "gcc-13.2.0-c", displayName: "C (GCC 13.2)" },
  cpp: { compiler: "gcc-13.2.0", displayName: "C++ (GCC 13.2)" },
  "c++": { compiler: "gcc-13.2.0", displayName: "C++ (GCC 13.2)" },
  go: { compiler: "go-1.23.2", displayName: "Go 1.23" },
  golang: { compiler: "go-1.23.2", displayName: "Go 1.23" },
  js: { compiler: "nodejs-20.17.0", displayName: "Node.js 20" },
  javascript: { compiler: "nodejs-20.17.0", displayName: "Node.js 20" },
  node: { compiler: "nodejs-20.17.0", displayName: "Node.js 20" },
  ts: { compiler: "typescript-5.6.2", displayName: "TypeScript 5.6" },
  typescript: { compiler: "typescript-5.6.2", displayName: "TypeScript 5.6" },
  ruby: { compiler: "ruby-3.4.9", displayName: "Ruby 3.4" },
  rb: { compiler: "ruby-3.4.9", displayName: "Ruby 3.4" },
  php: { compiler: "php-8.3.12", displayName: "PHP 8.3" },
  bash: { compiler: "bash", displayName: "Bash" },
  sh: { compiler: "bash", displayName: "Bash" },
};

export async function executeWandbox(
  langOrCompiler: string,
  code: string,
  stdin: string = ""
): Promise<{
  output: string;
  isError: boolean;
  compilerMsg?: string;
  languageName: string;
}> {
  const normalizedLang = langOrCompiler.toLowerCase().trim();
  const mapping = COMPILER_MAP[normalizedLang] || {
    compiler: normalizedLang,
    displayName: langOrCompiler,
  };

  try {
    const response = await fetch("https://wandbox.org/api/compile.json", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        compiler: mapping.compiler,
        code,
        stdin,
        options: mapping.options || "",
      }),
    });

    if (!response.ok) {
      throw new Error(`Wandbox API HTTP ${response.status}`);
    }

    const data: WandboxExecutionResult = await response.json();

    const outputParts: string[] = [];
    if (data.compiler_error) {
      outputParts.push(`[Compiler Error]\n${data.compiler_error}`);
    }
    if (data.program_error) {
      outputParts.push(`[Runtime Error]\n${data.program_error}`);
    }
    if (data.program_output) {
      outputParts.push(data.program_output);
    }

    const isError =
      Boolean(data.compiler_error) ||
      Boolean(data.program_error) ||
      data.status !== "0";

    const finalOutput =
      outputParts.join("\n").trim() ||
      (data.status === "0"
        ? "Program executed successfully with no output."
        : `Execution failed with code ${data.status}`);

    return {
      output: finalOutput,
      isError,
      compilerMsg: data.compiler_message,
      languageName: mapping.displayName,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      output: `Cloud Sandbox Execution Error: ${errorMsg}`,
      isError: true,
      languageName: mapping.displayName,
    };
  }
}

import type { MessageBlock } from "./types";
import { DEFAULT_MODEL_ID, getModelById } from "./providers";

export interface SessionData {
  id: string;
  title: string;
  sandbox_id: string;
  sandbox_state: "running" | "paused" | "dead";
  model: string;
  provider: string;
  created_at: string;
  messages: Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    blocks?: MessageBlock[];
    created_at: string;
  }>;
  files: Record<string, string>;
  preview_url: string | null;
  needs_run: boolean;
  agent_running: boolean;
  cwd: string;
}

// Global in-memory storage across Next.js API requests
declare global {
  var __codeforge_sessions: Map<string, SessionData> | undefined;
}

const sessions: Map<string, SessionData> =
  globalThis.__codeforge_sessions ?? new Map();
globalThis.__codeforge_sessions = sessions;

// Seed initial session if empty
if (sessions.size === 0) {
  const initialId = "demo-netflix-clone";
  const initialFiles: Record<string, string> = {
    "package.json": JSON.stringify(
      {
        name: "netflix-clone",
        version: "1.0.0",
        type: "module",
        scripts: {
          dev: "vite",
          build: "vite build",
        },
        dependencies: {
          lucide: "^0.553.0",
          react: "^19.0.0",
          "react-dom": "^19.0.0",
        },
        devDependencies: {
          vite: "^5.4.0",
        },
      },
      null,
      2,
    ),
    "index.html": `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>StreamForge — Netflix Clone</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="/src/index.css" />
  </head>
  <body class="bg-zinc-950 text-white selection:bg-red-600 selection:text-white">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`,
    "src/index.css": `@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  background-color: #09090b;
  color: #ffffff;
  overflow-x: hidden;
}

.hide-scrollbar::-webkit-scrollbar {
  display: none;
}
.hide-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}`,
    "src/main.tsx": `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`,
    "src/App.tsx": `import React, { useState } from 'react';

const FEATURED = {
  title: "Stranger Encounters",
  badge: "TOP 10 TODAY IN TV SHOWS",
  description: "When a young boy vanishes from a tranquil midwestern town, a mystery unfolds involving secret experiments, terrifying supernatural forces and one strange little girl.",
  year: "2026",
  rating: "16+",
  seasons: "4 Seasons",
  genre: "Sci-Fi, Horror, Mystery",
  backdrop: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1600&q=80"
};

const CATEGORIES = [
  {
    name: "Trending Now",
    items: [
      { id: 1, title: "Cyber Horizon", image: "https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=500&q=80", match: "98% Match", year: "2025" },
      { id: 2, title: "Deep Oceans", image: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=500&q=80", match: "95% Match", year: "2024" },
      { id: 3, title: "Neon Velocity", image: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=500&q=80", match: "91% Match", year: "2026" },
      { id: 4, title: "Lost Dynasty", image: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=500&q=80", match: "89% Match", year: "2023" },
      { id: 5, title: "Arctic Solitude", image: "https://images.unsplash.com/photo-1483921020237-2ff51e8e4b22?auto=format&fit=crop&w=500&q=80", match: "96% Match", year: "2025" }
    ]
  },
  {
    name: "Action & Sci-Fi Thrillers",
    items: [
      { id: 6, title: "Quantum Paradox", image: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=500&q=80", match: "99% Match", year: "2026" },
      { id: 7, title: "Stealth Agent", image: "https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=500&q=80", match: "94% Match", year: "2024" },
      { id: 8, title: "Orbital Dusk", image: "https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=500&q=80", match: "92% Match", year: "2025" },
      { id: 9, title: "Iron Bastion", image: "https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&w=500&q=80", match: "88% Match", year: "2023" }
    ]
  }
];

export default function App() {
  const [selectedMovie, setSelectedMovie] = useState<any>(null);
  const [inMyList, setInMyList] = useState(false);

  return (
    <div className="min-h-screen bg-[#141414] text-white">
      {/* Navigation */}
      <header className="fixed top-0 z-40 flex w-full items-center justify-between bg-gradient-to-b from-black/80 to-transparent px-8 py-4 backdrop-blur-sm">
        <div className="flex items-center gap-8">
          <span className="text-2xl font-black tracking-wider text-red-600">CODEFORGE FLIX</span>
          <nav className="hidden md:flex gap-6 text-sm text-zinc-300">
            <a href="#" className="font-semibold text-white">Home</a>
            <a href="#" className="hover:text-white transition">TV Shows</a>
            <a href="#" className="hover:text-white transition">Movies</a>
            <a href="#" className="hover:text-white transition">New & Popular</a>
            <a href="#" className="hover:text-white transition">My List</a>
          </nav>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <button className="rounded bg-red-600 px-3 py-1.5 font-medium text-white hover:bg-red-700">
            Sign In
          </button>
        </div>
      </header>

      {/* Hero Billboard */}
      <div className="relative h-[80vh] w-full overflow-hidden">
        <img
          src={FEATURED.backdrop}
          alt={FEATURED.title}
          className="h-full w-full object-cover brightness-60"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-zinc-950 via-zinc-950/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-transparent to-transparent" />

        <div className="absolute bottom-20 left-8 max-w-xl space-y-4">
          <span className="inline-block rounded bg-red-600/90 px-2 py-0.5 text-xs font-bold uppercase tracking-wider">
            {FEATURED.badge}
          </span>
          <h1 className="text-5xl font-extrabold tracking-tight drop-shadow-md">{FEATURED.title}</h1>
          <p className="text-sm leading-relaxed text-zinc-300 drop-shadow">{FEATURED.description}</p>
          <div className="flex items-center gap-4 pt-2">
            <button
              onClick={() => alert("Playing Stranger Encounters...")}
              className="flex items-center gap-2 rounded bg-white px-6 py-2.5 font-bold text-zinc-900 transition hover:bg-zinc-200"
            >
              ▶ Play
            </button>
            <button
              onClick={() => setInMyList(!inMyList)}
              className="flex items-center gap-2 rounded bg-zinc-600/70 px-5 py-2.5 font-semibold text-white backdrop-blur transition hover:bg-zinc-600"
            >
              {inMyList ? "✓ In My List" : "+ Add to List"}
            </button>
          </div>
        </div>
      </div>

      {/* Movie Rows */}
      <div className="relative -mt-12 space-y-10 px-8 pb-16">
        {CATEGORIES.map((cat) => (
          <div key={cat.name} className="space-y-3">
            <h2 className="text-xl font-bold tracking-tight text-zinc-100">{cat.name}</h2>
            <div className="flex gap-4 overflow-x-auto pb-4 hide-scrollbar">
              {cat.items.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedMovie(item)}
                  className="group relative flex-none w-56 cursor-pointer overflow-hidden rounded-md bg-zinc-800 transition-all duration-300 hover:scale-105 hover:z-20 hover:shadow-2xl"
                >
                  <img
                    src={item.image}
                    alt={item.title}
                    className="h-32 w-full object-cover"
                  />
                  <div className="p-3">
                    <p className="font-semibold text-sm truncate">{item.title}</p>
                    <div className="mt-1 flex items-center justify-between text-xs text-zinc-400">
                      <span className="text-emerald-400 font-semibold">{item.match}</span>
                      <span>{item.year}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}`,
    "README.md": `# Netflix Clone

A full-featured streaming client interface built with React, Vite, and Tailwind CSS.
Includes responsive billboard hero, movie carousels, and item detail preview.
`,
  };

  sessions.set(initialId, {
    id: initialId,
    title: "Build a Netflix clone",
    sandbox_id: "sbx-netflix-01",
    sandbox_state: "running",
    model: "opencode/zen-coder-free",
    provider: "OpenCode Zen",
    created_at: new Date(Date.now() - 3600000).toISOString(),
    messages: [
      {
        id: "msg-user-1",
        role: "user",
        content: "Build a Netflix clone with responsive carousels, a hero banner, and streaming catalog",
        created_at: new Date(Date.now() - 3500000).toISOString(),
      },
      {
        id: "msg-asst-1",
        role: "assistant",
        content: "I've created a modern Netflix clone interface with a cinematic billboard hero, category carousels, and responsive streaming cards.",
        blocks: [
          {
            type: "text",
            content: "I'll scaffold a streaming media platform using React and modern styling.",
          },
          {
            type: "tool",
            step: {
              id: "step-1",
              name: "run_command",
              input: { command: "npm create vite@latest netflix-clone --template react-ts" },
              output: "Scaffolded React + Vite project in /home/user/netflix-clone",
              status: "done",
            },
          },
          {
            type: "tool",
            step: {
              id: "step-2",
              name: "file_write",
              input: { path: "src/App.tsx" },
              output: "Wrote 180 lines to src/App.tsx",
              status: "done",
            },
          },
          {
            type: "text",
            content: "The application is ready! You can review the code in the editor or view the live demo.",
          },
        ],
        created_at: new Date(Date.now() - 3400000).toISOString(),
      },
    ],
    files: initialFiles,
    preview_url: `/api/preview/${initialId}`,
    needs_run: false,
    agent_running: false,
    cwd: "/home/user/project",
  });
}

export function getSessionData(id: string): SessionData | undefined {
  return sessions.get(id);
}

export function listSessionsData(): Array<{ id: string; title: string; created_at: string }> {
  const result: Array<{ id: string; title: string; created_at: string }> = [];
  for (const s of sessions.values()) {
    result.push({
      id: s.id,
      title: s.title,
      created_at: s.created_at,
    });
  }
  // Sort latest first
  return result.reverse();
}

export function createNewSession(
  title?: string,
  message?: string,
  model?: string,
): SessionData {
  const id = crypto.randomUUID();
  const sessionTitle = title || (message ? message.slice(0, 60) : "New session");
  const now = new Date().toISOString();
  const selectedModel = getModelById(model || DEFAULT_MODEL_ID);

  const newSession: SessionData = {
    id,
    title: sessionTitle,
    sandbox_id: `sbx-${id.slice(0, 8)}`,
    sandbox_state: "running",
    model: selectedModel.id,
    provider: selectedModel.providerName,
    created_at: now,
    messages: [],
    files: {},
    preview_url: `/api/preview/${id}`,
    needs_run: false,
    agent_running: false,
    cwd: "/home/user/project",
  };

  if (message) {
    newSession.messages.push({
      id: crypto.randomUUID(),
      role: "user",
      content: message.trim(),
      created_at: now,
    });
    newSession.needs_run = true;
  }

  sessions.set(id, newSession);
  return newSession;
}

export function generateTemplateFiles(prompt: string): Record<string, string> {
  const lower = prompt.toLowerCase();

  if (lower.includes("kanban") || lower.includes("board") || lower.includes("task")) {
    return {
      "package.json": JSON.stringify(
        {
          name: "kanban-board",
          version: "1.0.0",
          dependencies: { react: "^19.0.0", "react-dom": "^19.0.0" },
        },
        null,
        2,
      ),
      "src/App.tsx": `import React, { useState } from 'react';

interface Task {
  id: string;
  title: string;
  tag: string;
  priority: 'low' | 'medium' | 'high';
}

const INITIAL_COLUMNS: { id: string; title: string; tasks: Task[] }[] = [
  {
    id: 'backlog',
    title: 'Backlog',
    tasks: [
      { id: '1', title: 'Design user onboarding flow', tag: 'UI/UX', priority: 'medium' },
      { id: '2', title: 'Implement OAuth authentication', tag: 'Backend', priority: 'high' },
    ],
  },
  {
    id: 'in-progress',
    title: 'In Progress',
    tasks: [
      { id: '3', title: 'Integrate real-time WebSockets', tag: 'Core', priority: 'high' },
    ],
  },
  {
    id: 'done',
    title: 'Done',
    tasks: [
      { id: '4', title: 'Initial repo setup & CI/CD pipeline', tag: 'DevOps', priority: 'low' },
    ],
  },
];

export default function App() {
  const [columns, setColumns] = useState(INITIAL_COLUMNS);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [activeCol, setActiveCol] = useState('backlog');

  const addTask = () => {
    if (!newTaskTitle.trim()) return;
    const task: Task = {
      id: Date.now().toString(),
      title: newTaskTitle.trim(),
      tag: 'Feature',
      priority: 'medium',
    };
    setColumns(columns.map(col => col.id === activeCol ? { ...col, tasks: [...col.tasks, task] } : col));
    setNewTaskTitle('');
  };

  const moveTask = (taskId: string, targetColId: string) => {
    let movedTask: Task | null = null;
    const next = columns.map(c => {
      const remaining = c.tasks.filter(t => {
        if (t.id === taskId) {
          movedTask = t;
          return false;
        }
        return true;
      });
      return { ...c, tasks: remaining };
    });
    if (!movedTask) return;
    setColumns(next.map(c => c.id === targetColId ? { ...c, tasks: [...c.tasks, movedTask!] } : c));
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-8">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Project Sprint Board</h1>
          <p className="text-slate-400 text-sm mt-1">Manage deliverables and feature roadmaps</p>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Add task title..."
            value={newTaskTitle}
            onChange={e => setNewTaskTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addTask()}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-indigo-500"
          />
          <button
            onClick={addTask}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-lg text-sm font-semibold transition"
          >
            + Add Task
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {columns.map(col => (
          <div key={col.id} className="bg-slate-800/80 rounded-xl p-4 border border-slate-700/60 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-slate-200">{col.title}</h2>
              <span className="text-xs bg-slate-700 px-2 py-0.5 rounded-full font-mono">{col.tasks.length}</span>
            </div>
            <div className="space-y-3 flex-1">
              {col.tasks.map(t => (
                <div key={t.id} className="bg-slate-900 p-4 rounded-lg border border-slate-800 shadow-sm hover:border-slate-700 transition">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                    {t.tag}
                  </span>
                  <p className="mt-2 text-sm font-medium">{t.title}</p>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                    <span className="capitalize">{t.priority} priority</span>
                    <div className="flex gap-1">
                      {columns.map(c => c.id !== col.id && (
                        <button
                          key={c.id}
                          onClick={() => moveTask(t.id, c.id)}
                          className="hover:text-slate-300 underline"
                        >
                          → {c.title.split(' ')[0]}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}`,
      "src/index.css": `@tailwind base;\n@tailwind components;\n@tailwind utilities;\nbody { margin: 0; background: #0f172a; color: #f8fafc; font-family: sans-serif; }`,
      "README.md": `# Kanban Task Board\n\nInteractive React task management board with dynamic column state.`,
    };
  }

  if (lower.includes("dashboard") || lower.includes("admin")) {
    return {
      "package.json": JSON.stringify(
        {
          name: "admin-dashboard",
          version: "1.0.0",
          dependencies: { react: "^19.0.0", "react-dom": "^19.0.0" },
        },
        null,
        2,
      ),
      "src/App.tsx": `import React, { useState } from 'react';

const STATS = [
  { label: 'Total Revenue', value: '$45,231.89', change: '+20.1% from last month' },
  { label: 'Active Subscriptions', value: '+2,350', change: '+180.1% from last month' },
  { label: 'Sales Velocity', value: '+12,234', change: '+19% from last month' },
  { label: 'Server Load', value: '42%', change: '-4% from average' },
];

const RECENT_ORDERS = [
  { id: 'ORD-7021', customer: 'Elena Vance', product: 'Cloud Cluster Pro', amount: '$349.00', status: 'Completed' },
  { id: 'ORD-7020', customer: 'Marcus Holloway', product: 'Edge Runtime Solo', amount: '$49.00', status: 'Processing' },
  { id: 'ORD-7019', customer: 'Avery Chen', product: 'Vector Store Addon', amount: '$120.00', status: 'Completed' },
  { id: 'ORD-7018', customer: 'Sarah Jenkins', product: 'Compute Node XL', amount: '$850.00', status: 'Completed' },
];

export default function App() {
  const [filter, setFilter] = useState('all');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-800 p-6 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 mb-8">
            <div className="h-7 w-7 rounded bg-indigo-600 flex items-center justify-center font-bold text-white">F</div>
            <span className="font-bold text-lg">ForgeAdmin</span>
          </div>
          <nav className="space-y-1 text-sm text-slate-400">
            <a href="#" className="block px-3 py-2 rounded-lg bg-indigo-600/20 text-indigo-400 font-semibold">Overview</a>
            <a href="#" className="block px-3 py-2 rounded-lg hover:bg-slate-900 hover:text-white transition">Analytics</a>
            <a href="#" className="block px-3 py-2 rounded-lg hover:bg-slate-900 hover:text-white transition">Customers</a>
            <a href="#" className="block px-3 py-2 rounded-lg hover:bg-slate-900 hover:text-white transition">Settings</a>
          </nav>
        </div>
        <div className="text-xs text-slate-500">
          v2.4.0 · Production Ready
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto">
        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Executive Dashboard</h1>
            <p className="text-sm text-slate-400">Real-time performance metrics and revenue tracking</p>
          </div>
          <button className="bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-lg text-sm font-semibold transition">
            Export Report
          </button>
        </header>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {STATS.map((s, i) => (
            <div key={i} className="bg-slate-900 p-5 rounded-xl border border-slate-800">
              <span className="text-xs text-slate-400 uppercase tracking-wider">{s.label}</span>
              <p className="text-2xl font-extrabold mt-1">{s.value}</p>
              <span className="text-xs text-emerald-400 mt-2 block">{s.change}</span>
            </div>
          ))}
        </div>

        {/* Recent Orders */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
          <h2 className="font-bold text-lg mb-4">Recent Transactions</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead>
                <tr className="border-b border-slate-800 text-xs uppercase text-slate-500">
                  <th className="pb-3">Order ID</th>
                  <th className="pb-3">Customer</th>
                  <th className="pb-3">Product</th>
                  <th className="pb-3">Amount</th>
                  <th className="pb-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {RECENT_ORDERS.map(order => (
                  <tr key={order.id} className="hover:bg-slate-800/40">
                    <td className="py-3 font-mono text-xs">{order.id}</td>
                    <td className="py-3 font-medium text-white">{order.customer}</td>
                    <td className="py-3">{order.product}</td>
                    <td className="py-3 font-semibold">{order.amount}</td>
                    <td className="py-3">
                      <span className={\`text-xs px-2 py-0.5 rounded-full font-medium \${
                        order.status === 'Completed' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                      }\`}>
                        {order.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}`,
      "src/index.css": `@tailwind base;\n@tailwind components;\n@tailwind utilities;\nbody { margin: 0; background: #020617; font-family: sans-serif; }`,
      "README.md": `# Executive Admin Dashboard\n\nResponsive management dashboard featuring key metrics and transaction logs.`,
    };
  }

  // Default app template
  return {
    "package.json": JSON.stringify(
      {
        name: "codeforge-app",
        version: "1.0.0",
        type: "module",
        dependencies: { react: "^19.0.0", "react-dom": "^19.0.0" },
      },
      null,
      2,
    ),
    "src/App.tsx": `import React, { useState } from 'react';

export default function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-950 text-white flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full bg-slate-800/60 border border-slate-700/60 backdrop-blur-xl rounded-2xl p-8 shadow-2xl text-center space-y-6">
        <div className="inline-block p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20">
          <span className="text-4xl">⚡</span>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight">CodeForge App</h1>
        <p className="text-slate-400 text-sm">
          Scaffolded application running in an interactive sandbox. Modify components or use chat to expand functionality.
        </p>

        <div className="flex items-center justify-center gap-4 py-2">
          <button
            onClick={() => setCount(c => c - 1)}
            className="h-10 w-10 rounded-lg bg-slate-700 hover:bg-slate-600 font-bold transition flex items-center justify-center"
          >
            -
          </button>
          <span className="text-2xl font-mono font-bold w-12 text-center">{count}</span>
          <button
            onClick={() => setCount(c => c + 1)}
            className="h-10 w-10 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-bold transition flex items-center justify-center"
          >
            +
          </button>
        </div>

        <div className="border-t border-slate-700/60 pt-4 text-xs text-slate-500">
          Built with React 19 and Tailwind CSS
        </div>
      </div>
    </div>
  );
}`,
    "src/index.css": `@tailwind base;\n@tailwind components;\n@tailwind utilities;\nbody { margin: 0; background: #0f172a; font-family: sans-serif; }`,
    "README.md": `# CodeForge Application\n\nGenerated application workspace ready for iteration.`,
  };
}

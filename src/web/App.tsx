import { useCallback, useEffect, useState } from "react";
import { isolationLabel, providerLabel, taskLabel } from "../shared/labels.ts";
import { api, ApiError } from "./api.ts";
import { Button } from "./components/button.tsx";
import { Input, Label, TextArea } from "./components/input.tsx";

type Badge = { label: string; recordedAt: string; scope: string; softwareObserved: false; observedBy: string };
type Employee = {
  id: string;
  displayName: string;
  roleTitle: string;
  responsibilities: string;
  instructions: string;
  providerKind: string;
  allowedProjectIds: string[];
  connection: { status: string; credentialPrepared: boolean; lastMcpCallAt: string | null; note: string; revokedAt: string | null } | null;
  computer: { label: string; isolation: string; lastConfirmedAt: string | null; badge: Badge | null };
  capabilities: Array<{ id: string; label: string; support: string; evidence: string; detail: string }>;
};
type Task = {
  id: string;
  projectId: string;
  title: string;
  body: string;
  assigneeId: string | null;
  state: string;
  resultBody: string | null;
  resultLabel: string | null;
  unknownReason: string | null;
  events: Array<{ id: string; actorType: string; note: string; createdAt: string; toState: string }>;
  attachments: Array<{ id: string; filename: string; byteSize: number }>;
};
type Project = {
  id: string;
  name: string;
  summary: string;
  status: string;
  goal: string;
  mainBotId: string | null;
  workspaceKind: string;
  workspaceLabel: string;
  workspaceEndpoint: string | null;
  hasFrame: boolean;
  updatedAt: string;
};
type MainBot = { id: string; displayName: string; providerKind: string; note: string; credentialPrepared: boolean };
type Approval = { id: string; kind: string; summary: string; status: string; outcome: string | null; expiresAt: string };
type Activity = { id: string; kind: string; createdAt: string; note?: string; detail?: string; action?: string };
type Snapshot = {
  workspace: { id: string; name: string; approvals: { send: boolean; purchase: boolean; publish: boolean; deleteData: boolean } };
  mainBots: MainBot[];
  projects: Project[];
  employees: Employee[];
  tasks: Task[];
  approvals: Approval[];
  activity: Activity[];
  attention: { approvals: Approval[]; unknownTasks: Task[]; needsInput: Task[]; failed: Task[] };
};

const STORAGE = "roster-lab.workspaceId";

export function App() {
  const [path, setPath] = useState(() => window.location.pathname);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [token, setToken] = useState<string | null>(null);

  const go = (href: string) => {
    window.history.pushState({}, "", href);
    setPath(href);
    setError(null);
  };

  const load = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const next = await api<Snapshot>(`/api/workspaces/${id}`);
      setSnapshot(next);
      localStorage.setItem(STORAGE, id);
      setError(null);
    } catch (caught) {
      setSnapshot(null);
      localStorage.removeItem(STORAGE);
      setError(caught instanceof ApiError ? caught.message : "The company could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    const onOff = () => setOffline(true);
    const onOn = () => setOffline(false);
    window.addEventListener("popstate", onPop);
    window.addEventListener("offline", onOff);
    window.addEventListener("online", onOn);
    const saved = localStorage.getItem(STORAGE);
    if (saved) void load(saved);
    else setLoading(false);
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("offline", onOff);
      window.removeEventListener("online", onOn);
    };
  }, [load]);

  async function run(action: () => Promise<void>) {
    try {
      await action();
      setError(null);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "That did not work.");
    }
  }

  const refresh = () => {
    if (snapshot) return load(snapshot.workspace.id);
    return Promise.resolve();
  };

  return (
    <div className="min-h-screen">
      <a className="skip" href="#main">Skip to content</a>
      <header className="border-b border-[var(--line)]">
        <div className="mx-auto flex max-w-5xl flex-wrap items-end justify-between gap-4 px-4 py-5">
          <button className="wordmark bg-transparent text-left text-3xl" onClick={() => go("/")} type="button">Roster Lab</button>
          <p className="max-w-sm text-sm text-[var(--muted)]">A local roster. Simulated people stay labeled. Duet and dots stay unverified until an eligible account is tested.</p>
        </div>
        {snapshot && (
          <nav aria-label="Primary" className="mx-auto flex max-w-5xl flex-wrap gap-2 px-4 pb-4">
            <Nav href="/" path={path} go={go} label="Today" />
            <Nav href="/people" path={path} go={go} label="People" />
            <Nav href="/activity" path={path} go={go} label="Activity" />
            <Nav href="/settings" path={path} go={go} label="Settings" />
          </nav>
        )}
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8" id="main">
        {offline && <Banner>This browser reports that it is offline. Saved data is still on this computer when the app can be reached.</Banner>}
        {error && <Banner>{error}</Banner>}
        {loading && <p>Loading the roster on this computer…</p>}
        {!loading && !snapshot && <Empty go={go} run={run} onReady={(id) => void load(id)} />}
        {!loading && snapshot && path.startsWith("/people/") && (
          <Person key={path} snapshot={snapshot} id={path.split("/")[2] ?? ""} go={go} run={run} refresh={refresh} onToken={setToken} />
        )}
        {!loading && snapshot && path.startsWith("/projects/") && <ProjectView key={path} snapshot={snapshot} id={path.split("/")[2] ?? ""} go={go} run={run} refresh={refresh} />}
        {!loading && snapshot && path.startsWith("/tasks/") && <TaskView key={path} snapshot={snapshot} id={path.split("/")[2] ?? ""} go={go} run={run} refresh={refresh} />}
        {!loading && snapshot && path === "/people" && <People snapshot={snapshot} go={go} run={run} refresh={refresh} />}
        {!loading && snapshot && path === "/activity" && <ActivityView snapshot={snapshot} go={go} />}
        {!loading && snapshot && path === "/settings" && <Settings snapshot={snapshot} run={run} refresh={refresh} onGone={() => { setSnapshot(null); localStorage.removeItem(STORAGE); }} />}
        {!loading && snapshot && path === "/" && <Today snapshot={snapshot} go={go} run={run} refresh={refresh} />}
      </main>
      {token && (
        <dialog open className="fixed inset-0 z-20 m-auto max-w-lg rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-6 shadow-xl">
          <h2 className="text-2xl">Credential, shown once</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">Copy it into the provider’s connector header if that product can use one. Roster Lab will not show it again and did not create a Duet or a dot.</p>
          <pre className="mt-4 overflow-x-auto rounded-xl bg-white p-3 text-sm">{token}</pre>
          <div className="mt-4 flex gap-2">
            <Button type="button" onClick={() => void navigator.clipboard.writeText(token)}>Copy</Button>
            <Button type="button" variant="quiet" onClick={() => setToken(null)}>I have stored it elsewhere</Button>
          </div>
        </dialog>
      )}
    </div>
  );
}

function Nav({ href, path, go, label }: { href: string; path: string; go: (href: string) => void; label: string }) {
  const current = href === "/" ? path === "/" : path.startsWith(href);
  return (
    <button aria-current={current ? "page" : undefined} className={`min-h-11 rounded-full px-4 ${current ? "bg-[var(--ink)] text-white" : "bg-transparent"}`} onClick={() => go(href)} type="button">
      {label}
    </button>
  );
}

function Banner({ children }: { children: string }) {
  return <p className="mb-4 rounded-2xl border border-[var(--line)] bg-[var(--paper)] px-4 py-3" role="status">{children}</p>;
}

function Empty({ run, onReady }: { go: (href: string) => void; run: (action: () => Promise<void>) => Promise<void>; onReady: (id: string) => void }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [existing, setExisting] = useState<Array<{ id: string; name: string }>>([]);
  useEffect(() => {
    void api<{ workspaces: Array<{ id: string; name: string }> }>("/api/workspaces").then((result) => setExisting(result.workspaces)).catch(() => setExisting([]));
  }, []);
  return (
    <section className="grid gap-8 md:grid-cols-2">
      <div>
        <h1 className="text-4xl">{existing.length ? "Choose a company" : "No company on this computer yet."}</h1>
        {existing.length > 0 && (
          <ul className="mt-4 space-y-2">
            {existing.map((company) => (
              <li key={company.id}><Button type="button" variant="quiet" onClick={() => onReady(company.id)}>{company.name}</Button></li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-[var(--muted)]">Create a company to keep projects, people, and tasks in a local database. Nothing here calls Claude or OpenAI.</p>
        <form className="mt-6 space-y-3" onSubmit={(event) => {
          event.preventDefault();
          void run(async () => {
            const created = await api<{ id: string }>("/api/workspaces", { method: "POST", body: JSON.stringify({ name }) });
            onReady(created.id);
          });
        }}>
          <Label htmlFor="company">Company name</Label>
          <Input id="company" value={name} onChange={(event) => setName(event.target.value)} required />
          <Button type="submit">Create company</Button>
        </form>
      </div>
      <aside className="rounded-3xl border border-[var(--line)] bg-[var(--paper)] p-5">
        <h2 className="text-2xl">Labeled demo</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">Two simulated profiles and two tasks. The word Simulated is part of the record. You can delete the demo company later.</p>
        <Button className="mt-4" type="button" variant="quiet" onClick={() => void run(async () => {
          const demo = await api<Snapshot>("/api/demo", { method: "POST", body: "{}" });
          onReady(demo.workspace.id);
        })}>Create a labeled demo</Button>
        <h2 className="mt-6 text-2xl">Main bot demo</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">A simulated main bot delegates to a Software Engineer project. The project opens Chrome with its own profile. The page will say local browser, not isolated VM.</p>
        <Button className="mt-4" type="button" disabled={busy} onClick={() => {
          setBusy(true);
          void run(async () => {
            const demo = await api<Snapshot>("/api/demo/main-bot", { method: "POST", body: "{}" });
            onReady(demo.workspace.id);
          }).finally(() => setBusy(false));
        }}>{busy ? "Opening Chrome…" : "Create main bot and Software Engineer"}</Button>
      </aside>
    </section>
  );
}

function Today({ snapshot, go, run, refresh }: { snapshot: Snapshot; go: (href: string) => void; run: (action: () => Promise<void>) => Promise<void>; refresh: () => Promise<void> }) {
  const [projectName, setProjectName] = useState("");
  const open = snapshot.tasks.filter((task) => !["completed", "failed"].includes(task.state));
  const [botName, setBotName] = useState("Main bot (Simulated)");
  const [projectNameBot, setProjectNameBot] = useState("Software Engineer");
  const [goal, setGoal] = useState("Write a note in this project's own browser profile.");
  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm uppercase tracking-wide text-[var(--muted)]">{snapshot.workspace.name}</p>
        <h1 className="text-4xl">Today</h1>
      </div>
      <section className="rounded-3xl border border-[var(--line)] bg-[var(--paper)] p-5">
        <h2 className="text-2xl">Main bot</h2>
        {snapshot.mainBots.length === 0 ? (
          <form className="mt-3 space-y-2" onSubmit={(event) => {
            event.preventDefault();
            void run(async () => {
              await api(`/api/workspaces/${snapshot.workspace.id}/main-bots`, { method: "POST", body: JSON.stringify({ displayName: botName, providerKind: "simulated" }) });
              await refresh();
            });
          }}>
            <p className="text-sm text-[var(--muted)]">A simulated main bot can delegate to projects. It is not a Duet or a dot.</p>
            <Label htmlFor="main-bot">Name</Label>
            <Input id="main-bot" value={botName} onChange={(event) => setBotName(event.target.value)} required />
            <Button type="submit">Add simulated main bot</Button>
          </form>
        ) : (
          <ul className="mt-3 space-y-2">
            {snapshot.mainBots.map((bot) => (
              <li key={bot.id}>
                <p className="font-semibold">{bot.displayName}</p>
                <p className="text-sm text-[var(--muted)]">{bot.note}</p>
              </li>
            ))}
          </ul>
        )}
        {snapshot.mainBots[0] && (
          <form className="mt-4 space-y-2" onSubmit={(event) => {
            event.preventDefault();
            const bot = snapshot.mainBots[0];
            if (!bot) return;
            void run(async () => {
              await api(`/api/workspaces/${snapshot.workspace.id}/projects`, { method: "POST", body: JSON.stringify({ name: projectNameBot, summary: "Project bot", goal, mainBotId: bot.id }) });
              setProjectNameBot("");
              await refresh();
            });
          }}>
            <Label htmlFor="sub-bot">New project bot</Label>
            <Input id="sub-bot" value={projectNameBot} onChange={(event) => setProjectNameBot(event.target.value)} required />
            <Label htmlFor="goal">Goal</Label>
            <Input id="goal" value={goal} onChange={(event) => setGoal(event.target.value)} />
            <Button type="submit" variant="quiet">Add project bot</Button>
          </form>
        )}
      </section>
      <section>
        <h2 className="text-2xl">Needs you</h2>
        {snapshot.attention.approvals.length + snapshot.attention.unknownTasks.length + snapshot.attention.needsInput.length === 0 ? (
          <p className="mt-2 text-[var(--muted)]">Nothing is waiting on a decision.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {snapshot.attention.approvals.map((item) => <li key={item.id}><button className="text-left underline" onClick={() => go("/settings")} type="button">{item.summary}</button></li>)}
            {snapshot.attention.unknownTasks.map((task) => <li key={task.id}><button className="text-left underline" onClick={() => go(`/tasks/${task.id}`)} type="button">{task.title} is unknown</button></li>)}
            {snapshot.attention.needsInput.map((task) => <li key={task.id}><button className="text-left underline" onClick={() => go(`/tasks/${task.id}`)} type="button">{task.title} needs your input</button></li>)}
          </ul>
        )}
      </section>
      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-3xl border border-[var(--line)] bg-[var(--paper)] p-5">
          <h2 className="text-2xl">Projects</h2>
          <ul className="mt-3 space-y-2">
            {snapshot.projects.map((project) => (
              <li key={project.id}><button className="text-left" onClick={() => go(`/projects/${project.id}`)} type="button"><span className="underline">{project.name}</span> <span className="text-sm text-[var(--muted)]">{project.status}</span></button></li>
            ))}
            {snapshot.projects.length === 0 && <li className="text-[var(--muted)]">No projects yet.</li>}
          </ul>
          <form className="mt-4 space-y-2" onSubmit={(event) => {
            event.preventDefault();
            void run(async () => {
              await api(`/api/workspaces/${snapshot.workspace.id}/projects`, { method: "POST", body: JSON.stringify({ name: projectName, summary: "" }) });
              setProjectName("");
              await refresh();
            });
          }}>
            <Label htmlFor="new-project">New project</Label>
            <Input id="new-project" value={projectName} onChange={(event) => setProjectName(event.target.value)} required />
            <Button type="submit" variant="quiet">Add project</Button>
          </form>
        </article>
        <article className="rounded-3xl border border-[var(--line)] bg-[var(--paper)] p-5">
          <h2 className="text-2xl">People</h2>
          <ul className="mt-3 space-y-3">
            {snapshot.employees.map((person) => (
              <li key={person.id}>
                <button className="text-left" onClick={() => go(`/people/${person.id}`)} type="button">
                  <span className="block underline">{person.displayName}</span>
                  <span className="text-sm text-[var(--muted)]">{person.roleTitle} · {providerLabel(person.providerKind)} · {isolationLabel(person.computer.isolation)}</span>
                </button>
              </li>
            ))}
            {snapshot.employees.length === 0 && <li className="text-[var(--muted)]">No people yet.</li>}
          </ul>
        </article>
      </section>
      <section>
        <h2 className="text-2xl">Open work</h2>
        <ul className="mt-3 space-y-2">
          {open.map((task) => <li key={task.id}><button className="underline" onClick={() => go(`/tasks/${task.id}`)} type="button">{task.title}</button> <span className="text-sm text-[var(--muted)]">{taskLabel(task.state)}</span></li>)}
          {open.length === 0 && <li className="text-[var(--muted)]">No open tasks.</li>}
        </ul>
      </section>
    </div>
  );
}

function People({ snapshot, go, run, refresh }: { snapshot: Snapshot; go: (href: string) => void; run: (action: () => Promise<void>) => Promise<void>; refresh: () => Promise<void> }) {
  const [displayName, setDisplayName] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  return (
    <div className="space-y-8">
      <h1 className="text-4xl">People</h1>
      <p className="text-[var(--muted)]">A profile is not an agent and not a computer. Connection and isolation are separate lines.</p>
      <ul className="divide-y divide-[var(--line)] rounded-3xl border border-[var(--line)] bg-[var(--paper)]">
        {snapshot.employees.map((person) => (
          <li key={person.id} className="p-4">
            <button className="w-full text-left" onClick={() => go(`/people/${person.id}`)} type="button">
              <span className="block text-xl underline">{person.displayName}</span>
              <span className="mt-1 block text-sm text-[var(--muted)]">{person.roleTitle}</span>
              <span className="mt-1 block text-sm">{providerLabel(person.providerKind)} · {isolationLabel(person.computer.isolation)}</span>
              <span className="mt-1 block text-sm text-[var(--muted)]">{person.computer.lastConfirmedAt ? `Last confirmed ${person.computer.lastConfirmedAt}` : "Not confirmed yet"}</span>
            </button>
          </li>
        ))}
      </ul>
      <form className="max-w-lg space-y-3" onSubmit={(event) => {
        event.preventDefault();
        void run(async () => {
          await api(`/api/workspaces/${snapshot.workspace.id}/employees`, { method: "POST", body: JSON.stringify({ displayName, roleTitle }) });
          setDisplayName("");
          setRoleTitle("");
          await refresh();
        });
      }}>
        <h2 className="text-2xl">Add a person</h2>
        <Label htmlFor="person-name">Name</Label>
        <Input id="person-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} required />
        <Label htmlFor="person-role">Role</Label>
        <Input id="person-role" value={roleTitle} onChange={(event) => setRoleTitle(event.target.value)} required />
        <Button type="submit">Save profile</Button>
      </form>
    </div>
  );
}

function Person({ snapshot, id, go, run, refresh, onToken }: { snapshot: Snapshot; id: string; go: (href: string) => void; run: (action: () => Promise<void>) => Promise<void>; refresh: () => Promise<void>; onToken: (token: string) => void }) {
  const person = snapshot.employees.find((item) => item.id === id);
  const [instructions, setInstructions] = useState(person?.instructions ?? "");
  const [responsibilities, setResponsibilities] = useState(person?.responsibilities ?? "");
  if (!person) return <p>That person is not in this company.</p>;
  const tasks = snapshot.tasks.filter((task) => task.assigneeId === person.id);
  return (
    <div className="space-y-8">
      <div>
        <button className="text-sm underline" onClick={() => go("/people")} type="button">People</button>
        <h1 className="text-4xl">{person.displayName}</h1>
        <p>{person.roleTitle}</p>
        <p className="mt-2">{isolationLabel(person.computer.isolation)}</p>
        <p className="text-sm text-[var(--muted)]">{person.computer.label}</p>
        {person.computer.badge && (
          <p className="mt-3 rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-3 text-sm">
            {person.computer.badge.label}. Operator-recorded {person.computer.badge.recordedAt}. Roster Lab did not run this check. Scope: {person.computer.badge.scope}.
          </p>
        )}
      </div>
      <form className="space-y-3" onSubmit={(event) => {
        event.preventDefault();
        void run(async () => {
          const selected = [...event.currentTarget.querySelectorAll<HTMLInputElement>("input[name=project]:checked")].map((input) => input.value);
          await api(`/api/employees/${person.id}`, { method: "PATCH", body: JSON.stringify({ responsibilities, instructions, allowedProjectIds: selected }) });
          await refresh();
        });
      }}>
        <Label htmlFor="resp">Responsibilities</Label>
        <TextArea id="resp" value={responsibilities} onChange={(event) => setResponsibilities(event.target.value)} />
        <Label htmlFor="inst">Instructions for this profile</Label>
        <TextArea id="inst" value={instructions} onChange={(event) => setInstructions(event.target.value)} />
        <fieldset>
          <legend className="text-sm font-semibold">Projects this person may see</legend>
          {snapshot.projects.map((project) => (
            <label key={project.id} className="mt-2 flex min-h-11 items-center gap-2">
              <input defaultChecked={person.allowedProjectIds.includes(project.id)} name="project" type="checkbox" value={project.id} />
              {project.name}
            </label>
          ))}
        </fieldset>
        <Button type="submit">Save profile</Button>
      </form>
      <section className="space-y-3">
        <h2 className="text-2xl">Provider</h2>
        <div className="flex flex-wrap gap-2">
          {["none", "simulated", "claude-duet", "openai-dot"].map((kind) => (
            <Button key={kind} type="button" variant={person.providerKind === kind ? "default" : "quiet"} onClick={() => void run(async () => {
              await api(`/api/employees/${person.id}/provider`, { method: "POST", body: JSON.stringify({ kind }) });
              await refresh();
            })}>{providerLabel(kind)}</Button>
          ))}
        </div>
        <p className="text-sm text-[var(--muted)]">{person.connection?.note ?? "No connector."}</p>
        {person.connection?.lastMcpCallAt && <p className="text-sm">Last MCP client call {person.connection.lastMcpCallAt}. That call was not identified as Duet or a dot.</p>}
        {(person.providerKind === "claude-duet" || person.providerKind === "openai-dot") && (
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void run(async () => {
              const created = await api<{ bearerToken: string }>(`/api/employees/${person.id}/credential`, { method: "POST", body: "{}" });
              onToken(created.bearerToken);
              await refresh();
            })}>Create a local connector credential</Button>
            <Button type="button" variant="danger" onClick={() => void run(async () => {
              await api(`/api/employees/${person.id}/credential`, { method: "DELETE" });
              await refresh();
            })}>Revoke local credential</Button>
          </div>
        )}
        {(person.providerKind === "claude-duet" || person.providerKind === "openai-dot") && (
          <p className="text-sm">Status stays “Not connected” until a real provider is identified. A credential alone is not a connection.</p>
        )}
      </section>
      <section>
        <h2 className="text-2xl">What this app can do for this provider</h2>
        <ul className="mt-3 space-y-3">
          {person.capabilities.map((item) => (
            <li key={item.id} className="rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-4">
              <p className="font-semibold">{item.label}</p>
              <p className="text-sm">{item.support} · evidence: {item.evidence}</p>
              <p className="mt-1 text-sm text-[var(--muted)]">{item.detail}</p>
            </li>
          ))}
        </ul>
      </section>
      {person.providerKind !== "simulated" && person.providerKind !== "none" && <Evidence personId={person.id} run={run} refresh={refresh} />}
      <section>
        <h2 className="text-2xl">Assigned work</h2>
        <ul className="mt-2 space-y-2">
          {tasks.map((task) => <li key={task.id}><button className="underline" onClick={() => go(`/tasks/${task.id}`)} type="button">{task.title}</button> · {taskLabel(task.state)}</li>)}
          {tasks.length === 0 && <li className="text-[var(--muted)]">Nothing is assigned.</li>}
        </ul>
      </section>
    </div>
  );
}

function Evidence({ personId, run, refresh }: { personId: string; run: (action: () => Promise<void>) => Promise<void>; refresh: () => Promise<void> }) {
  return (
    <form className="space-y-3 rounded-3xl border border-[var(--line)] p-4" onSubmit={(event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      void run(async () => {
        await api(`/api/employees/${personId}/evidence`, { method: "POST", body: JSON.stringify({ evidence: {
          recordedAt: new Date().toISOString(),
          observedBy: "operator",
          scope: data.get("scope"),
          sourceNote: data.get("sourceNote"),
          checks: {
            distinctAgents: data.get("distinctAgents"),
            distinctComputers: data.get("distinctComputers"),
            marker: data.get("marker"),
            markerMethod: data.get("markerMethod"),
            noAccidentalShare: data.get("noAccidentalShare"),
          },
        } }) });
        await refresh();
      });
    }}>
      <h2 className="text-2xl">Record an isolation check</h2>
      <p className="text-sm text-[var(--muted)]">This form stores what you observed. Roster Lab does not contact the provider. A pass on every check shows the verified badge with that limit. A failed distinct-computer check shows the shared-computer label.</p>
      <Check name="distinctAgents" label="Distinct provider agents" />
      <Check name="distinctComputers" label="Distinct computers" />
      <Check name="marker" label="Marker was not visible from the other worker" />
      <Label htmlFor="markerMethod">How the marker check was done</Label>
      <Input id="markerMethod" name="markerMethod" required />
      <Check name="noAccidentalShare" label="No accidental shared session, mount, or connector" />
      <Label htmlFor="scope">Scope</Label>
      <Input id="scope" name="scope" required />
      <Label htmlFor="sourceNote">Evidence source</Label>
      <Input id="sourceNote" name="sourceNote" required />
      <Button type="submit" variant="quiet">Save evidence</Button>
    </form>
  );
}

function Check({ name, label }: { name: string; label: string }) {
  return (
    <label className="block text-sm">
      {label}
      <select className="mt-1 min-h-11 w-full rounded-xl border border-[var(--line)] bg-white px-3" name={name} defaultValue="not_run">
        <option value="not_run">Not run</option>
        <option value="pass">Pass</option>
        <option value="fail">Fail</option>
        <option value="inconclusive">Inconclusive</option>
      </select>
    </label>
  );
}

function DelegateForm({ snapshot, projectId, run, refresh }: { snapshot: Snapshot; projectId: string; run: (action: () => Promise<void>) => Promise<void>; refresh: () => Promise<void> }) {
  const [title, setTitle] = useState("Write the workspace note");
  const [busy, setBusy] = useState(false);
  const bot = snapshot.mainBots[0];
  if (!bot) return null;
  return (
    <form className="space-y-2" onSubmit={(event) => {
      event.preventDefault();
      setBusy(true);
      void run(async () => {
        const task = await api<Task>(`/api/main-bots/${bot.id}/delegate`, { method: "POST", body: JSON.stringify({ projectId, title, body: "Show the note in this project's browser profile." }) });
        await api(`/api/projects/${projectId}/run`, { method: "POST", body: JSON.stringify({ taskId: task.id }) });
        await refresh();
      }).finally(() => setBusy(false));
    }}>
      <h2 className="text-2xl">Delegate from the main bot</h2>
      <p className="text-sm text-[var(--muted)]">This stays inside Roster Lab, then opens Chrome for this project only. It does not message a Duet or a dot.</p>
      <Label htmlFor="delegate-title">Task</Label>
      <Input id="delegate-title" value={title} onChange={(event) => setTitle(event.target.value)} required />
      <Button type="submit" disabled={busy}>{busy ? "Opening the browser profile…" : "Delegate and open workspace"}</Button>
    </form>
  );
}

function ProjectView({ snapshot, id, go, run, refresh }: { snapshot: Snapshot; id: string; go: (href: string) => void; run: (action: () => Promise<void>) => Promise<void>; refresh: () => Promise<void> }) {
  const project = snapshot.projects.find((item) => item.id === id);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  if (!project) return <p>That project is not in this company.</p>;
  const tasks = snapshot.tasks.filter((task) => task.projectId === project.id);
  return (
    <div className="space-y-6">
      <h1 className="text-4xl">{project.name}</h1>
      <p>{project.summary || "No summary."}</p>
      {project.goal && <p>Goal: {project.goal}</p>}
      <p className="text-sm">{project.workspaceLabel || "Workspace not opened."}</p>
      {project.hasFrame && (
        <img alt="Capture from the local browser profile, not an isolated VM" className="max-w-full rounded-2xl border border-[var(--line)]" src={`/api/projects/${project.id}/workspace/frame?t=${project.updatedAt ?? ""}`} />
      )}
      {snapshot.mainBots[0] && (
        <DelegateForm snapshot={snapshot} projectId={project.id} run={run} refresh={refresh} />
      )}
      <ul className="space-y-2">
        {tasks.map((task) => <li key={task.id}><button className="underline" onClick={() => go(`/tasks/${task.id}`)} type="button">{task.title}</button> · {taskLabel(task.state)}</li>)}
      </ul>
      <form className="max-w-lg space-y-3" onSubmit={(event) => {
        event.preventDefault();
        void run(async () => {
          await api(`/api/projects/${project.id}/tasks`, { method: "POST", body: JSON.stringify({ title, body }) });
          setTitle("");
          setBody("");
          await refresh();
        });
      }}>
        <h2 className="text-2xl">New task</h2>
        <Label htmlFor="task-title">Title</Label>
        <Input id="task-title" value={title} onChange={(event) => setTitle(event.target.value)} required />
        <Label htmlFor="task-body">Brief</Label>
        <TextArea id="task-body" value={body} onChange={(event) => setBody(event.target.value)} />
        <Button type="submit">Save draft</Button>
      </form>
    </div>
  );
}

function TaskView({ snapshot, id, go, run, refresh }: { snapshot: Snapshot; id: string; go: (href: string) => void; run: (action: () => Promise<void>) => Promise<void>; refresh: () => Promise<void> }) {
  const task = snapshot.tasks.find((item) => item.id === id);
  const [assignee, setAssignee] = useState(task?.assigneeId ?? "");
  const [handoffTo, setHandoffTo] = useState("");
  const [note, setNote] = useState("");
  if (!task) return <p>That task is not in this company.</p>;
  const person = snapshot.employees.find((item) => item.id === task.assigneeId);
  const project = snapshot.projects.find((item) => item.id === task.projectId);
  return (
    <div className="space-y-6">
      <button className="text-sm underline" onClick={() => project && go(`/projects/${project.id}`)} type="button">{project?.name ?? "Project"}</button>
      <h1 className="text-4xl">{task.title}</h1>
      <p className="text-sm">{taskLabel(task.state)} · last reported {task.events.at(-1)?.createdAt ?? "not yet"}</p>
      <p className="whitespace-pre-wrap">{task.body || "No brief."}</p>
      <p className="text-sm text-[var(--muted)]">Assigned to {person ? person.displayName : "nobody"}.</p>
      <form className="flex flex-wrap items-end gap-2" onSubmit={(event) => {
        event.preventDefault();
        void run(async () => {
          await api(`/api/tasks/${task.id}/assign`, { method: "POST", body: JSON.stringify({ employeeId: assignee }) });
          await refresh();
        });
      }}>
        <label className="text-sm font-semibold" htmlFor="assignee">Assign
          <select className="mt-1 block min-h-11 rounded-xl border border-[var(--line)] bg-white px-3" id="assignee" value={assignee} onChange={(event) => setAssignee(event.target.value)}>
            <option value="">Choose</option>
            {snapshot.employees.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}
          </select>
        </label>
        <Button type="submit" variant="quiet">Save assignment</Button>
      </form>
      <div className="flex flex-wrap gap-2">
        {task.state === "draft" && <Button type="button" onClick={() => void run(async () => { await api(`/api/tasks/${task.id}/queue`, { method: "POST", body: "{}" }); await refresh(); })}>Queue in Roster Lab</Button>}
        {person?.providerKind === "simulated" && !["completed", "failed", "unknown"].includes(task.state) && (
          <Button type="button" onClick={() => void run(async () => { await api(`/api/tasks/${task.id}/simulate`, { method: "POST", body: "{}" }); await refresh(); })}>Run simulated step</Button>
        )}
        {task.state !== "completed" && <Button type="button" variant="danger" onClick={() => void run(async () => { await api(`/api/tasks/${task.id}/cancel`, { method: "POST", body: "{}" }); await refresh(); })}>Mark failed locally</Button>}
        <Button type="button" variant="quiet" onClick={() => void navigator.clipboard.writeText(`Manual paste. This does not send the task and does not prove a computer.\n\n${task.title}\n\n${task.body}`)}>Copy for manual paste</Button>
      </div>
      {task.resultBody && (
        <section className="rounded-3xl border border-[var(--line)] bg-[var(--paper)] p-4">
          <h2 className="text-2xl">Result</h2>
          <p className="text-sm">Label: {task.resultLabel}. {task.resultLabel === "local_browser" ? "This is a local browser, not an isolated VM. " : ""}Untrusted text. It cannot change who is signed in.</p>
          <pre className="mt-2 whitespace-pre-wrap font-sans">{task.resultBody}</pre>
        </section>
      )}
      {task.state === "unknown" && (
        <form className="space-y-2" onSubmit={(event) => {
          event.preventDefault();
          const choice = new FormData(event.currentTarget).get("choice");
          void run(async () => {
            await api(`/api/tasks/${task.id}/reconcile`, { method: "POST", body: JSON.stringify({ choice, note }) });
            await refresh();
          });
        }}>
          <p>{task.unknownReason}</p>
          <Label htmlFor="recon-note">Reconciliation note</Label>
          <Input id="recon-note" value={note} onChange={(event) => setNote(event.target.value)} required />
          <select className="min-h-11 rounded-xl border border-[var(--line)] bg-white px-3" name="choice" defaultValue="requeue">
            <option value="requeue">Requeue</option>
            <option value="mark_failed">Mark failed</option>
            <option value="accept_completed">Accept as completed by me</option>
          </select>
          <Button type="submit">Reconcile</Button>
        </form>
      )}
      <form className="space-y-2" onSubmit={(event) => {
        event.preventDefault();
        void run(async () => {
          await api(`/api/tasks/${task.id}/handoff`, { method: "POST", body: JSON.stringify({ employeeId: handoffTo, note }) });
          await refresh();
        });
      }}>
        <h2 className="text-2xl">Handoff inside this app</h2>
        <p className="text-sm text-[var(--muted)]">This changes the assignee in Roster Lab. It does not message a Duet or a dot.</p>
        <select className="min-h-11 rounded-xl border border-[var(--line)] bg-white px-3" value={handoffTo} onChange={(event) => setHandoffTo(event.target.value)} required>
          <option value="">Choose a person</option>
          {snapshot.employees.filter((item) => item.id !== task.assigneeId).map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}
        </select>
        <Label htmlFor="handoff-note">Note</Label>
        <Input id="handoff-note" value={note} onChange={(event) => setNote(event.target.value)} required />
        <Button type="submit" variant="quiet">Hand off</Button>
      </form>
      <section>
        <h2 className="text-2xl">Timeline</h2>
        <ol className="mt-3 space-y-3">
          {task.events.map((event) => (
            <li key={event.id}>
              <p className="text-sm text-[var(--muted)]">{event.createdAt} · {event.actorType} · {taskLabel(event.toState)}</p>
              <p>{event.note}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function ActivityView({ snapshot, go }: { snapshot: Snapshot; go: (href: string) => void }) {
  return (
    <div>
      <h1 className="text-4xl">Activity</h1>
      <p className="mt-2 text-[var(--muted)]">These lines are stored events. They are not a live presence feed.</p>
      <ul className="mt-6 space-y-4">
        {snapshot.activity.map((item) => (
          <li key={`${item.kind}-${item.id}`}>
            <p className="text-sm text-[var(--muted)]">{item.createdAt} · {item.kind}</p>
            <p>{item.note ?? item.detail}</p>
          </li>
        ))}
        {snapshot.activity.length === 0 && <li>No activity yet.</li>}
      </ul>
      <button className="mt-6 text-sm underline" onClick={() => go("/")} type="button">Back to today</button>
    </div>
  );
}

function Settings({ snapshot, run, refresh, onGone }: { snapshot: Snapshot; run: (action: () => Promise<void>) => Promise<void>; refresh: () => Promise<void>; onGone: () => void }) {
  const [meta, setMeta] = useState<{ dataDir: string; secretStorage: string; liveProviders: string } | null>(null);
  const [probe, setProbe] = useState<string | null>(null);
  const [name, setName] = useState("");
  const approvals = snapshot.workspace.approvals;
  useEffect(() => {
    void api<{ dataDir: string; secretStorage: string; liveProviders: string }>("/api/meta").then(setMeta).catch(() => setMeta(null));
  }, []);
  return (
    <div className="space-y-8">
      <h1 className="text-4xl">Settings</h1>
      <section>
        <h2 className="text-2xl">This computer</h2>
        <p className="mt-2 text-sm">Data directory: {meta?.dataDir ?? "Loading…"}</p>
        <p className="text-sm">{meta?.secretStorage}</p>
        <p className="text-sm">Provider live tests: {meta?.liveProviders}</p>
      </section>
      <section className="space-y-3">
        <h2 className="text-2xl">Approvals this app can actually hold</h2>
        <p className="text-sm text-[var(--muted)]">These switches cover actions Roster Lab mediates. They do not stop a Duet or dot from acting in its own apps.</p>
        {(["send", "purchase", "publish", "deleteData"] as const).map((key) => (
          <label key={key} className="flex min-h-11 items-center gap-2">
            <input checked={approvals[key]} type="checkbox" onChange={(event) => void run(async () => {
              await api(`/api/workspaces/${snapshot.workspace.id}/approvals`, { method: "PATCH", body: JSON.stringify({ ...approvals, [key]: event.target.checked }) });
              await refresh();
            })} />
            Ask before a recorded {key === "deleteData" ? "delete" : key} action
          </label>
        ))}
      </section>
      <section className="space-y-3">
        <h2 className="text-2xl">Waiting decisions</h2>
        {snapshot.approvals.filter((item) => item.status === "pending").length === 0 && <p className="text-[var(--muted)]">No pending approvals.</p>}
        {snapshot.approvals.map((item) => (
          <article key={item.id} className="rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-4">
            <p className="font-semibold">{item.kind} · {item.status}</p>
            <p>{item.summary}</p>
            {item.outcome && <p className="text-sm text-[var(--muted)]">{item.outcome}</p>}
            {item.status === "pending" && (
              <div className="mt-3 flex gap-2">
                <Button type="button" onClick={() => void run(async () => { await api(`/api/approvals/${item.id}`, { method: "POST", body: JSON.stringify({ decision: "approve" }) }); await refresh(); })}>Approve this record</Button>
                <Button type="button" variant="quiet" onClick={() => void run(async () => { await api(`/api/approvals/${item.id}`, { method: "POST", body: JSON.stringify({ decision: "deny" }) }); await refresh(); })}>Deny</Button>
              </div>
            )}
          </article>
        ))}
        <Button type="button" variant="quiet" onClick={() => void run(async () => {
          await api(`/api/workspaces/${snapshot.workspace.id}/mediated`, { method: "POST", body: JSON.stringify({ kind: "send_message", summary: "Example: send the office-move note to the landlord. Roster Lab will not send it." }) });
          await refresh();
        })}>Record a message approval request</Button>
      </section>
      <section className="flex flex-wrap gap-2">
        <Button type="button" variant="quiet" onClick={() => void run(async () => {
          const data = await api<unknown>(`/api/workspaces/${snapshot.workspace.id}/export`);
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = "roster-lab-export.json";
          link.click();
          URL.revokeObjectURL(url);
        })}>Export JSON</Button>
        <Button type="button" variant="quiet" onClick={() => void run(async () => {
          try {
            await api("/api/employees/does-not-exist");
          } catch (caught) {
            setProbe(caught instanceof ApiError ? caught.message : "Error");
          }
        })}>Show an error state</Button>
      </section>
      {probe && <Banner>{probe}</Banner>}
      <form className="space-y-3" onSubmit={(event) => {
        event.preventDefault();
        void run(async () => {
          const created = await api<{ id: string }>("/api/workspaces", { method: "POST", body: JSON.stringify({ name }) });
          localStorage.setItem(STORAGE, created.id);
          window.location.assign("/");
        });
      }}>
        <h2 className="text-2xl">Another company</h2>
        <Label htmlFor="other-company">Name</Label>
        <Input id="other-company" value={name} onChange={(event) => setName(event.target.value)} required />
        <Button type="submit" variant="quiet">Create and switch</Button>
      </form>
      <section>
        <h2 className="text-2xl">Remove this company</h2>
        <p className="text-sm text-[var(--muted)]">Deletion removes local rows and connector credentials. If the delete approval is on, the first press only asks. It does not revoke a session inside Claude or ChatGPT.</p>
        <Button className="mt-3" type="button" variant="danger" onClick={() => void run(async () => {
          const approved = snapshot.approvals.find((item) => item.kind === "delete_data" && item.status === "approved");
          const result = await api<{ deleted: boolean }>(`/api/workspaces/${snapshot.workspace.id}`, { method: "DELETE", body: JSON.stringify(approved ? { approvalId: approved.id } : {}) });
          if (result.deleted) onGone();
          else await refresh();
        })}>Delete company</Button>
      </section>
    </div>
  );
}

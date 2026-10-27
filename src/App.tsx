import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowUpRight,
  Bell,
  Box,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  Cpu,
  Expand,
  Gauge,
  LayoutDashboard,
  Maximize2,
  Pause,
  Play,
  Power,
  RotateCcw,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Square,
  Thermometer,
  TriangleAlert,
  Waves,
  X,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  condition,
  defaultThresholds,
  fields,
  presets,
  severity,
  suggestions,
  type Machine,
  type Thresholds,
  type Severity,
} from "./simulation";
import { useSimulation, type Sample, type WorkOrder } from "./useSimulation";
const MotorScene = lazy(() => import("./MotorScene"));
const navigation = [
  { name: "Overview", icon: LayoutDashboard },
  { name: "Machines", icon: Cpu },
  { name: "3D Digital Twin", icon: Box },
  { name: "Sensor Trends", icon: Activity },
  { name: "Fault Alerts", icon: Bell },
  { name: "Maintenance Reports", icon: ClipboardList },
  { name: "Simulation Settings", icon: Settings2 },
];
const time = (value: number) =>
  new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
const number = (value: number) =>
  Number.isInteger(value) ? value.toLocaleString() : value.toFixed(1);
function Badge({ value }: { value: Severity }) {
  return (
    <span className={`badge ${value.toLowerCase()}`}>
      <i />
      {value}
    </span>
  );
}
function NumericInput({
  value,
  min,
  max,
  step,
  label,
  id,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  label: string;
  id: string;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setDraft(String(value));
  }, [value]);
  const commit = () => {
    const parsed = draft.trim() === "" ? value : Number(draft);
    const next = Number.isFinite(parsed)
      ? Math.min(max, Math.max(min, parsed))
      : value;
    setDraft(String(next));
    onChange(next);
  };
  return (
    <input
      id={id}
      aria-label={label}
      type="number"
      min={min}
      max={max}
      step={step}
      value={draft}
      onFocus={() => {
        focused.current = true;
      }}
      onChange={(e) => {
        setDraft(e.target.value);
        const parsed = Number(e.target.value);
        if (
          e.target.value !== "" &&
          Number.isFinite(parsed) &&
          parsed >= min &&
          parsed <= max
        )
          onChange(parsed);
      }}
      onBlur={() => {
        focused.current = false;
        commit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
    />
  );
}
function TrendCharts({
  history,
  thresholds,
  expanded = false,
}: {
  history: Sample[];
  thresholds: Thresholds;
  expanded?: boolean;
}) {
  return (
    <div className={`charts ${expanded ? "expanded-charts" : ""}`}>
      {fields
        .filter((f) => f.key !== "load")
        .map((f) => (
          <article className="chart-card" key={f.key}>
            <div className="chart-heading">
              <span>
                <i style={{ background: f.color }} />
                {f.label}
              </span>
              <b>
                {number(history.at(-1)?.[f.key] ?? 0)} <small>{f.unit}</small>
              </b>
            </div>
            <div className="chart-body">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <AreaChart
                  data={history}
                  margin={{ top: 8, right: 5, left: -30, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id={`gradient-${f.key}`}
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor={f.color} stopOpacity={0.2} />
                      <stop offset="100%" stopColor={f.color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    vertical={false}
                    stroke="#263340"
                    strokeDasharray="3 4"
                  />
                  <XAxis
                    dataKey="time"
                    type="number"
                    domain={["dataMin", "dataMax"]}
                    tickFormatter={(v) =>
                      new Date(v).toLocaleTimeString([], {
                        minute: "2-digit",
                        second: "2-digit",
                      })
                    }
                    tick={{ fill: "#728497", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    minTickGap={45}
                  />
                  <YAxis
                    domain={[
                      f.min,
                      Math.max(
                        f.key === "rpm"
                          ? 2000
                          : f.key === "temperature"
                            ? 100
                            : 10,
                        ...history.map((s) => s[f.key]),
                      ),
                    ]}
                    hide
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#15212d",
                      border: "1px solid #31404e",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    labelFormatter={(v) => time(Number(v))}
                    formatter={(v) => [
                      `${number(Number(v))} ${f.unit}`,
                      f.label,
                    ]}
                  />
                  <ReferenceLine
                    y={thresholds[f.key as keyof Thresholds].warning}
                    stroke="#e8b159"
                    strokeDasharray="4 4"
                    ifOverflow="extendDomain"
                  />
                  <Area
                    type="linear"
                    dataKey={f.key}
                    stroke={f.color}
                    strokeWidth={2}
                    fill={`url(#gradient-${f.key})`}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </article>
        ))}
    </div>
  );
}
function WorkOrderDialog({
  order,
  close,
}: {
  order: WorkOrder;
  close: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const download = () => {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            ...order,
            status: "Draft",
            source: "Simulation rules; not a validated prediction model",
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${order.id}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <dialog className="work-order-dialog" ref={dialog} onCancel={close}>
      <div className="work-order">
        <div className="modal-actions">
          <span className="eyebrow">MAINTENANCE OPERATIONS</span>
          <button
            className="icon-button"
            aria-label="Close work order"
            onClick={close}
          >
            <X size={20} />
          </button>
        </div>
        <div className="order-heading">
          <div>
            <h2>Maintenance work order</h2>
            <p>{order.id}</p>
          </div>
          <span className="draft-badge">DRAFT</span>
        </div>
        <p className="simulation-notice">
          Generated from simulation rules. Suggested inspections are not
          confirmed failures or validated predictions.
        </p>
        <div className="order-meta">
          <div>
            <small>ASSET</small>
            <b>{order.machine}</b>
            <span>{order.name}</span>
          </div>
          <div>
            <small>PRIORITY</small>
            <b>{order.priority}</b>
            <Badge value={order.condition} />
          </div>
          <div>
            <small>CREATED</small>
            <b>{new Date(order.time).toLocaleDateString()}</b>
            <span>{time(order.time)}</span>
          </div>
        </div>
        <h3>Readings at generation</h3>
        <div className="order-readings">
          {fields.map((f) => (
            <div key={f.key}>
              <small>{f.label}</small>
              <b>
                {number(order.params[f.key])} {f.unit}
              </b>
            </div>
          ))}
        </div>
        <h3>Detected anomalies & inspection actions</h3>
        {order.anomalies.length ? (
          order.anomalies.map((a) => (
            <div className="order-anomaly" key={a.parameter}>
              <div>
                <b>{a.parameter}</b>
                <Badge value={a.severity} />
              </div>
              <p>
                {a.value} {a.unit} · configured threshold {a.threshold} {a.unit}
              </p>
              <p>{a.action}</p>
            </div>
          ))
        ) : (
          <p>
            No threshold violations. Routine visual inspection of cooling,
            bearings, coupling and electrical connections is suggested for this
            demonstration.
          </p>
        )}
        <div className="modal-footer">
          <button className="button secondary" onClick={download}>
            <ArrowDownToLine size={16} />
            Download JSON
          </button>
          <button className="button primary" onClick={() => window.print()}>
            <ClipboardList size={16} />
            Print / Save PDF
          </button>
        </div>
      </div>
    </dialog>
  );
}
function Settings({
  thresholds,
  save,
}: {
  thresholds: Thresholds;
  save: (t: Thresholds) => void;
}) {
  const [draft, setDraft] = useState(thresholds),
    [message, setMessage] = useState("");
  const valid = fields
    .filter((f) => f.key !== "load")
    .every((f) => {
      const t = draft[f.key as keyof Thresholds];
      return (
        Number.isFinite(t.warning) &&
        Number.isFinite(t.critical) &&
        t.warning >= f.min &&
        t.critical > t.warning &&
        t.critical <= f.max
      );
    });
  return (
    <section className="panel settings-panel">
      <div className="section-heading">
        <div>
          <h2>Diagnostic thresholds</h2>
          <p>Demonstration values, editable for all three machines.</p>
        </div>
        <Settings2 size={22} />
      </div>
      <p className="simulation-notice">
        These are demonstration thresholds, not universal manufacturer
        specifications. Load is a visual indicator and has no diagnostic
        threshold.
      </p>
      <div className="threshold-table">
        <div className="threshold-row table-head">
          <span>Parameter</span>
          <span>Warning threshold</span>
          <span>Critical above</span>
        </div>
        {fields
          .filter((f) => f.key !== "load")
          .map((f) => {
            const key = f.key as keyof Thresholds;
            return (
              <div className="threshold-row" key={key}>
                <b>
                  {f.label} <small>{f.unit}</small>
                </b>
                {(["warning", "critical"] as const).map((level) => (
                  <input
                    key={level}
                    aria-label={`${f.label} ${level} threshold`}
                    type="number"
                    min={f.min}
                    max={f.max}
                    step={f.step}
                    value={
                      Number.isNaN(draft[key][level]) ? "" : draft[key][level]
                    }
                    onChange={(e) => {
                      setDraft({
                        ...draft,
                        [key]: {
                          ...draft[key],
                          [level]:
                            e.target.value === ""
                              ? NaN
                              : Number(e.target.value),
                        },
                      });
                      setMessage("");
                    }}
                  />
                ))}
              </div>
            );
          })}
      </div>
      <p className="muted">
        Temperature, vibration and current warn at the warning value. RPM warns
        above it. Critical always means above the critical value.
      </p>
      {!valid && (
        <p className="error-text">
          Enter values within each parameter’s range, with critical greater than
          warning.
        </p>
      )}
      <div className="settings-actions">
        <button
          className="button secondary"
          onClick={() => {
            setDraft(structuredClone(defaultThresholds));
            setMessage("Defaults loaded. Apply to activate.");
          }}
        >
          Restore defaults
        </button>
        <button
          className="button primary"
          disabled={!valid}
          onClick={() => {
            save(draft);
            setMessage(
              "Thresholds applied. All diagnostics have been recalculated.",
            );
          }}
        >
          Apply thresholds
        </button>
        <span role="status">{message}</span>
      </div>
    </section>
  );
}
export default function App() {
  const sim = useSimulation();
  const [page, setPage] = useState("3D Digital Twin"),
    [selected, setSelected] = useState("MOTOR-01");
  const [thermal, setThermal] = useState(false),
    [cutaway, setCutaway] = useState(false),
    [view, setView] = useState("Isometric"),
    [viewTick, setViewTick] = useState(0),
    [wide, setWide] = useState(false);
  const [order, setOrder] = useState<WorkOrder | null>(null),
    [alertFilter, setAlertFilter] = useState("All machines");
  const machine = sim.machines.find((m) => m.id === selected)!;
  const status = condition(machine.params, sim.thresholds);
  const active = machine.power && machine.running;
  const violations = fields.filter(
    (f) => severity(f.key, machine.params[f.key], sim.thresholds) !== "Normal",
  );
  const openOrder = () => setOrder(sim.generateOrder(selected));
  const summaries = [
    "Total Machines",
    "Normal Machines",
    "Warning Machines",
    "Critical Machines",
  ];
  const machineCard = (m: Machine) => {
    const s = condition(m.params, sim.thresholds);
    return (
      <button
        className={`machine-card ${selected === m.id ? "selected" : ""}`}
        key={m.id}
        onClick={() => {
          setSelected(m.id);
          if (page === "Machines") setPage("3D Digital Twin");
        }}
        aria-pressed={selected === m.id}
      >
        <div className="machine-card-top">
          <span className="asset-icon">
            <Cpu size={22} />
          </span>
          <div>
            <span className="machine-id">
              {m.id} <span>· IE3 MOTOR</span>
            </span>
            <h3>{m.name}</h3>
          </div>
          <ChevronRight size={16} />
        </div>
        <div className="machine-card-bottom">
          <Badge value={s} />
          <span>
            <b>{number(m.params.rpm)}</b> RPM
          </span>
          <span>
            <b>{number(m.params.temperature)}</b> °C
          </span>
        </div>
        <div className={`health-line ${s.toLowerCase()}`}>
          <i />
        </div>
      </button>
    );
  };
  const alertList = (compact = false) => {
    const list = sim.alerts.filter(
      (a) => alertFilter === "All machines" || a.machine === alertFilter,
    );
    return (
      <div className="alert-list">
        {!list.length && (
          <div className="empty-state">
            <ShieldCheck size={30} />
            <h3>No threshold crossings recorded</h3>
            <p>
              Adjust a parameter or apply a preset to create an event. Current
              conditions are shown in diagnostics.
            </p>
          </div>
        )}
        {list.slice(0, compact ? 4 : 500).map((a) => (
          <article
            className={`alert-row ${a.severity.toLowerCase()}`}
            key={a.id}
          >
            <span className="alert-symbol">
              {a.severity === "Normal" ? (
                <ShieldCheck size={18} />
              ) : (
                <TriangleAlert size={18} />
              )}
            </span>
            <div>
              <b>
                {a.machine} · {fields.find((f) => f.key === a.parameter)?.label}{" "}
                {a.severity === "Normal" ? "recovered" : "threshold exceeded"}
              </b>
              <p>
                {number(a.value)}{" "}
                {fields.find((f) => f.key === a.parameter)?.unit} · Threshold{" "}
                {a.threshold} · {a.action}
              </p>
            </div>
            <div className="alert-time">
              <Badge value={a.severity} />
              <time>{time(a.time)}</time>
            </div>
          </article>
        ))}
      </div>
    );
  };
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPage("Overview");
          }}
        >
          <span className="brand-symbol">
            <Box size={27} />
          </span>
          <div>
            AXIOM<span>INDUSTRIAL INTELLIGENCE</span>
          </div>
        </a>
        <div className="workspace-label">
          <span className="workspace-mark">D</span>
          <div>
            DEV-P04 Portal<small>Simulation workspace</small>
          </div>
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {navigation.map((n) => (
            <button
              key={n.name}
              className={page === n.name ? "nav-item active" : "nav-item"}
              onClick={() => setPage(n.name)}
            >
              <n.icon size={18} />
              <span>{n.name}</span>
              {n.name === "3D Digital Twin" && (
                <span className="nav-new">3D</span>
              )}
              {n.name === "Fault Alerts" && sim.alerts.length > 0 && (
                <span className="nav-count">{sim.alerts.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sandbox-card">
            <span>
              <i />
              SIMULATION MODE
            </span>
            <p>
              A virtual environment.
              <br />
              Real engineering insight.
            </p>
            <small>Manual inputs · Rule-based diagnostics</small>
          </div>
          <div className="profile">
            <span>DE</span>
            <div>
              Demo Engineer<small>Local workspace</small>
            </div>
            <Settings2 size={16} />
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <ChevronRight size={13} /> <span>{page}</span>
          </div>
          <div className="topbar-right">
            <span className="offline-pill">
              <i />
              LOCAL SIMULATION
            </span>
            <button
              aria-label="View alerts"
              className="icon-button"
              onClick={() => setPage("Fault Alerts")}
            >
              <Bell size={18} />
              {sim.alerts.length > 0 && <i className="notification-dot" />}
            </button>
            <span className="avatar">DE</span>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                PREDICTIVE MAINTENANCE PORTAL / DEV-P04
              </div>
              <h1>
                {page === "3D Digital Twin" ? "Industrial Digital Twin" : page}
              </h1>
              <p>
                {page === "3D Digital Twin"
                  ? "Explore, control and diagnose your virtual production floor."
                  : "A complete view of your simulated production environment."}
              </p>
            </div>
            <div className="heading-badge">
              <span className="live-dot" /> Simulation active{" "}
              <span className="divider" /> v1.0
            </div>
          </div>
          <div className="summary-grid">
            {summaries.map((label, i) => {
              const count =
                i === 0
                  ? 3
                  : sim.machines.filter(
                      (m) =>
                        condition(m.params, sim.thresholds) ===
                        ["", "Normal", "Warning", "Critical"][i],
                    ).length;
              const Icon = [Cpu, ShieldCheck, TriangleAlert, Activity][i];
              return (
                <article key={label} className={`summary-card summary-${i}`}>
                  <span className="summary-icon">
                    <Icon size={20} />
                  </span>
                  <div>
                    <span>{label}</span>
                    <b>{String(count).padStart(2, "0")}</b>
                  </div>
                  <small>
                    {
                      [
                        "Virtual assets",
                        "Within thresholds",
                        "Needs attention",
                        "Inspect immediately",
                      ][i]
                    }
                  </small>
                </article>
              );
            })}
          </div>
          {[
            "3D Digital Twin",
            "Overview",
            "Machines",
            "Sensor Trends",
          ].includes(page) && (
            <>
              <div className="section-label">
                <h2>
                  {page === "Machines"
                    ? "Virtual machine fleet"
                    : "Select machine"}
                </h2>
                <span>
                  03 ASSETS <span className="muted">/ PRODUCTION FLOOR</span>
                </span>
              </div>
              <div className="machine-grid">
                {sim.machines.map(machineCard)}
              </div>
            </>
          )}
          {page === "3D Digital Twin" && (
            <>
              <div className={`twin-layout ${wide ? "wide" : ""}`}>
                <section className="panel viewer-panel">
                  <div className="panel-toolbar">
                    <div>
                      <Box size={18} />
                      <b>{machine.name}</b>
                      <span className="subtle-label">DIGITAL TWIN</span>
                    </div>
                    <button
                      className="icon-button"
                      aria-label={wide ? "Exit expanded view" : "Expand viewer"}
                      onClick={() => setWide(!wide)}
                    >
                      <Maximize2 size={17} />
                    </button>
                  </div>
                  <div className="scene-container">
                    <Suspense
                      fallback={
                        <div className="webgl-fallback">Loading 3D engine…</div>
                      }
                    >
                      <MotorScene
                        machine={machine}
                        thresholds={sim.thresholds}
                        thermal={thermal}
                        cutaway={cutaway}
                        view={view}
                        viewTick={viewTick}
                      />
                    </Suspense>
                    <div className="scene-top">
                      <span
                        className={`running-tag ${active ? "" : "stopped"}`}
                      >
                        <i />
                        {!machine.power
                          ? "POWER OFF"
                          : !machine.running
                            ? "STOPPED"
                            : machine.paused
                              ? "ANIMATION PAUSED"
                              : "MOTOR RUNNING"}
                      </span>
                      <Badge value={status} />
                    </div>
                    <div className="scene-spec">
                      <span>{machine.id}</span>
                      <b>3-PHASE INDUCTION MOTOR</b>
                      <small>
                        Procedural model · Simulated instrumentation
                      </small>
                    </div>
                    <div className="scene-instruments">
                      <span>
                        <Gauge size={15} />
                        {number(machine.params.rpm)} <small>RPM</small>
                      </span>
                      <span>
                        <Zap size={15} />
                        {number(machine.params.current)} <small>A</small>
                      </span>
                      <span>
                        <Thermometer size={15} />
                        {number(machine.params.temperature)} <small>°C</small>
                      </span>
                    </div>
                    <div className="scene-hint">
                      <Expand size={13} />
                      Drag to orbit <span>·</span> Scroll to zoom
                    </div>
                  </div>
                  <div className="viewer-controls">
                    <div className="camera-tabs">
                      {["Isometric", "Front", "Side", "Top"].map((v) => (
                        <button
                          className={view === v ? "active" : ""}
                          key={v}
                          onClick={() => {
                            setView(v);
                            setViewTick((t) => t + 1);
                          }}
                        >
                          {v}
                        </button>
                      ))}
                      <button
                        title="Reset camera"
                        aria-label="Reset camera"
                        onClick={() => {
                          setView("Isometric");
                          setViewTick((t) => t + 1);
                        }}
                      >
                        <RotateCcw size={14} />
                      </button>
                    </div>
                    <div className="view-toggles">
                      <button
                        className={thermal ? "toggle active" : "toggle"}
                        aria-pressed={thermal}
                        onClick={() => setThermal(!thermal)}
                      >
                        <Thermometer size={14} />
                        Thermal
                      </button>
                      <button
                        className={cutaway ? "toggle active" : "toggle"}
                        aria-pressed={cutaway}
                        onClick={() => setCutaway(!cutaway)}
                      >
                        <Box size={14} />
                        Cutaway
                      </button>
                    </div>
                  </div>
                  <div className="preset-bar">
                    <span className="eyebrow">QUICK SCENARIOS</span>
                    <div>
                      {presets.map((p, i) => (
                        <button
                          key={p.name}
                          title={p.name}
                          aria-label={p.name}
                          onClick={() => sim.preset(selected, p.params)}
                        >
                          <span className={`preset-dot preset-${i}`} />
                          {p.short}
                        </button>
                      ))}
                    </div>
                  </div>
                </section>
                <section className="panel control-panel">
                  <div className="panel-toolbar">
                    <div>
                      <SlidersHorizontal size={18} />
                      <b>Live parameters</b>
                    </div>
                    <span className="manual-tag">MANUAL</span>
                  </div>
                  <div className="power-row">
                    <div>
                      <span
                        className={`power-icon ${machine.power ? "on" : ""}`}
                      >
                        <Power size={17} />
                      </span>
                      <div>
                        <b>Motor power</b>
                        <small>Values retained when off</small>
                      </div>
                    </div>
                    <button
                      className={`switch ${machine.power ? "on" : ""}`}
                      role="switch"
                      aria-checked={machine.power}
                      aria-label="Motor power"
                      onClick={() =>
                        sim.patch(selected, { power: !machine.power })
                      }
                    >
                      <span />
                    </button>
                  </div>
                  <div className="parameters">
                    {fields.map((f, i) => {
                      const value = machine.params[f.key],
                        level = severity(f.key, value, sim.thresholds);
                      const Icon = [Gauge, Thermometer, Waves, Zap, Activity][
                        i
                      ];
                      return (
                        <div className="parameter" key={f.key}>
                          <div className="parameter-heading">
                            <label htmlFor={`number-${f.key}`}>
                              <Icon size={14} />
                              {f.label}
                            </label>
                            <div
                              className={`number-field ${level.toLowerCase()}`}
                            >
                              <NumericInput
                                key={`${selected}-${f.key}`}
                                id={`number-${f.key}`}
                                label={f.label}
                                min={f.min}
                                max={f.max}
                                step={f.step}
                                value={value}
                                onChange={(v) =>
                                  sim.setParam(selected, f.key, v)
                                }
                              />
                              <span>{f.unit}</span>
                            </div>
                          </div>
                          <input
                            aria-label={`${f.label} slider`}
                            type="range"
                            min={f.min}
                            max={f.max}
                            step={f.step}
                            value={value}
                            style={
                              {
                                "--fill": `${((value - f.min) / (f.max - f.min)) * 100}%`,
                                "--range-color":
                                  level === "Critical"
                                    ? "#f27777"
                                    : level === "Warning"
                                      ? "#e9b45e"
                                      : f.color,
                              } as React.CSSProperties
                            }
                            onChange={(e) =>
                              sim.setParam(
                                selected,
                                f.key,
                                Number(e.target.value),
                              )
                            }
                          />
                          <div className="range-labels">
                            <span>
                              {f.min} {f.unit}
                            </span>
                            <span>
                              {f.max} {f.unit}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="motor-actions">
                    <button
                      className="button primary"
                      disabled={!machine.power || machine.running}
                      onClick={() =>
                        sim.patch(selected, { running: true, paused: false })
                      }
                    >
                      <Play size={14} />
                      Start
                    </button>
                    <button
                      className="button secondary"
                      disabled={!machine.running}
                      onClick={() => sim.patch(selected, { running: false })}
                    >
                      <Square size={12} />
                      Stop
                    </button>
                    <button
                      className="button secondary"
                      aria-label={
                        machine.paused ? "Resume animation" : "Pause animation"
                      }
                      aria-pressed={machine.paused}
                      onClick={() =>
                        sim.patch(selected, { paused: !machine.paused })
                      }
                    >
                      {machine.paused ? (
                        <Play size={14} />
                      ) : (
                        <Pause size={14} />
                      )}
                    </button>
                    <button
                      className="button secondary"
                      aria-label="Reset to default"
                      title="Reset to default"
                      onClick={() => sim.reset(selected)}
                    >
                      <RotateCcw size={14} />
                    </button>
                  </div>
                  <p className="control-note">
                    <CircleHelp size={12} />
                    Each parameter is independently controlled.
                  </p>
                </section>
              </div>
              <section className="diagnostic-strip">
                <span className={`diagnostic-icon ${status.toLowerCase()}`}>
                  {status === "Normal" ? (
                    <ShieldCheck size={20} />
                  ) : (
                    <TriangleAlert size={20} />
                  )}
                </span>
                <div>
                  <b>
                    {status === "Normal"
                      ? "All readings within configured thresholds"
                      : `${violations.length} active threshold ${violations.length === 1 ? "violation" : "violations"}`}
                  </b>
                  <p>
                    {violations.length
                      ? violations
                          .map((f) => suggestions[f.key as keyof Thresholds])
                          .join(" ")
                      : "Rule-based monitoring is active. Adjust the controls or run a scenario to explore fault behavior."}
                  </p>
                </div>
                <button className="button secondary" onClick={openOrder}>
                  <ClipboardList size={15} />
                  Generate Maintenance Work Order
                  <ArrowUpRight size={14} />
                </button>
              </section>
            </>
          )}
          {["3D Digital Twin", "Overview", "Sensor Trends"].includes(page) && (
            <section className="trends-section">
              <div className="section-label">
                <h2>
                  Live sensor trends <span className="live-tag">LIVE</span>
                </h2>
                <span>
                  {selected}{" "}
                  <span className="muted">
                    / ROLLING 120 SECONDS · 1 Hz + MANUAL CHANGES
                  </span>
                </span>
              </div>
              <TrendCharts
                history={sim.history[selected] || []}
                thresholds={sim.thresholds}
                expanded={page === "Sensor Trends"}
              />
            </section>
          )}
          {page === "Machines" && (
            <section className="panel fleet-details">
              <div className="section-heading">
                <h2>Asset operating state</h2>
                <span>Independent virtual machines</span>
              </div>
              {sim.machines.map((m) => (
                <div className="fleet-row" key={m.id}>
                  <b>{m.id}</b>
                  <span>
                    {m.power
                      ? m.running
                        ? "Running"
                        : "Stopped"
                      : "Power off"}
                  </span>
                  <span>Load {m.params.load}%</span>
                  <span>Current {m.params.current} A</span>
                  <span>Vibration {m.params.vibration} mm/s</span>
                  <button
                    className="button secondary"
                    onClick={() => {
                      setSelected(m.id);
                      setPage("3D Digital Twin");
                    }}
                  >
                    Inspect machine
                    <ArrowUpRight size={14} />
                  </button>
                </div>
              ))}
            </section>
          )}
          {["Overview", "Fault Alerts"].includes(page) && (
            <section className="panel events-panel">
              <div className="section-heading">
                <div>
                  <h2>
                    {page === "Overview"
                      ? "Recent events"
                      : "Threshold event history"}
                  </h2>
                  <p>
                    Events are recorded on severity changes. Latest 500 events
                    in this session.
                  </p>
                </div>
                <select
                  aria-label="Filter alerts by machine"
                  value={alertFilter}
                  onChange={(e) => setAlertFilter(e.target.value)}
                >
                  {["All machines", ...sim.machines.map((m) => m.id)].map(
                    (v) => (
                      <option key={v}>{v}</option>
                    ),
                  )}
                </select>
              </div>
              {alertList(page === "Overview")}
            </section>
          )}
          {page === "Maintenance Reports" && (
            <section className="panel reports-panel">
              <div className="section-heading">
                <div>
                  <h2>Draft work orders</h2>
                  <p>
                    Inspection plans generated from simulation rules. Retained
                    for this session.
                  </p>
                </div>
                <button className="button primary" onClick={openOrder}>
                  <ClipboardList size={16} />
                  Generate for {selected}
                </button>
              </div>
              {!sim.orders.length ? (
                <div className="empty-state">
                  <ClipboardList size={35} />
                  <h3>No work orders yet</h3>
                  <p>
                    Generate a draft from the selected machine’s current
                    condition.
                  </p>
                </div>
              ) : (
                sim.orders.map((o) => (
                  <button
                    className="report-row"
                    key={o.id}
                    onClick={() => setOrder(o)}
                  >
                    <span className="report-icon">
                      <ClipboardList size={20} />
                    </span>
                    <div>
                      <b>{o.id}</b>
                      <p>
                        {o.machine} · {o.priority} · {time(o.time)}
                      </p>
                    </div>
                    <Badge value={o.condition} />
                    <span className="draft-badge">DRAFT</span>
                    <ChevronRight size={18} />
                  </button>
                ))
              )}
            </section>
          )}
          {page === "Simulation Settings" && (
            <Settings thresholds={sim.thresholds} save={sim.configure} />
          )}
          <footer>
            <span>
              <ShieldCheck size={13} />
              SOFTWARE SIMULATION · Manual inputs · Deterministic rules
            </span>
            <span>Not a validated real-world prediction model</span>
          </footer>
        </main>
      </div>
      {order && <WorkOrderDialog order={order} close={() => setOrder(null)} />}
    </div>
  );
}

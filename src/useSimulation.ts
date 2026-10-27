import { useEffect, useRef, useState } from "react";
import {
  condition,
  crossings,
  defaults,
  defaultThresholds,
  fields,
  restoreMachines,
  severity,
  suggestions,
  type Alert,
  type Key,
  type Machine,
  type Params,
  type Thresholds,
  type Severity,
} from "./simulation";
export type Sample = Params & { time: number };
export type WorkOrder = {
  id: string;
  machine: string;
  name: string;
  condition: Severity;
  priority: string;
  time: number;
  params: Params;
  anomalies: {
    parameter: string;
    value: number;
    unit: string;
    threshold: number;
    severity: Severity;
    action: string;
  }[];
};
function read<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
}
function loadThresholds(): Thresholds {
  const stored = read<Thresholds>("axiom-thresholds", defaultThresholds);
  return Object.fromEntries(
    Object.entries(defaultThresholds).map(([key, value]) => {
      const candidate = stored?.[key as keyof Thresholds],
        f = fields.find((f) => f.key === key)!;
      return [
        key,
        candidate &&
        Number.isFinite(candidate.warning) &&
        Number.isFinite(candidate.critical) &&
        candidate.warning >= f.min &&
        candidate.critical > candidate.warning &&
        candidate.critical <= f.max
          ? candidate
          : value,
      ];
    }),
  ) as Thresholds;
}
export function useSimulation() {
  const [machines, setMachines] = useState(restoreMachines);
  const [thresholds, setThresholds] = useState(loadThresholds);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [history, setHistory] = useState<Record<string, Sample[]>>(() =>
    Object.fromEntries(
      machines.map((m) => [m.id, [{ ...m.params, time: Date.now() }]]),
    ),
  );
  const machineRef = useRef(machines),
    thresholdRef = useRef(thresholds);
  const transitions = useRef<Record<string, ReturnType<typeof setInterval>>>(
    {},
  );
  const sample = (next: Machine[]) => {
    const now = Date.now();
    setHistory((prev) =>
      Object.fromEntries(
        next.map((m) => {
          const samples = (prev[m.id] || []).filter(
            (s) => s.time >= now - 120000,
          );
          // Coalesce rapid changes into 100 ms buckets, preserving the full time window.
          if (
            samples.length &&
            Math.floor(samples[samples.length - 1].time / 100) ===
              Math.floor(now / 100)
          )
            samples.pop();
          return [m.id, [...samples, { ...m.params, time: now }]];
        }),
      ),
    );
  };
  const commit = (next: Machine[], t = thresholdRef.current) => {
    const events = next.flatMap((m, i) =>
      crossings(machineRef.current[i], m, thresholdRef.current, t),
    );
    if (events.length)
      setAlerts((prev) => [...events.reverse(), ...prev].slice(0, 500));
    machineRef.current = next;
    thresholdRef.current = t;
    setMachines(next);
    setThresholds(t);
    sample(next);
  };
  const cancelPreset = (id: string) => {
    clearInterval(transitions.current[id]);
    delete transitions.current[id];
  };
  const patch = (id: string, update: Partial<Machine>) =>
    commit(
      machineRef.current.map((m) => (m.id === id ? { ...m, ...update } : m)),
    );
  const setParam = (id: string, key: Key, value: number) => {
    if (!Number.isFinite(value)) return;
    cancelPreset(id);
    const field = fields.find((f) => f.key === key)!;
    const m = machineRef.current.find((m) => m.id === id)!;
    patch(id, {
      params: {
        ...m.params,
        [key]: Math.min(field.max, Math.max(field.min, value)),
      },
    });
  };
  const preset = (id: string, params: Params) => {
    cancelPreset(id);
    const from = { ...machineRef.current.find((m) => m.id === id)!.params },
      start = performance.now();
    transitions.current[id] = setInterval(() => {
      const progress = Math.min(1, (performance.now() - start) / 900),
        eased = progress * progress * (3 - 2 * progress);
      const next = Object.fromEntries(
        fields.map((f) => [
          f.key,
          progress === 1
            ? params[f.key]
            : Math.round(
                (from[f.key] + (params[f.key] - from[f.key]) * eased) * 10,
              ) / 10,
        ]),
      ) as Params;
      patch(id, { params: next });
      if (progress === 1) cancelPreset(id);
    }, 75);
  };
  const reset = (id: string) => {
    cancelPreset(id);
    const i = machineRef.current.findIndex((m) => m.id === id);
    patch(id, {
      params: { ...defaults[i] },
      power: true,
      running: true,
      paused: false,
    });
  };
  const configure = (t: Thresholds) => commit(machineRef.current, t);
  const generateOrder = (id: string) => {
    const m = machineRef.current.find((m) => m.id === id)!,
      t = thresholdRef.current;
    const state = condition(m.params, t);
    const order: WorkOrder = {
      id: `WO-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`,
      machine: m.id,
      name: m.name,
      condition: state,
      priority:
        state === "Critical"
          ? "Urgent inspection"
          : state === "Warning"
            ? "Scheduled inspection"
            : "Routine inspection",
      time: Date.now(),
      params: { ...m.params },
      anomalies: fields
        .filter(
          (f) =>
            f.key !== "load" &&
            severity(f.key, m.params[f.key], t) !== "Normal",
        )
        .map((f) => {
          const key = f.key as keyof Thresholds,
            level = severity(key, m.params[key], t);
          return {
            parameter: f.label,
            value: m.params[key],
            unit: f.unit,
            threshold: level === "Critical" ? t[key].critical : t[key].warning,
            severity: level,
            action: suggestions[key],
          };
        }),
    };
    setOrders((prev) => [order, ...prev].slice(0, 100));
    return order;
  };
  useEffect(() => {
    const timer = setInterval(() => sample(machineRef.current), 1000);
    return () => {
      clearInterval(timer);
      Object.values(transitions.current).forEach(clearInterval);
    };
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem("axiom-machines", JSON.stringify(machines));
        localStorage.setItem("axiom-thresholds", JSON.stringify(thresholds));
      } catch {
        /* Private browsing may disallow storage; simulation still works. */
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [machines, thresholds]);
  return {
    machines,
    thresholds,
    alerts,
    orders,
    history,
    setParam,
    patch,
    preset,
    reset,
    configure,
    generateOrder,
  };
}

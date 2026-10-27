import { afterEach, describe, expect, it, vi } from "vitest";
import {
  condition,
  crossings,
  defaultThresholds,
  defaults,
  makeMachines,
  presets,
  restoreMachines,
  severity,
  type Key,
} from "./simulation";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("demonstration threshold boundaries", () => {
  it.each<[Key, number, string]>([
    ["temperature", 69.9, "Normal"],
    ["temperature", 70, "Warning"],
    ["temperature", 90, "Warning"],
    ["temperature", 90.1, "Critical"],
    ["vibration", 3.9, "Normal"],
    ["vibration", 4, "Warning"],
    ["vibration", 8, "Warning"],
    ["vibration", 8.1, "Critical"],
    ["current", 11.9, "Normal"],
    ["current", 12, "Warning"],
    ["current", 18, "Warning"],
    ["current", 18.1, "Critical"],
    ["rpm", 0, "Normal"],
    ["rpm", 3000, "Normal"],
    ["rpm", 3001, "Warning"],
    ["rpm", 4000, "Warning"],
    ["rpm", 4001, "Critical"],
    ["load", 100, "Normal"],
  ])("%s at %s is %s", (key, value, expected) => {
    expect(severity(key, value, defaultThresholds)).toBe(expected);
  });

  it("uses the highest violation for overall machine condition", () => {
    expect(
      makeMachines().map((m) => condition(m.params, defaultThresholds)),
    ).toEqual(["Normal", "Normal", "Warning"]);
    expect(
      condition({ ...defaults[2], temperature: 110 }, defaultThresholds),
    ).toBe("Critical");
    expect(condition({ ...defaults[0], load: 100 }, defaultThresholds)).toBe(
      "Normal",
    );
  });

  it("uses edited thresholds rather than hard-coded limits", () => {
    const thresholds = {
      ...defaultThresholds,
      temperature: { warning: 100, critical: 120 },
    };
    expect(severity("temperature", 95, thresholds)).toBe("Normal");
    expect(severity("temperature", 110, thresholds)).toBe("Warning");
    expect(severity("temperature", 121, thresholds)).toBe("Critical");
  });
});

describe("meaningful alert events", () => {
  it("records the measured value, exceeded threshold, timestamp, machine and inspection action", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-27T06:00:00Z"));
    const before = makeMachines()[0];
    const after = { ...before, params: { ...before.params, temperature: 110 } };
    const events = crossings(
      before,
      after,
      defaultThresholds,
      defaultThresholds,
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      machine: "MOTOR-01",
      parameter: "temperature",
      value: 110,
      threshold: 90,
      severity: "Critical",
      time: Date.now(),
    });
    expect(events[0].id).toBeTruthy();
    expect(events[0].action).toContain("cooling system");
    expect(before.params.temperature).toBe(45);
  });

  it("does not duplicate alerts for unchanged readings or changes inside a severity band", () => {
    const before = makeMachines()[0];
    const critical = {
      ...before,
      params: { ...before.params, temperature: 110 },
    };
    expect(
      crossings(critical, critical, defaultThresholds, defaultThresholds),
    ).toEqual([]);
    expect(
      crossings(
        critical,
        { ...critical, params: { ...critical.params, temperature: 120 } },
        defaultThresholds,
        defaultThresholds,
      ),
    ).toEqual([]);
  });

  it("records warning escalation, critical de-escalation and recovery", () => {
    const normal = makeMachines()[0];
    const warning = { ...normal, params: { ...normal.params, vibration: 6 } };
    const critical = { ...normal, params: { ...normal.params, vibration: 10 } };
    expect(
      crossings(normal, warning, defaultThresholds, defaultThresholds)[0]
        .severity,
    ).toBe("Warning");
    expect(
      crossings(warning, critical, defaultThresholds, defaultThresholds)[0]
        .severity,
    ).toBe("Critical");
    expect(
      crossings(critical, warning, defaultThresholds, defaultThresholds)[0]
        .severity,
    ).toBe("Warning");
    expect(
      crossings(critical, normal, defaultThresholds, defaultThresholds)[0],
    ).toMatchObject({
      parameter: "vibration",
      severity: "Normal",
      threshold: 4,
      action: "Parameter returned to normal operating range.",
    });
  });

  it("reevaluates current readings when configured thresholds change", () => {
    const machine = makeMachines()[0];
    const thresholds = {
      ...defaultThresholds,
      temperature: { warning: 35, critical: 40 },
    };
    expect(
      crossings(machine, machine, defaultThresholds, thresholds)[0],
    ).toMatchObject({
      parameter: "temperature",
      value: 45,
      threshold: 40,
      severity: "Critical",
    });
    expect(
      crossings(machine, machine, thresholds, defaultThresholds)[0].severity,
    ).toBe("Normal");
  });

  it("creates one event per changed fault parameter in a multi-fault preset", () => {
    const before = makeMachines()[0];
    const after = { ...before, params: { ...presets[3].params } };
    const events = crossings(
      before,
      after,
      defaultThresholds,
      defaultThresholds,
    );
    expect(events).toHaveLength(4);
    expect(new Set(events.map((e) => e.id)).size).toBe(4);
    expect(events.every((e) => e.severity === "Critical")).toBe(true);
    expect(events.map((e) => e.parameter).sort()).toEqual([
      "current",
      "rpm",
      "temperature",
      "vibration",
    ]);
  });
});

describe("independent machine configurations", () => {
  it("does not share parameter objects between machines, resets, or presets", () => {
    const machines = makeMachines();
    const second = { ...machines[1].params };
    const third = { ...machines[2].params };
    machines[0].params.rpm = 4500;
    machines[0].params.temperature = 110;
    expect(machines[1].params).toEqual(second);
    expect(machines[2].params).toEqual(third);
    expect(defaults[0].rpm).toBe(1800);
    expect(makeMachines()[0].params.temperature).toBe(45);
    expect(presets[0].params.temperature).toBe(45);
  });

  it("keeps manually configured parameters independent", () => {
    const machine = makeMachines()[0];
    const original = { ...machine.params };
    machine.params.load = 100;
    expect(machine.params).toEqual({ ...original, load: 100 });
  });
});

describe("local configuration restoration", () => {
  it("falls back safely for missing, malformed or unavailable storage", () => {
    for (const value of [null, "{broken json", "{}", "[]"]) {
      vi.stubGlobal("localStorage", { getItem: () => value });
      expect(restoreMachines()).toEqual(makeMachines());
    }
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("Storage disabled");
      },
    });
    expect(restoreMachines()).toEqual(makeMachines());
  });

  it("restores bounded values and power state without restoring invalid identity or pause state", () => {
    const stored = makeMachines();
    stored[0] = {
      ...stored[0],
      id: "untrusted",
      power: false,
      running: false,
      paused: true,
      params: {
        rpm: 9000,
        temperature: 0,
        vibration: 10,
        current: 22,
        load: 95,
      },
    };
    vi.stubGlobal("localStorage", { getItem: () => JSON.stringify(stored) });
    const restored = restoreMachines();
    expect(restored[0]).toMatchObject({
      id: "MOTOR-01",
      power: false,
      running: false,
      paused: false,
      params: {
        rpm: 5000,
        temperature: 20,
        vibration: 10,
        current: 22,
        load: 95,
      },
    });
    expect(restored[1]).toEqual(makeMachines()[1]);
  });

  it("replaces invalid parameter types individually while preserving valid readings", () => {
    const stored = makeMachines();
    const serialized = JSON.parse(JSON.stringify(stored));
    serialized[0].params.temperature = "110";
    serialized[0].params.current = null;
    serialized[0].params.rpm = 2400;
    vi.stubGlobal("localStorage", {
      getItem: () => JSON.stringify(serialized),
    });
    expect(restoreMachines()[0].params).toEqual({ ...defaults[0], rpm: 2400 });
  });
});

import { test, expect } from "@playwright/test";

test("full demonstration: independent readings, critical events, report, recovery and persistence", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
  await expect(
    page.getByLabel("Rotational speed", { exact: true }),
  ).toHaveValue("1800");
  await page.getByLabel("Rotational speed", { exact: true }).fill("4000");
  await page.getByLabel("Temperature", { exact: true }).fill("");
  await page
    .getByLabel("Temperature", { exact: true })
    .pressSequentially("110");
  await page.getByLabel("Vibration", { exact: true }).fill("10");
  await expect(page.getByText("3 active threshold violations")).toBeVisible();
  await expect(
    page.getByLabel("Electrical current", { exact: true }),
  ).toHaveValue("6");
  await expect(page.getByLabel("Machine load", { exact: true })).toHaveValue(
    "40",
  );
  await page.getByRole("button", { name: "Thermal", exact: true }).click();
  await page.getByRole("button", { name: "Cutaway", exact: true }).click();
  for (const name of ["Front", "Side", "Top", "Isometric"])
    await page.getByRole("button", { name, exact: true }).click();
  await page.getByRole("button", { name: "Pause animation" }).click();
  await expect(
    page.getByText("ANIMATION PAUSED", { exact: true }),
  ).toBeVisible();
  await page.getByRole("switch", { name: "Motor power" }).click();
  await expect(page.getByText("POWER OFF", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Temperature", { exact: true })).toHaveValue(
    "110",
  );
  await page.getByRole("switch", { name: "Motor power" }).click();
  await page.getByRole("button", { name: "Resume animation" }).click();
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  await expect(page.getByText("STOPPED", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page
    .getByRole("button", { name: /Generate Maintenance Work Order/ })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("dialog").getByText("Urgent inspection"),
  ).toBeVisible();
  await expect(page.getByRole("dialog").locator(".order-anomaly")).toHaveCount(
    3,
  );
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download JSON" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^WO-.*\.json$/);
  await page.getByRole("button", { name: "Close work order" }).click();
  await page.locator(".machine-card").filter({ hasText: "MOTOR-02" }).click();
  await expect(page.getByLabel("Temperature", { exact: true })).toHaveValue(
    "65",
  );
  await expect(
    page.getByLabel("Rotational speed", { exact: true }),
  ).toHaveValue("2500");
  await page.locator(".machine-card").filter({ hasText: "MOTOR-01" }).click();
  await expect(page.getByLabel("Temperature", { exact: true })).toHaveValue(
    "110",
  );
  await page.getByRole("button", { name: "Reset to default" }).click();
  await expect(page.getByLabel("Temperature", { exact: true })).toHaveValue(
    "45",
  );
  await page.getByRole("button", { name: /Fault Alerts/ }).click();
  await expect(page.locator(".alert-row")).toHaveCount(6);
  await expect(
    page.getByText("MOTOR-01 · Temperature recovered"),
  ).toBeVisible();
  await page.waitForTimeout(1200);
  await expect(page.locator(".alert-row")).toHaveCount(6);
  await page.getByRole("button", { name: /3D Digital Twin/ }).click();
  await page
    .getByRole("button", { name: "Critical multi-fault", exact: true })
    .click();
  await expect(page.getByLabel("Temperature", { exact: true })).toHaveValue(
    "120",
  );
  await page.getByLabel("Temperature", { exact: true }).fill("50");
  await page.waitForTimeout(200);
  await page.reload();
  await expect(page.getByLabel("Temperature", { exact: true })).toHaveValue(
    "50",
  );
  await expect(
    page.getByLabel("Rotational speed", { exact: true }),
  ).toHaveValue("4500");
  expect(errors).toEqual([]);
});

test("editable thresholds recalculate diagnostics and reject invalid ranges", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Simulation Settings" }).click();
  await page.getByLabel("Temperature warning threshold").fill("40");
  await page.getByLabel("Temperature critical threshold").fill("44");
  await page.getByRole("button", { name: "Apply thresholds" }).click();
  await expect(page.getByRole("status")).toContainText("Thresholds applied");
  await page.getByLabel("Temperature critical threshold").fill("39");
  await expect(
    page.getByRole("button", { name: "Apply thresholds" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: /Fault Alerts/ }).click();
  await expect(page.locator(".alert-row")).toHaveCount(3);
  await page
    .getByRole("combobox", { name: "Filter alerts by machine" })
    .selectOption("MOTOR-01");
  await expect(page.locator(".alert-row")).toHaveCount(1);
  await expect(page.locator(".alert-row")).toContainText("Critical");
});

test("responsive layout, navigation and no-WebGL controls", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      type: string,
      ...args: unknown[]
    ) {
      if (type.includes("webgl")) return null;
      return original.apply(this, [type, ...args] as never);
    } as typeof original;
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByText("3D rendering unavailable")).toBeVisible();
  await page.getByLabel("Temperature", { exact: true }).fill("110");
  await expect(
    page.getByText("1 active threshold violation", { exact: true }),
  ).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > innerWidth + 1,
  );
  expect(overflow).toBe(false);
  for (const name of [
    "Overview",
    "Machines",
    "Sensor Trends",
    "Fault Alerts",
    "Maintenance Reports",
    "Simulation Settings",
  ]) {
    await page.locator("nav button").filter({ hasText: name }).click();
    await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
  }
});

test("rendered motor moves, pauses, powers off and changes in cutaway mode", async ({
  page,
}) => {
  await page.goto("/");
  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();
  await page.waitForTimeout(1500);
  const movingA = await canvas.screenshot();
  await page.waitForTimeout(200);
  const movingB = await canvas.screenshot();
  expect(movingA.equals(movingB)).toBe(false);
  await page.getByRole("button", { name: "Pause animation" }).click();
  await page.waitForTimeout(500);
  const pausedA = await canvas.screenshot();
  await page.waitForTimeout(200);
  const pausedB = await canvas.screenshot();
  expect(pausedA.equals(pausedB)).toBe(true);
  await page.getByRole("button", { name: "Cutaway", exact: true }).click();
  await page.waitForTimeout(300);
  expect(pausedB.equals(await canvas.screenshot())).toBe(false);
  await page.getByRole("button", { name: "Resume animation" }).click();
  await page.getByRole("switch", { name: "Motor power" }).click();
  await page.waitForTimeout(400);
  const offA = await canvas.screenshot();
  await page.waitForTimeout(200);
  expect(offA.equals(await canvas.screenshot())).toBe(true);
});

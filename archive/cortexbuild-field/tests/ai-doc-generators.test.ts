import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../server/_core/context";

/**
 * Coverage for the document-generator procedures inside the ai
 * sub-router: generateRAMS, generateToolboxTalk, generateInvoice.
 *
 * generateRAMS / generateToolboxTalk are LLM-driven — the load-bearing
 * assertions are about the SHAPE of the prompt and the OUTPUT
 * envelope, not the LLM body.
 *
 * generateInvoice is the highest-stakes here because it does NOT call
 * the LLM at all — it's pure arithmetic over the line items, plus
 * UK CIS (Construction Industry Scheme) deduction. Errors in CIS
 * math cost real money. Six totals contracts:
 *
 *   subtotal           = Σ(qty × unitRate)
 *   vatAmount          = subtotal × vatRate%, or 0 when omitted
 *   grossTotal         = subtotal + vatAmount
 *   cisDeductionAmount = subtotal × (cisRate ?? 20)%, or 0 when no CIS
 *                        (HMRC CIS: deduction on labour element, NEVER on VAT.
 *                        Full compliance also requires excluding materials —
 *                        per-line-item isLabour flag is a separate change.
 *                        The previous formula `grossTotal × cisRate%` was a
 *                        bug that over-deducted by VAT × cisRate%.)
 *   netPayable         = grossTotal − cisDeductionAmount
 *   paymentTerms       = "30 days net" default
 */

interface LlmCall {
  messages: any[];
}
const llmCalls: LlmCall[] = [];
let llmReply: any = {
  id: "test",
  created: Date.now(),
  model: "test-model",
  choices: [{ message: { role: "assistant", content: "stubbed doc body" } }],
};

vi.mock("../server/_core/llm", () => ({
  invokeLLM: vi.fn(async (params: any) => {
    llmCalls.push({ messages: params.messages });
    return llmReply;
  }),
}));

vi.mock("../server/db", () => ({
  getDb: vi.fn(async () => ({
    select() {
      return {
        from() {
          return {
            where() {
              return {
                limit() {
                  return Promise.resolve([
                    { companyRole: "manager", isActive: true },
                  ]);
                },
              };
            },
          };
        },
      };
    },
  })),
}));

const { appRouter } = await import("../server/routers");

function ctxFor(userId: number): TrpcContext {
  return {
    user: {
      id: userId,
      openId: `user-${userId}`,
      name: `User ${userId}`,
      email: `u${userId}@example.com`,
      loginMethod: "manus",
      role: "user",
      passwordHash: null, pushPreferences: {}, createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", hostname: "localhost", headers: {} } as any,
    res: { clearCookie: vi.fn() } as any,
  };
}

beforeEach(() => {
  llmCalls.length = 0;
  llmReply = {
    id: "test",
    created: Date.now(),
    model: "test-model",
    choices: [{ message: { role: "assistant", content: "stubbed doc body" } }],
  };
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("documents.generateRAMS", () => {
  const baseInput = {
    companyId: 7,
    projectName: "Acme HQ",
    projectAddress: "1 Main St, London",
    companyName: "Acme Ltd",
    activity: "Roof replacement",
    scope: "Strip and re-cover existing built-up roof",
  };

  it("uses a UK CDM 2015 / HSE-aware system prompt", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.documents.generateRAMS(baseInput);
    const sys = llmCalls[0].messages.find((m) => m.role === "system");
    expect(sys.content).toMatch(/CDM 2015|HSE|RAMS/i);
  });

  it("embeds project / activity / scope literally in the user prompt", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.documents.generateRAMS(baseInput);
    const userMsg = llmCalls[0].messages.find((m) => m.role === "user");
    expect(userMsg.content).toContain("Acme HQ");
    expect(userMsg.content).toContain("1 Main St, London");
    expect(userMsg.content).toContain("Roof replacement");
    expect(userMsg.content).toContain(
      "Strip and re-cover existing built-up roof",
    );
  });

  it("appends optional sections (personnel / equipment / startDate) only when provided", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.documents.generateRAMS(baseInput);
    const without = llmCalls[0].messages.find((m) => m.role === "user").content;
    expect(without).not.toContain("**Personnel:**");
    expect(without).not.toContain("**Equipment/Plant:**");
    expect(without).not.toContain("**Start Date:**");

    llmCalls.length = 0;
    await caller.documents.generateRAMS({
      ...baseInput,
      personnel: ["Alice", "Bob"],
      equipment: ["Scaffolding", "Telehandler"],
      startDate: "2026-06-01",
    });
    const withAll = llmCalls[0].messages.find((m) => m.role === "user").content;
    expect(withAll).toContain("**Personnel:** Alice, Bob");
    expect(withAll).toContain("**Equipment/Plant:** Scaffolding, Telehandler");
    expect(withAll).toContain("**Start Date:** 2026-06-01");
  });

  it("returns envelope with type / title / content / projectName / generatedAt", async () => {
    llmReply.choices[0].message.content = "## RAMS\n…";
    const caller = appRouter.createCaller(ctxFor(1));
    const result = await caller.documents.generateRAMS(baseInput);
    expect(result.type).toBe("RAMS");
    expect(result.title).toBe("RAMS - Roof replacement - Acme HQ");
    expect(result.content).toBe("## RAMS\n…");
    expect(result.projectName).toBe("Acme HQ");
    expect(result.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe("documents.generateToolboxTalk", () => {
  const baseInput = {
    companyId: 7,
    topic: "Working at height",
    projectName: "Acme HQ",
    companyName: "Acme Ltd",
  };

  it("uses a toolbox-talk system prompt", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.documents.generateToolboxTalk(baseInput);
    const sys = llmCalls[0].messages.find((m) => m.role === "system");
    expect(sys.content).toMatch(/toolbox|safety trainer/i);
  });

  it("defaults duration to '10-15 minutes' and audience to 'All site operatives'", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.documents.generateToolboxTalk(baseInput);
    const userMsg = llmCalls[0].messages.find((m) => m.role === "user").content;
    expect(userMsg).toContain("**Duration:** 10-15 minutes");
    expect(userMsg).toContain("**Audience:** All site operatives");
  });

  it("respects explicit duration / audience / presenter", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.documents.generateToolboxTalk({
      ...baseInput,
      presenter: "Site Manager",
      duration: 25,
      audience: "Steelwork crew",
    });
    const userMsg = llmCalls[0].messages.find((m) => m.role === "user").content;
    expect(userMsg).toContain("**Presenter:** Site Manager");
    expect(userMsg).toContain("**Duration:** 25 minutes");
    expect(userMsg).toContain("**Audience:** Steelwork crew");
  });

  it("envelope includes the topic in the title", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    const result = await caller.documents.generateToolboxTalk(baseInput);
    expect(result.type).toBe("Toolbox Talk");
    expect(result.title).toBe("Toolbox Talk - Working at height");
    expect(result.projectName).toBe("Acme HQ");
  });
});

describe("documents.generateInvoice — pure math, no LLM", () => {
  const baseInput = {
    companyId: 7,
    invoiceNumber: "INV-0001",
    companyName: "Acme Ltd",
    companyAddress: "1 Main St",
    clientName: "BigCo",
    clientAddress: "100 Other St",
    projectName: "Acme HQ",
    invoiceDate: "2026-05-01",
    dueDate: "2026-05-31",
    lineItems: [
      {
        description: "Site supervision",
        quantity: 5,
        unit: "days",
        unitRate: 350,
      },
      { description: "Materials", quantity: 1, unit: "lot", unitRate: 1500 },
    ],
  };

  it("does NOT call invokeLLM (invoice is template + math, not generated)", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.documents.generateInvoice(baseInput);
    expect(llmCalls).toHaveLength(0);
  });

  it("computes subtotal as Σ(qty × unitRate)", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    const result = await caller.documents.generateInvoice(baseInput);
    // 5×350 + 1×1500 = 3250
    expect(result.totals.subtotal).toBe(3250);
  });

  it("vatAmount is subtotal × vatRate%; zero when vatRate omitted", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    const noVat = await caller.documents.generateInvoice(baseInput);
    expect(noVat.totals.vatAmount).toBe(0);
    expect(noVat.totals.grossTotal).toBe(3250);

    const withVat = await caller.documents.generateInvoice({
      ...baseInput,
      vatRate: 20,
    });
    expect(withVat.totals.vatAmount).toBe(650); // 20% of 3250
    expect(withVat.totals.grossTotal).toBe(3900);
  });

  it("CIS deduction defaults to 20% of subtotal when cisDeduction=true and cisRate omitted (HMRC: labour only, never VAT)", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    const result = await caller.documents.generateInvoice({
      ...baseInput,
      vatRate: 20,
      cisDeduction: true,
    });
    // subtotal = 3250; VAT = 650; grossTotal = 3900
    // CIS @ 20% of subtotal 3250 = 650 (NOT of grossTotal — HMRC excludes VAT)
    // netPayable = grossTotal 3900 - CIS 650 = 3250
    expect(result.totals.cisDeductionAmount).toBe(650);
    expect(result.totals.netPayable).toBe(3250);
  });

  it("CIS deduction respects explicit cisRate (CIS-registered subbie at 20%, gross-status at 0%, unverified at 30%)", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    const at30 = await caller.documents.generateInvoice({
      ...baseInput,
      cisDeduction: true,
      cisRate: 30,
    });
    // 30% of 3250 = 975
    expect(at30.totals.cisDeductionAmount).toBe(975);
    expect(at30.totals.netPayable).toBe(3250 - 975);
  });

  it("zero CIS when cisDeduction is false / omitted (gross-status / non-CIS work)", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    const noCis = await caller.documents.generateInvoice(baseInput);
    expect(noCis.totals.cisDeductionAmount).toBe(0);
    expect(noCis.totals.netPayable).toBe(noCis.totals.grossTotal);
  });

  it("netPayable = grossTotal − cisDeductionAmount (composes VAT + CIS correctly, HMRC-compliant)", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    const result = await caller.documents.generateInvoice({
      ...baseInput,
      vatRate: 20,
      cisDeduction: true,
      cisRate: 20,
    });
    // subtotal 3250 + VAT 650 = grossTotal 3900
    // CIS 20% of subtotal 3250 = 650 (HMRC: labour only, no VAT)
    // netPayable = grossTotal 3900 - CIS 650 = 3250
    expect(result.totals.subtotal).toBe(3250);
    expect(result.totals.vatAmount).toBe(650);
    expect(result.totals.grossTotal).toBe(3900);
    expect(result.totals.cisDeductionAmount).toBe(650);
    expect(result.totals.netPayable).toBe(3250);
  });

  it("renders a markdown invoice with project / client / line-items / totals", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    const result = await caller.documents.generateInvoice({
      ...baseInput,
      vatRate: 20,
      cisDeduction: true,
    });
    expect(result.content).toContain("INV-0001");
    expect(result.content).toContain("Acme Ltd");
    expect(result.content).toContain("BigCo");
    expect(result.content).toContain("Site supervision");
    expect(result.content).toContain("£3250.00"); // subtotal AND netPayable (HMRC CIS on subtotal)
    expect(result.content).toContain("£650.00"); // VAT AND cisDeductionAmount (20% of 3250)
    expect(result.content).toContain("£3900.00"); // grossTotal
    expect(result.content).toContain("CIS");
  });

  it("CIS only applies to line items flagged isLabour:true (HMRC: not on materials)", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    const result = await caller.documents.generateInvoice({
      ...baseInput,
      lineItems: [
        { description: "Site supervision", quantity: 5, unit: "days", unitRate: 350, isLabour: true },
        { description: "Materials",       quantity: 1, unit: "lot",  unitRate: 1500, isLabour: false },
      ],
      cisDeduction: true,
      cisRate: 20,
    });
    // labourSubtotal = 5×350 = 1750; materialsSubtotal = 1500
    // CIS @ 20% of labour only = 350  (NOT 650 from full 3250 subtotal)
    expect(result.totals.subtotal).toBe(3250);
    expect(result.totals.cisDeductionAmount).toBe(350);
    expect(result.totals.netPayable).toBe(3250 + 0 - 350); // no VAT in this case
  });

  it("CIS labour-only composes with VAT (subtotal includes both, VAT on full subtotal, CIS on labour)", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    const result = await caller.documents.generateInvoice({
      ...baseInput,
      lineItems: [
        { description: "Labour",    quantity: 10, unit: "hrs", unitRate: 50, isLabour: true  },  // 500
        { description: "Cement",    quantity: 20, unit: "bags", unitRate: 8, isLabour: false },  // 160
        { description: "Apprentice", quantity: 5, unit: "hrs", unitRate: 30, isLabour: true  },  // 150
      ],
      vatRate: 20,
      cisDeduction: true,
      cisRate: 30,
    });
    // subtotal = 500 + 160 + 150 = 810
    // labourSubtotal = 500 + 150 = 650
    // VAT = 20% × 810 = 162
    // grossTotal = 810 + 162 = 972
    // CIS = 30% × 650 = 195   (NOT 30% of 810 = 243)
    // netPayable = 972 - 195 = 777
    expect(result.totals.subtotal).toBe(810);
    expect(result.totals.vatAmount).toBe(162);
    expect(result.totals.grossTotal).toBe(972);
    expect(result.totals.cisDeductionAmount).toBe(195);
    expect(result.totals.netPayable).toBe(777);
  });

  it("isLabour defaults to true (backwards compat — items without the flag are treated as labour)", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    // Same as the historic baseInput — no isLabour flags at all.
    const result = await caller.documents.generateInvoice({
      ...baseInput,
      cisDeduction: true,
      cisRate: 20,
    });
    // Both items default to isLabour:true → CIS = 20% × full subtotal = 650
    // (same value as the legacy "CIS deduction defaults to 20% of subtotal" test)
    expect(result.totals.cisDeductionAmount).toBe(650);
  });

  it("paymentTerms defaults to '30 days net' when omitted", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    const result = await caller.documents.generateInvoice(baseInput);
    expect(result.content).toContain("30 days net");
  });

  it("preserves explicit paymentTerms (e.g. 'Due on receipt')", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    const result = await caller.documents.generateInvoice({
      ...baseInput,
      paymentTerms: "Due on receipt",
    });
    expect(result.content).toContain("Due on receipt");
  });

  it("envelope: type='Invoice', title includes invoiceNumber and projectName", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    const result = await caller.documents.generateInvoice(baseInput);
    expect(result.type).toBe("Invoice");
    expect(result.title).toBe("Invoice INV-0001 - Acme HQ");
    expect(result.invoiceNumber).toBe("INV-0001");
    expect(result.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe("documents.generateTimesheet — CIS status branches", () => {
  const baseInput = {
    companyId: 7,
    workerName: "Alice",
    workerTrade: "Steel-fixer",
    companyName: "Acme Ltd",
    projectName: "Acme HQ",
    weekEnding: "2026-05-07",
    hourlyRate: 25,
    entries: [
      // 5 days × 8h × £25/h = £1000 grossPay
      { date: "Mon", startTime: "08:00", endTime: "16:30", breakMinutes: 30 },
      { date: "Tue", startTime: "08:00", endTime: "16:30", breakMinutes: 30 },
      { date: "Wed", startTime: "08:00", endTime: "16:30", breakMinutes: 30 },
      { date: "Thu", startTime: "08:00", endTime: "16:30", breakMinutes: 30 },
      { date: "Fri", startTime: "08:00", endTime: "16:30", breakMinutes: 30 },
    ],
  };

  it("cisStatus:'none' → 0 deduction (employee timesheet)", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    const result = await caller.documents.generateTimesheet({
      ...baseInput,
      cisStatus: "none",
    });
    expect(result.totals.grossPay).toBe(1000);
    expect(result.content).not.toContain("CIS Deduction");
  });

  it("cisStatus:'gross_payment' → 0 deduction (HMRC-approved gross status)", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    const result = await caller.documents.generateTimesheet({
      ...baseInput,
      cisStatus: "gross_payment",
    });
    expect(result.totals.grossPay).toBe(1000);
    expect(result.content).not.toContain("CIS Deduction");
  });

  it("cisStatus:'registered_20' → 20% of grossPay = £200", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    const result = await caller.documents.generateTimesheet({
      ...baseInput,
      cisStatus: "registered_20",
    });
    expect(result.totals.grossPay).toBe(1000);
    expect(result.content).toContain("| CIS Deduction (20%) | -£200.00 |");
  });

  it("cisStatus:'registered_30' → 30% of grossPay = £300 (unverified subbie)", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    const result = await caller.documents.generateTimesheet({
      ...baseInput,
      cisStatus: "registered_30",
    });
    expect(result.totals.grossPay).toBe(1000);
    expect(result.content).toContain("| CIS Deduction (30%) | -£300.00 |");
  });
});

describe("documents.generateTimesheetSignedOff — CIS status", () => {
  const baseInput = {
    companyId: 7,
    workerName: "Bob",
    projectName: "Acme HQ",
    weekStarting: "2026-05-05",
    totalHours: 40,
    overtimeHours: 0,
    hourlyRate: 25, // grossPay = 40 × 25 = 1000
  };

  it("cisStatus:'gross_payment' → no CIS line in signed timesheet", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    const result = await caller.documents.generateTimesheetSignedOff({
      ...baseInput,
      cisStatus: "gross_payment",
    });
    expect(result.content).not.toContain("CIS Deduction");
  });

  it("cisStatus:'registered_30' → 30% deduction line (£300 from £1000 grossPay)", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    const result = await caller.documents.generateTimesheetSignedOff({
      ...baseInput,
      cisStatus: "registered_30",
    });
    expect(result.content).toContain("CIS Deduction (30%) | -£300.00");
  });
});

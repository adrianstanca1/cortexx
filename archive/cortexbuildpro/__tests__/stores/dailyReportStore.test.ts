import { useDailyReportStore } from "@/stores/dailyReportStore";

describe("dailyReportStore", () => {
  beforeEach(() => {
    const { setReports, setLoading } = useDailyReportStore.getState();
    setReports([]);
    setLoading(false);
  });

  it("should set reports", () => {
    const report = {
      id: "dr1",
      projectId: "p1",
      date: new Date().toISOString(),
      weather: { condition: "clear" as const, temperature: 22 },
      summary: "Foundation pour completed",
      workCompleted: "50m3 concrete poured",
      issues: "None",
      workforce: 8,
      createdBy: "u1",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    useDailyReportStore.getState().setReports([report]);
    expect(useDailyReportStore.getState().reports).toHaveLength(1);
    expect(useDailyReportStore.getState().reports[0].summary).toBe("Foundation pour completed");
  });

  it("should add a report", () => {
    const report = {
      id: "dr1",
      projectId: "p1",
      date: new Date().toISOString(),
      weather: { condition: "clear" as const, temperature: 22 },
      summary: "Foundation pour completed",
      workCompleted: "50m3 concrete poured",
      issues: "None",
      workforce: 8,
      createdBy: "u1",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    useDailyReportStore.getState().addReport(report);
    expect(useDailyReportStore.getState().reports).toHaveLength(1);
  });

  it("should update a report", () => {
    const report = {
      id: "dr1",
      projectId: "p1",
      date: new Date().toISOString(),
      weather: { condition: "clear" as const, temperature: 22 },
      summary: "Foundation pour completed",
      workCompleted: "50m3 concrete poured",
      issues: "None",
      workforce: 8,
      createdBy: "u1",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    useDailyReportStore.getState().addReport(report);
    useDailyReportStore.getState().updateReport("dr1", { workforce: 10 });
    expect(useDailyReportStore.getState().reports[0].workforce).toBe(10);
  });

  it("should remove a report", () => {
    const report = {
      id: "dr1",
      projectId: "p1",
      date: new Date().toISOString(),
      weather: { condition: "clear" as const, temperature: 22 },
      summary: "Foundation pour completed",
      workCompleted: "50m3 concrete poured",
      issues: "None",
      workforce: 8,
      createdBy: "u1",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    useDailyReportStore.getState().addReport(report);
    useDailyReportStore.getState().removeReport("dr1");
    expect(useDailyReportStore.getState().reports).toHaveLength(0);
  });

  it("should set loading state", () => {
    useDailyReportStore.getState().setLoading(true);
    expect(useDailyReportStore.getState().isLoading).toBe(true);
  });
});

import { useRFIStore } from "@/stores/rfiStore";

describe("rfiStore", () => {
  beforeEach(() => {
    const { setRFIs, setLoading } = useRFIStore.getState();
    setRFIs([]);
    setLoading(false);
  });

  it("should set RFIs", () => {
    const rfi = {
      id: "r1",
      projectId: "p1",
      number: "RFI-001",
      title: "Foundation depth",
      status: "draft" as const,
      priority: "high" as const,
      submittedBy: "u1",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    useRFIStore.getState().setRFIs([rfi]);
    expect(useRFIStore.getState().rfis).toHaveLength(1);
    expect(useRFIStore.getState().rfis[0].title).toBe("Foundation depth");
  });

  it("should add an RFI", () => {
    const rfi = {
      id: "r1",
      projectId: "p1",
      number: "RFI-001",
      title: "Foundation depth",
      status: "draft" as const,
      priority: "high" as const,
      submittedBy: "u1",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    useRFIStore.getState().addRFI(rfi);
    expect(useRFIStore.getState().rfis).toHaveLength(1);
  });

  it("should update an RFI", () => {
    const rfi = {
      id: "r1",
      projectId: "p1",
      number: "RFI-001",
      title: "Foundation depth",
      status: "draft" as const,
      priority: "high" as const,
      submittedBy: "u1",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    useRFIStore.getState().addRFI(rfi);
    useRFIStore.getState().updateRFI("r1", { status: "submitted" as const });
    expect(useRFIStore.getState().rfis[0].status).toBe("submitted");
  });

  it("should remove an RFI", () => {
    const rfi = {
      id: "r1",
      projectId: "p1",
      number: "RFI-001",
      title: "Foundation depth",
      status: "draft" as const,
      priority: "high" as const,
      submittedBy: "u1",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    useRFIStore.getState().addRFI(rfi);
    useRFIStore.getState().removeRFI("r1");
    expect(useRFIStore.getState().rfis).toHaveLength(0);
  });

  it("should set loading state", () => {
    useRFIStore.getState().setLoading(true);
    expect(useRFIStore.getState().isLoading).toBe(true);
  });
});

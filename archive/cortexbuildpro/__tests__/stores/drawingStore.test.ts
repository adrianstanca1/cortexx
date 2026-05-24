import { useDrawingStore } from "@/stores/drawingStore";

describe("drawingStore", () => {
  beforeEach(() => {
    const { setDrawings, setLoading } = useDrawingStore.getState();
    setDrawings([]);
    setLoading(false);
  });

  it("should set drawings", () => {
    const drawing = {
      id: "d1",
      projectId: "p1",
      orgId: "o1",
      name: "Ground Floor Plan",
      drawingNumber: "A-101",
      revision: "A",
      revisionDate: new Date().toISOString(),
      discipline: "architectural" as const,
      status: "current" as const,
      uploadedBy: "u1",
      sheetType: "plan" as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    useDrawingStore.getState().setDrawings([drawing]);
    expect(useDrawingStore.getState().drawings).toHaveLength(1);
    expect(useDrawingStore.getState().drawings[0].name).toBe("Ground Floor Plan");
  });

  it("should add a drawing", () => {
    const drawing = {
      id: "d1",
      projectId: "p1",
      orgId: "o1",
      name: "Ground Floor Plan",
      drawingNumber: "A-101",
      revision: "A",
      revisionDate: new Date().toISOString(),
      discipline: "architectural" as const,
      status: "current" as const,
      uploadedBy: "u1",
      sheetType: "plan" as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    useDrawingStore.getState().addDrawing(drawing);
    expect(useDrawingStore.getState().drawings).toHaveLength(1);
  });

  it("should update a drawing", () => {
    const drawing = {
      id: "d1",
      projectId: "p1",
      orgId: "o1",
      name: "Ground Floor Plan",
      drawingNumber: "A-101",
      revision: "A",
      revisionDate: new Date().toISOString(),
      discipline: "architectural" as const,
      status: "current" as const,
      uploadedBy: "u1",
      sheetType: "plan" as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    useDrawingStore.getState().addDrawing(drawing);
    useDrawingStore.getState().updateDrawing("d1", { revision: "B", status: "superseded" as const,
      uploadedBy: "u1" });
    expect(useDrawingStore.getState().drawings[0].revision).toBe("B");
    expect(useDrawingStore.getState().drawings[0].status).toBe("superseded");
  });

  it("should remove a drawing", () => {
    const drawing = {
      id: "d1",
      projectId: "p1",
      orgId: "o1",
      name: "Ground Floor Plan",
      drawingNumber: "A-101",
      revision: "A",
      revisionDate: new Date().toISOString(),
      discipline: "architectural" as const,
      status: "current" as const,
      uploadedBy: "u1",
      sheetType: "plan" as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    useDrawingStore.getState().addDrawing(drawing);
    useDrawingStore.getState().removeDrawing("d1");
    expect(useDrawingStore.getState().drawings).toHaveLength(0);
  });

  it("should set loading state", () => {
    useDrawingStore.getState().setLoading(true);
    expect(useDrawingStore.getState().isLoading).toBe(true);
  });
});

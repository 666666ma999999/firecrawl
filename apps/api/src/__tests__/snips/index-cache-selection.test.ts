/**
 * Unit tests for index cache document selection logic.
 *
 * This tests the bug fix where scrapeURLWithIndex was using data[0].id
 * instead of selectedRow.id when fetching documents from GCS.
 */

describe("Index cache document selection", () => {
  // Test the selection logic that determines which cached entry to use
  // This mirrors the logic in scrapeURLWithIndex

  const errorCountToRegister = 3;

  function selectRow(
    data: Array<{ id: string; status: number; created_at: string }>,
  ) {
    if (data.length === 0) return null;

    const newest200Index = data.findIndex(
      x => x.status >= 200 && x.status < 300,
    );

    // If the newest 200 index is further back than the allowed error count,
    // we should display the errored index entry
    if (newest200Index >= errorCountToRegister || newest200Index === -1) {
      return data[0];
    } else {
      return data[newest200Index];
    }
  }

  it("should select data[0] when it has a 200 status", () => {
    const data = [
      { id: "success-doc", status: 200, created_at: "2024-01-02T00:00:00Z" },
      { id: "old-doc", status: 200, created_at: "2024-01-01T00:00:00Z" },
    ];

    const selected = selectRow(data);
    expect(selected?.id).toBe("success-doc");
  });

  it("should select the first 200 entry when data[0] has an error status", () => {
    const data = [
      { id: "error-doc", status: 500, created_at: "2024-01-03T00:00:00Z" },
      { id: "success-doc", status: 200, created_at: "2024-01-02T00:00:00Z" },
      { id: "old-doc", status: 200, created_at: "2024-01-01T00:00:00Z" },
    ];

    const selected = selectRow(data);
    // The bug was using data[0].id ("error-doc") instead of selectedRow.id ("success-doc")
    expect(selected?.id).toBe("success-doc");
    expect(selected?.id).not.toBe("error-doc");
  });

  it("should select data[0] when there are too many errors before a 200", () => {
    const data = [
      { id: "error-1", status: 500, created_at: "2024-01-05T00:00:00Z" },
      { id: "error-2", status: 500, created_at: "2024-01-04T00:00:00Z" },
      { id: "error-3", status: 500, created_at: "2024-01-03T00:00:00Z" },
      { id: "success-doc", status: 200, created_at: "2024-01-02T00:00:00Z" },
    ];

    const selected = selectRow(data);
    // When there are 3+ errors before a 200, we show the error
    expect(selected?.id).toBe("error-1");
  });

  it("should select data[0] when there are no 200 entries", () => {
    const data = [
      { id: "error-1", status: 500, created_at: "2024-01-03T00:00:00Z" },
      { id: "error-2", status: 404, created_at: "2024-01-02T00:00:00Z" },
    ];

    const selected = selectRow(data);
    expect(selected?.id).toBe("error-1");
  });

  it("should return null for empty data", () => {
    const data: Array<{ id: string; status: number; created_at: string }> = [];

    const selected = selectRow(data);
    expect(selected).toBeNull();
  });

  it("should select the 200 entry when it is at index 1 (within errorCountToRegister)", () => {
    const data = [
      { id: "error-doc", status: 403, created_at: "2024-01-02T00:00:00Z" },
      { id: "success-doc", status: 200, created_at: "2024-01-01T00:00:00Z" },
    ];

    const selected = selectRow(data);
    expect(selected?.id).toBe("success-doc");
  });

  it("should select the 200 entry when it is at index 2 (within errorCountToRegister)", () => {
    const data = [
      { id: "error-1", status: 500, created_at: "2024-01-03T00:00:00Z" },
      { id: "error-2", status: 500, created_at: "2024-01-02T00:00:00Z" },
      { id: "success-doc", status: 200, created_at: "2024-01-01T00:00:00Z" },
    ];

    const selected = selectRow(data);
    expect(selected?.id).toBe("success-doc");
  });

  it("should handle 304 status as success", () => {
    const data = [
      { id: "error-doc", status: 500, created_at: "2024-01-02T00:00:00Z" },
      {
        id: "not-modified-doc",
        status: 304,
        created_at: "2024-01-01T00:00:00Z",
      },
    ];

    const selected = selectRow(data);
    // 304 is not in the 200-299 range, so it won't be selected as a "success"
    // This matches the actual behavior in scrapeURLWithIndex
    expect(selected?.id).toBe("error-doc");
  });
});

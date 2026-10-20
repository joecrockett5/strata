import { describe, expect, it } from "vitest";
import { createDocumentStore } from "./documentStore";

interface Doc {
  title: string;
  items: string[];
}

const make = () => createDocumentStore<Doc>({ title: "A", items: ["x"] }, 1);

describe("document store", () => {
  it("undoes and redoes structural and content changes", () => {
    const store = make();
    store.getState().change("Rename", (d) => {
      d.title = "B";
    });
    store.getState().change("Add", (d) => {
      d.items.push("y");
    });

    store.getState().undo();
    expect(store.getState().doc).toEqual({ title: "B", items: ["x"] });
    store.getState().undo();
    expect(store.getState().doc).toEqual({ title: "A", items: ["x"] });
    store.getState().redo();
    store.getState().redo();
    expect(store.getState().doc).toEqual({ title: "B", items: ["x", "y"] });
  });

  it("coalesces consecutive changes in the same group into one undo step", () => {
    const store = make();
    for (const title of ["H", "He", "Hel", "Hello"]) {
      store.getState().change(
        "Type",
        (d) => {
          d.title = title;
        },
        { group: "title" },
      );
    }

    expect(store.getState().past).toHaveLength(1);
    store.getState().undo();
    expect(store.getState().doc.title).toBe("A");
  });

  it("a new change clears the redo stack", () => {
    const store = make();
    store.getState().change("One", (d) => {
      d.title = "1";
    });
    store.getState().undo();
    store.getState().change("Two", (d) => {
      d.title = "2";
    });

    expect(store.getState().future).toHaveLength(0);
    store.getState().redo();
    expect(store.getState().doc.title).toBe("2");
  });

  it("tracks unsaved versions for autosave", () => {
    const store = make();
    store.getState().change("One", (d) => {
      d.title = "1";
    });
    expect(store.getState().version).toBe(1);
    expect(store.getState().savedVersion).toBe(0);

    store.getState().markSaved(2, 1);
    expect(store.getState()).toMatchObject({ revision: 2, savedVersion: 1 });

    store.getState().undo();
    expect(store.getState().version).toBe(2);
  });

  it("ignores no-op changes", () => {
    const store = make();
    store.getState().change("Nothing", () => {});
    expect(store.getState().past).toHaveLength(0);
    expect(store.getState().version).toBe(0);
  });
});

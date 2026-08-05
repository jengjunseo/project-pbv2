import { describe, expect, it } from "vitest";
import { selectEvictionVictims } from "@/lib/eviction";

describe("selectEvictionVictims", () => {
  it("evicts oldest updated slots first", () => {
    const result = selectEvictionVictims(
      [
        { id: 3, updatedAt: 300, bytes: 40 },
        { id: 1, updatedAt: 100, bytes: 30 },
        { id: 2, updatedAt: 200, bytes: 35 },
      ],
      105,
      50,
      3,
    );

    expect(result.victimIds).toEqual([1, 2]);
    expect(result.remainingBytes).toBe(40);
  });

  it("never chooses the protected just-saved slot", () => {
    const result = selectEvictionVictims(
      [
        { id: 9, updatedAt: 1, bytes: 80 },
        { id: 2, updatedAt: 2, bytes: 30 },
      ],
      110,
      80,
      9,
    );

    expect(result.victimIds).toEqual([2]);
    expect(result.remainingBytes).toBe(80);
  });
});

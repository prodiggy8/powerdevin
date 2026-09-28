import { describe, expect, it } from "vitest";

import {
  FLAG_BOARD_COLUMNS,
  flagBoardColumn,
  groupFlagsByColumn,
} from "@/modules/flags/board";

type State = { environment: "dev" | "staging" | "prod"; enabled: boolean; rolloutPercent: number };

function flag(archived: boolean, states: Partial<Record<State["environment"], [boolean, number]>>) {
  return {
    archived,
    states: Object.entries(states).map(([environment, [enabled, rolloutPercent]]) => ({
      environment: environment as State["environment"],
      enabled,
      rolloutPercent,
    })),
  };
}

describe("flagBoardColumn", () => {
  it("puts a flag that is off everywhere in the first column", () => {
    expect(
      flagBoardColumn(
        flag(false, { dev: [false, 0], staging: [false, 0], prod: [false, 0] }),
      ),
    ).toBe("off");
  });

  it("follows the dev -> staging -> prod lifecycle", () => {
    expect(flagBoardColumn(flag(false, { dev: [true, 100] }))).toBe("dev");
    expect(
      flagBoardColumn(flag(false, { dev: [true, 100], staging: [true, 50] })),
    ).toBe("staging");
  });

  it("separates a partial prod rollout from a full one", () => {
    expect(flagBoardColumn(flag(false, { prod: [true, 25] }))).toBe(
      "rolling_out",
    );
    expect(flagBoardColumn(flag(false, { prod: [true, 100] }))).toBe("live");
  });

  it("ignores a disabled prod state with a leftover rollout percent", () => {
    expect(
      flagBoardColumn(flag(false, { staging: [true, 10], prod: [false, 100] })),
    ).toBe("staging");
  });

  it("puts archived flags in their own column whatever their states", () => {
    expect(flagBoardColumn(flag(true, { prod: [true, 100] }))).toBe("archived");
  });

  it("treats missing states as off", () => {
    expect(flagBoardColumn(flag(false, {}))).toBe("off");
  });
});

describe("groupFlagsByColumn", () => {
  it("returns every column and places each flag exactly once", () => {
    const flags = [
      flag(false, {}),
      flag(false, { dev: [true, 100] }),
      flag(false, { prod: [true, 30] }),
      flag(true, {}),
    ];

    const board = groupFlagsByColumn(flags);

    expect(Object.keys(board)).toEqual([...FLAG_BOARD_COLUMNS]);
    expect(Object.values(board).flat()).toHaveLength(flags.length);
    expect(board.off).toEqual([flags[0]]);
    expect(board.dev).toEqual([flags[1]]);
    expect(board.rolling_out).toEqual([flags[2]]);
    expect(board.archived).toEqual([flags[3]]);
    expect(board.live).toEqual([]);
  });
});

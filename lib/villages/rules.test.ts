import { describe, expect, it } from "vitest";
import { availableVillageKinds, validateVillageName, VILLAGE_NAME_MAX } from "./rules";

describe("validateVillageName", () => {
  it("빈 이름·띄어쓰기만 있는 이름은 안 된다", () => {
    expect(validateVillageName("")).toBe("empty");
    expect(validateVillageName("   ")).toBe("empty");
  });
  it("20자까지는 되고 21자는 안 된다", () => {
    expect(validateVillageName("가".repeat(VILLAGE_NAME_MAX))).toBe("ok");
    expect(validateVillageName("가".repeat(VILLAGE_NAME_MAX + 1))).toBe("tooLong");
  });
  it("앞뒤 띄어쓰기는 글자 수에 넣지 않는다", () => {
    expect(validateVillageName(`  ${"가".repeat(VILLAGE_NAME_MAX)}  `)).toBe("ok");
  });
});

describe("availableVillageKinds", () => {
  it("커플 선택지를 끄면 친구 마을만 남는다", () => {
    expect(availableVillageKinds(true)).toEqual(["friends", "couple"]);
    expect(availableVillageKinds(false)).toEqual(["friends"]);
  });
});

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "../src/App";

describe("app shell", () => {
  it("renders the initial application shell", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { name: "本地个人评分工具" }),
    ).toBeInTheDocument();
  });
});

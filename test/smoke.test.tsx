import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "../src/App";

describe("app shell", () => {
  it("renders the initial application shell", async () => {
    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Taste Ledger" }),
    ).toBeInTheDocument();
  });
});

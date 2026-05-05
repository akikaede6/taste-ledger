import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "../src/App";

describe("app workflow", () => {
  beforeEach(() => {
    delete (window as typeof window & { __rankingMemoryBackend?: unknown })
      .__rankingMemoryBackend;
  });

  it("creates a category, creates a work, and persists reviews", async () => {
    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "本地个人评分工具" }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("新分类"), {
      target: { value: "影视作品" },
    });
    fireEvent.click(screen.getByRole("button", { name: "创建分类" }));

    expect(
      await screen.findByRole("button", { name: /影视作品/ }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("新作品"), {
      target: { value: "作品 A" },
    });
    fireEvent.click(screen.getByRole("button", { name: "创建作品" }));

    expect(
      await screen.findByRole("button", { name: /作品 A/ }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("短评"), {
      target: { value: "短评内容" },
    });
    fireEvent.change(screen.getByLabelText("长评"), {
      target: { value: "第一段\n第二段" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存作品" }));

    fireEvent.click(screen.getByRole("button", { name: /重新载入/ }));

    await waitFor(() => {
      expect(screen.getByText("作品 A")).toBeInTheDocument();
      expect(screen.getByLabelText("短评")).toHaveValue("短评内容");
      expect(screen.getByLabelText("长评")).toHaveValue("第一段\n第二段");
    });
  });
});

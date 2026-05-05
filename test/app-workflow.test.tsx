import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
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

    fireEvent.click(screen.getByRole("button", { name: "添加评分维度" }));
    fireEvent.change(screen.getByLabelText("维度名称 1"), {
      target: { value: "剧情" },
    });
    fireEvent.change(screen.getByLabelText("评分 1"), {
      target: { value: "9" },
    });
    fireEvent.change(screen.getByLabelText("权重 1"), {
      target: { value: "2" },
    });

    fireEvent.click(screen.getByRole("button", { name: "添加评分维度" }));
    fireEvent.change(screen.getByLabelText("维度名称 2"), {
      target: { value: "音乐" },
    });
    fireEvent.change(screen.getByLabelText("评分 2"), {
      target: { value: "8" },
    });
    fireEvent.change(screen.getByLabelText("权重 2"), {
      target: { value: "1" },
    });

    await screen.findByText("当前评分 8.67");

    fireEvent.change(screen.getByLabelText("短评"), {
      target: { value: "短评内容" },
    });
    fireEvent.change(screen.getByLabelText("长评"), {
      target: { value: "第一段\n第二段" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存作品" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /作品 A/ })).toHaveTextContent(
        "8.67 分",
      );
    });

    fireEvent.click(screen.getByRole("button", { name: /重新载入/ }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /作品 A/ }),
      ).toBeInTheDocument();
      expect(screen.getByLabelText("短评")).toHaveValue("短评内容");
      expect(screen.getByLabelText("长评")).toHaveValue("第一段\n第二段");
      expect(screen.getByText("当前评分 8.67")).toBeInTheDocument();
    });
  });

  it("creates an automatic ranking and refreshes it after scoring changes", async () => {
    render(<App />);

    await screen.findByRole("heading", { name: "本地个人评分工具" });

    fireEvent.change(screen.getByLabelText("新分类"), {
      target: { value: "影视作品" },
    });
    fireEvent.click(screen.getByRole("button", { name: "创建分类" }));
    await screen.findByRole("button", { name: /影视作品/ });

    await createScoredWork("作品 A", 8);
    await createScoredWork("作品 B", 10);

    fireEvent.click(screen.getByRole("button", { name: "创建排行" }));

    expect(
      await screen.findByRole("button", { name: /从夯到拉/ }),
    ).toBeInTheDocument();

    await waitFor(() => {
      const rows = within(screen.getByLabelText("排行作品")).getAllByRole(
        "listitem",
      );
      expect(rows[0]).toHaveTextContent("作品 B");
      expect(rows[1]).toHaveTextContent("作品 A");
    });

    fireEvent.click(screen.getByRole("button", { name: /作品 A/ }));
    fireEvent.change(screen.getByLabelText("评分 1"), {
      target: { value: "11" },
    });
    await screen.findByText("当前评分 11");
    fireEvent.click(screen.getByRole("button", { name: "保存作品" }));

    await waitFor(() => {
      const rows = within(screen.getByLabelText("排行作品")).getAllByRole(
        "listitem",
      );
      expect(rows[0]).toHaveTextContent("作品 A");
      expect(rows[1]).toHaveTextContent("作品 B");
    });
  });

  it("exports ranking share images in the displayed order", async () => {
    render(<App />);

    await screen.findByRole("heading", { name: "本地个人评分工具" });

    fireEvent.change(screen.getByLabelText("新分类"), {
      target: { value: "影视作品" },
    });
    fireEvent.click(screen.getByRole("button", { name: "创建分类" }));
    await screen.findByRole("button", { name: /影视作品/ });

    await createScoredWork("作品 A", 8);
    await createScoredWork("作品 B", 10);

    fireEvent.click(screen.getByRole("button", { name: "创建排行" }));
    await screen.findByRole("button", { name: /从夯到拉/ });

    await waitFor(() => {
      const rows = within(screen.getByLabelText("排行作品")).getAllByRole(
        "listitem",
      );
      expect(rows[0]).toHaveTextContent("作品 B");
      expect(rows[1]).toHaveTextContent("作品 A");
    });

    fireEvent.click(screen.getByRole("button", { name: "导出排行长图" }));
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        /已导出：exports\/rankings\/[^/]+-long-\d+\.svg/,
      );
    });
  });

  it("prevents empty ranking share exports", async () => {
    render(<App />);

    await screen.findByRole("heading", { name: "本地个人评分工具" });

    fireEvent.change(screen.getByLabelText("新分类"), {
      target: { value: "影视作品" },
    });
    fireEvent.click(screen.getByRole("button", { name: "创建分类" }));
    await screen.findByRole("button", { name: /影视作品/ });

    fireEvent.click(screen.getByRole("button", { name: "创建排行" }));

    expect(
      await screen.findByRole("button", { name: "导出排行长图" }),
    ).toBeDisabled();
    expect(
      screen.getByText("先添加作品，再导出排行长图。"),
    ).toBeInTheDocument();
  });

  it("exports work share images into the data directory", async () => {
    render(<App />);

    await screen.findByRole("heading", { name: "本地个人评分工具" });

    fireEvent.change(screen.getByLabelText("新分类"), {
      target: { value: "影视作品" },
    });
    fireEvent.click(screen.getByRole("button", { name: "创建分类" }));
    await screen.findByRole("button", { name: /影视作品/ });

    await createScoredWork("作品 A", 8);

    fireEvent.click(screen.getByRole("button", { name: "导出封面图" }));
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        /已导出：exports\/works\/[^/]+-cover-\d+\.svg/,
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "导出长图" }));
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        /已导出：exports\/works\/[^/]+-long-\d+\.svg/,
      );
    });
  });
});

async function createScoredWork(title: string, score: number) {
  fireEvent.change(screen.getByLabelText("新作品"), {
    target: { value: title },
  });
  fireEvent.click(screen.getByRole("button", { name: "创建作品" }));

  expect(
    await screen.findByRole("button", { name: new RegExp(title) }),
  ).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "添加评分维度" }));
  fireEvent.change(screen.getByLabelText("维度名称 1"), {
    target: { value: "剧情" },
  });
  fireEvent.change(screen.getByLabelText("评分 1"), {
    target: { value: String(score) },
  });
  fireEvent.change(screen.getByLabelText("权重 1"), {
    target: { value: "1" },
  });

  await screen.findByText(`当前评分 ${score}`);
  fireEvent.click(screen.getByRole("button", { name: "保存作品" }));

  await waitFor(() => {
    expect(
      screen.getByRole("button", { name: new RegExp(title) }),
    ).toHaveTextContent(`${score} 分`);
  });
}

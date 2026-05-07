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
      await screen.findByRole("heading", { name: "Taste Ledger" }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("新分类"), {
      target: { value: "影视作品" },
    });
    fireEvent.click(screen.getByRole("button", { name: "创建分类" }));

    expect(
      await screen.findByRole("button", { name: /影视作品/ }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "添加评分维度" }));
    fireEvent.change(screen.getByLabelText("维度名称 1"), {
      target: { value: "剧情" },
    });
    fireEvent.change(screen.getByLabelText("权重 1"), {
      target: { value: "2" },
    });

    fireEvent.click(screen.getByRole("button", { name: "添加评分维度" }));
    fireEvent.change(screen.getByLabelText("维度名称 2"), {
      target: { value: "音乐" },
    });
    fireEvent.change(screen.getByLabelText("权重 2"), {
      target: { value: "1" },
    });

    fireEvent.click(screen.getByRole("button", { name: "保存评分维度" }));
    await flushUi();

    fireEvent.change(screen.getByLabelText("新作品"), {
      target: { value: "作品 A" },
    });
    fireEvent.click(screen.getByRole("button", { name: "创建作品" }));

    expect(
      await screen.findByRole("button", { name: /作品 A/ }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("评分 1"), {
      target: { value: "9" },
    });

    fireEvent.change(screen.getByLabelText("评分 2"), {
      target: { value: "8" },
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

    await screen.findByRole("heading", { name: "Taste Ledger" });

    fireEvent.change(screen.getByLabelText("新分类"), {
      target: { value: "影视作品" },
    });
    fireEvent.click(screen.getByRole("button", { name: "创建分类" }));
    await screen.findByRole("button", { name: /影视作品/ });

    fireEvent.click(screen.getByRole("button", { name: "添加评分维度" }));
    fireEvent.change(screen.getByLabelText("维度名称 1"), {
      target: { value: "剧情" },
    });
    fireEvent.change(screen.getByLabelText("权重 1"), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存评分维度" }));
    await flushUi();

    await createScoredWork("作品 A", 8);
    await createScoredWork("作品 B", 10);

    fireEvent.change(screen.getByLabelText("新排行"), {
      target: { value: "作品排行" },
    });
    fireEvent.click(screen.getByRole("button", { name: "创建排行" }));

    expect(
      await screen.findByRole("button", { name: /作品排行/ }),
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

  it("saves work tags and filters works by tag", async () => {
    render(<App />);

    await screen.findByRole("heading", { name: "Taste Ledger" });

    fireEvent.change(screen.getByLabelText("新分类"), {
      target: { value: "动画" },
    });
    fireEvent.click(screen.getByRole("button", { name: "创建分类" }));
    await screen.findByRole("button", { name: /动画/ });

    fireEvent.change(screen.getByLabelText("新作品"), {
      target: { value: "作品 A" },
    });
    fireEvent.click(screen.getByRole("button", { name: "创建作品" }));
    await screen.findByRole("button", { name: /作品 A/ });

    fireEvent.change(screen.getByLabelText("标签"), {
      target: { value: "新番, 原创" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存作品" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /作品 A/ })).toHaveTextContent(
        "新番",
      );
    });

    fireEvent.change(screen.getByLabelText("新作品"), {
      target: { value: "作品 B" },
    });
    fireEvent.click(screen.getByRole("button", { name: "创建作品" }));
    await screen.findByRole("button", { name: /作品 B/ });

    fireEvent.change(screen.getByLabelText("标签"), {
      target: { value: "旧番" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存作品" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /作品 B/ })).toHaveTextContent(
        "旧番",
      );
    });

    const filterBar = screen.getByLabelText("标签筛选");
    fireEvent.click(within(filterBar).getByRole("button", { name: /新番/ }));

    await waitFor(() => {
      const workList = screen.getByLabelText("作品列表");
      expect(
        within(workList).getByRole("button", { name: /作品 A/ }),
      ).toBeInTheDocument();
      expect(
        within(workList).queryByRole("button", { name: /作品 B/ }),
      ).not.toBeInTheDocument();
    });
  });

  it("creates child categories from the parent selector", async () => {
    render(<App />);

    await screen.findByRole("heading", { name: "Taste Ledger" });

    fireEvent.change(screen.getByLabelText("新分类"), {
      target: { value: "动画" },
    });
    fireEvent.click(screen.getByRole("button", { name: "创建分类" }));
    await screen.findByRole("button", { name: /动画/ });

    const parentSelect = screen.getByLabelText("父分类");
    const rootOption = within(parentSelect).getByRole("option", {
      name: "动画",
    }) as HTMLOptionElement;

    fireEvent.change(parentSelect, {
      target: { value: rootOption.value },
    });
    fireEvent.change(screen.getByLabelText("新分类"), {
      target: { value: "2026年1月新番" },
    });
    fireEvent.click(screen.getByRole("button", { name: "创建分类" }));

    const childButton = await screen.findByRole("button", {
      name: /2026年1月新番/,
    });
    fireEvent.click(childButton);

    expect(
      await screen.findByRole("heading", { name: "2026年1月新番" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("评分维度和排行由「动画」共享。"),
    ).toBeInTheDocument();
  });

  it("exports ranking share images in the displayed order", async () => {
    render(<App />);

    await screen.findByRole("heading", { name: "Taste Ledger" });

    fireEvent.change(screen.getByLabelText("新分类"), {
      target: { value: "影视作品" },
    });
    fireEvent.click(screen.getByRole("button", { name: "创建分类" }));
    await screen.findByRole("button", { name: /影视作品/ });

    fireEvent.click(screen.getByRole("button", { name: "添加评分维度" }));
    fireEvent.change(screen.getByLabelText("维度名称 1"), {
      target: { value: "剧情" },
    });
    fireEvent.change(screen.getByLabelText("权重 1"), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存评分维度" }));
    await flushUi();

    await createScoredWork("作品 A", 8);
    await createScoredWork("作品 B", 10);

    fireEvent.change(screen.getByLabelText("新排行"), {
      target: { value: "作品排行" },
    });
    fireEvent.click(screen.getByRole("button", { name: "创建排行" }));
    await screen.findByRole("button", { name: /作品排行/ });

    await waitFor(() => {
      const rows = within(screen.getByLabelText("排行作品")).getAllByRole(
        "listitem",
      );
      expect(rows[0]).toHaveTextContent("作品 B");
      expect(rows[1]).toHaveTextContent("作品 A");
    });

    fireEvent.click(screen.getByRole("button", { name: "导出排行长图" }));
    expect(
      await screen.findByRole("dialog", { name: "排行长图预览" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "导出文件" }));
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        /已开始下载：.+\.(png|svg)/,
      );
    });
  });

  it("prevents empty ranking share exports", async () => {
    render(<App />);

    await screen.findByRole("heading", { name: "Taste Ledger" });

    fireEvent.change(screen.getByLabelText("新分类"), {
      target: { value: "影视作品" },
    });
    fireEvent.click(screen.getByRole("button", { name: "创建分类" }));
    await screen.findByRole("button", { name: /影视作品/ });

    fireEvent.change(screen.getByLabelText("新排行"), {
      target: { value: "空排行" },
    });
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

    await screen.findByRole("heading", { name: "Taste Ledger" });

    fireEvent.change(screen.getByLabelText("新分类"), {
      target: { value: "影视作品" },
    });
    fireEvent.click(screen.getByRole("button", { name: "创建分类" }));
    await screen.findByRole("button", { name: /影视作品/ });

    fireEvent.click(screen.getByRole("button", { name: "添加评分维度" }));
    fireEvent.change(screen.getByLabelText("维度名称 1"), {
      target: { value: "剧情" },
    });
    fireEvent.change(screen.getByLabelText("权重 1"), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存评分维度" }));
    await flushUi();

    await createScoredWork("作品 A", 8);

    fireEvent.click(screen.getByRole("button", { name: "导出封面图" }));
    expect(
      await screen.findByRole("dialog", { name: "作品封面图预览" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "导出文件" }));
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        /已开始下载：.+\.(png|svg)/,
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "导出长图" }));
    expect(
      await screen.findByRole("dialog", { name: "作品长图预览" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "导出文件" }));
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        /已开始下载：.+\.(png|svg)/,
      );
    });
  });

  it("exports a five-level tier image with cover-based placement", async () => {
    render(<App />);

    await screen.findByRole("heading", { name: "Taste Ledger" });

    fireEvent.change(screen.getByLabelText("新分类"), {
      target: { value: "影视作品" },
    });
    fireEvent.click(screen.getByRole("button", { name: "创建分类" }));
    await screen.findByRole("button", { name: /影视作品/ });

    fireEvent.click(screen.getByRole("button", { name: "添加评分维度" }));
    fireEvent.change(screen.getByLabelText("维度名称 1"), {
      target: { value: "剧情" },
    });
    fireEvent.change(screen.getByLabelText("权重 1"), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存评分维度" }));
    await flushUi();

    await createScoredWork("作品 A", 8);
    await createScoredWork("作品 B", 6);

    fireEvent.click(screen.getByRole("button", { name: "创建分级" }));
    await screen.findByRole("button", { name: /五级分级/ });

    fireEvent.change(screen.getByLabelText("移动 作品 A"), {
      target: { value: "tier-1" },
    });
    await waitFor(() => {
      expect(screen.getByLabelText("移动 作品 A")).toHaveValue("tier-1");
    });

    fireEvent.change(screen.getByLabelText("移动 作品 B"), {
      target: { value: "tier-2" },
    });
    await waitFor(() => {
      expect(screen.getByLabelText("移动 作品 B")).toHaveValue("tier-2");
    });

    fireEvent.click(screen.getByRole("button", { name: "导出分级图" }));
    expect(
      await screen.findByRole("dialog", { name: "五级分级预览" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "导出文件" }));
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        /已开始下载：.+\.(png|svg)/,
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

  fireEvent.change(screen.getByLabelText("评分 1"), {
    target: { value: String(score) },
  });

  await screen.findByText(`当前评分 ${score}`);
  fireEvent.click(screen.getByRole("button", { name: "保存作品" }));

  await waitFor(() => {
    expect(
      screen.getByRole("button", { name: new RegExp(title) }),
    ).toHaveTextContent(`${score} 分`);
  });
}

async function flushUi() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

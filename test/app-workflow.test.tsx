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
    delete (window as typeof window & { __tasteLedgerMemoryBackend?: unknown })
      .__tasteLedgerMemoryBackend;
  });

  it("creates a big category, creates a work, and persists reviews", async () => {
    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Taste Ledger" }),
    ).toBeInTheDocument();

    await createRootCategory("影视作品");
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

    await createScoredWork("作品 A", 8);

    fireEvent.change(screen.getByLabelText("短评"), {
      target: { value: "短评内容" },
    });
    fireEvent.change(screen.getByLabelText("长评"), {
      target: { value: "第一段\n第二段" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存作品" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /作品 A/ })).toHaveTextContent(
        "8 分",
      );
    });

    fireEvent.click(screen.getByRole("button", { name: /重新载入/ }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /作品 A/ }),
      ).toBeInTheDocument();
      expect(screen.getByLabelText("短评")).toHaveValue("短评内容");
      expect(screen.getByLabelText("长评")).toHaveValue("第一段\n第二段");
      expect(screen.getByText("当前评分 8")).toBeInTheDocument();
    });
  });

  it("shows a ranking preview and refreshes it after scoring changes", async () => {
    render(<App />);

    await screen.findByRole("heading", { name: "Taste Ledger" });

    await createRootCategory("影视作品");
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

    await waitFor(() => {
      const rows = within(screen.getByLabelText("排名作品")).getAllByRole(
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
      const rows = within(screen.getByLabelText("排名作品")).getAllByRole(
        "listitem",
      );
      expect(rows[0]).toHaveTextContent("作品 A");
      expect(rows[1]).toHaveTextContent("作品 B");
    });
  });

  it("saves work tags and filters works by tag", async () => {
    render(<App />);

    await screen.findByRole("heading", { name: "Taste Ledger" });

    await createRootCategory("动画");
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

  it("creates child categories under the selected big category", async () => {
    render(<App />);

    await screen.findByRole("heading", { name: "Taste Ledger" });

    await createRootCategory("动画");
    await screen.findByRole("button", { name: /动画/ });

    fireEvent.change(screen.getByLabelText("新子分类"), {
      target: { value: "2026年1月新番" },
    });
    fireEvent.click(screen.getByRole("button", { name: "创建子分类" }));

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

  it("exports ranking preview images in the displayed order", async () => {
    render(<App />);

    await screen.findByRole("heading", { name: "Taste Ledger" });

    await createRootCategory("影视作品");
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

    await waitFor(() => {
      const rows = within(screen.getByLabelText("排名作品")).getAllByRole(
        "listitem",
      );
      expect(rows[0]).toHaveTextContent("作品 B");
      expect(rows[1]).toHaveTextContent("作品 A");
    });

    fireEvent.click(screen.getByRole("button", { name: "导出排名图" }));
    expect(
      await screen.findByRole("dialog", { name: "排行预览" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "导出文件" }));
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        /已开始下载：.+\.(png|svg)/,
      );
    });
  });

  it("prevents empty ranking preview exports", async () => {
    render(<App />);

    await screen.findByRole("heading", { name: "Taste Ledger" });

    await createRootCategory("影视作品");
    await screen.findByRole("button", { name: /影视作品/ });

    expect(screen.getByRole("button", { name: "导出排名图" })).toBeDisabled();
    expect(screen.getByText("这个大分类还没有作品。")).toBeInTheDocument();
  });

  it("exports work share images into the data directory", async () => {
    render(<App />);

    await screen.findByRole("heading", { name: "Taste Ledger" });

    await createRootCategory("影视作品");
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

  it("exports a five-level tier image with editable labels and cover placement", async () => {
    render(<App />);

    await screen.findByRole("heading", { name: "Taste Ledger" });

    await createRootCategory("影视作品");
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

    fireEvent.change(screen.getByLabelText("等级 1"), {
      target: { value: "神作" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存分级" }));
    await waitFor(() => {
      expect(screen.getByLabelText("等级 1")).toHaveValue("神作");
    });

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

function createRootCategory(name: string) {
  fireEvent.change(screen.getByLabelText("新大分类"), {
    target: { value: name },
  });
  fireEvent.click(screen.getByRole("button", { name: "创建大分类" }));
}

async function createScoredWork(title: string, score: number) {
  fireEvent.change(screen.getByLabelText("新作品"), {
    target: { value: title },
  });
  fireEvent.click(screen.getByRole("button", { name: "创建作品" }));

  expect(
    await screen.findByRole("button", { name: new RegExp(title) }),
  ).toBeInTheDocument();

  for (const input of screen.getAllByLabelText(/^评分 \d+$/)) {
    fireEvent.change(input, {
      target: { value: String(score) },
    });
  }

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

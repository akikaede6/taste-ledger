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
      await screen.findByRole("button", { name: /^影视作品/ }),
    ).toBeInTheDocument();

    await createScoredWork("作品 A", 8, {
      shortReview: "短评内容",
      longReview: "第一段\n第二段",
    });

    expect(await screen.findByText("短评内容")).toBeInTheDocument();
    expect(screen.getByText("第一段")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /重新载入/ }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "编辑评测" }),
      ).toBeInTheDocument();
      expect(screen.getByText("短评内容")).toBeInTheDocument();
      expect(screen.getByText("第一段")).toBeInTheDocument();
    });
  });

  it("shows a ranking preview and refreshes it after scoring changes", async () => {
    render(<App />);

    await screen.findByRole("heading", { name: "Taste Ledger" });

    await createRootCategory("影视作品");
    await screen.findByRole("button", { name: /^影视作品/ });

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

    fireEvent.click(screen.getByRole("button", { name: "排行榜" }));
    fireEvent.click(screen.getByRole("button", { name: "分值排名" }));

    await waitFor(() => {
      const rows = within(
        screen.getByRole("list", { name: "排名作品" }),
      ).getAllByRole("listitem");
      expect(rows[0]).toHaveTextContent("作品 B");
      expect(rows[1]).toHaveTextContent("作品 A");
    });

    fireEvent.click(screen.getByRole("button", { name: "仪表盘" }));
    fireEvent.click(getWorkButton(/作品 A/));
    fireEvent.click(screen.getByRole("button", { name: "编辑评测" }));
    for (const input of screen.getAllByLabelText(/^评分 \d+$/)) {
      fireEvent.change(input, {
        target: { value: "11" },
      });
    }
    await screen.findByText("当前评分 11");
    fireEvent.click(screen.getByRole("button", { name: "保存作品" }));
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "编辑评测" }),
      ).not.toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "排行榜" }));
    fireEvent.click(screen.getByRole("button", { name: "分值排名" }));

    await waitFor(() => {
      const rows = within(
        screen.getByRole("list", { name: "排名作品" }),
      ).getAllByRole("listitem");
      expect(rows[0]).toHaveTextContent("作品 A");
      expect(rows[1]).toHaveTextContent("作品 B");
    });
  });

  it("saves work tags and filters works by tag", async () => {
    render(<App />);

    await screen.findByRole("heading", { name: "Taste Ledger" });

    await createRootCategory("动画");
    await screen.findByRole("button", { name: /^动画/ });

    await createScoredWork("作品 A", 8, { tags: "新番, 原创" });
    await createScoredWork("作品 B", 7, { tags: "旧番" });

    fireEvent.click(screen.getByRole("button", { name: "仪表盘" }));

    await waitFor(() => {
      expect(getWorkButton(/作品 A/)).toHaveTextContent("新番");
      expect(getWorkButton(/作品 B/)).toHaveTextContent("旧番");
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
    await screen.findByRole("button", { name: /^动画/ });

    fireEvent.click(
      screen.getByRole("button", { name: "在 动画 下创建子分类" }),
    );
    fireEvent.change(screen.getByLabelText("小类名称"), {
      target: { value: "2026年1月新番" },
    });
    fireEvent.click(screen.getByRole("button", { name: "完成创建" }));

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

  it("allows editing a work's big category and subcategory", async () => {
    render(<App />);

    await screen.findByRole("heading", { name: "Taste Ledger" });

    await createRootCategory("动画");
    await screen.findByRole("button", { name: /^动画/ });

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

    fireEvent.click(screen.getByRole("button", { name: "创建大分类" }));
    fireEvent.change(screen.getByLabelText("大类名称"), {
      target: { value: "电影" },
    });
    fireEvent.click(screen.getByRole("button", { name: "确认创建" }));
    await screen.findByRole("button", { name: /^电影/ });

    fireEvent.click(
      screen.getByRole("button", { name: "在 电影 下创建子分类" }),
    );
    fireEvent.change(screen.getByLabelText("小类名称"), {
      target: { value: "院线" },
    });
    fireEvent.click(screen.getByRole("button", { name: "完成创建" }));

    fireEvent.click(screen.getByRole("button", { name: /^动画/ }));
    fireEvent.click(getWorkButton(/作品 A/));
    fireEvent.click(screen.getByRole("button", { name: "编辑评测" }));

    const dialog = await screen.findByRole("dialog", { name: "编辑评测" });
    const rootSelect = within(dialog).getByLabelText("所属大类");

    fireEvent.change(rootSelect, {
      target: { value: selectOptionValue(rootSelect, "电影") },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "保存作品" }));

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "编辑评测" }),
      ).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText("电影")).toBeInTheDocument();
    });
  });

  it("exports ranking preview images in the displayed order", async () => {
    render(<App />);

    await screen.findByRole("heading", { name: "Taste Ledger" });

    await createRootCategory("影视作品");
    await screen.findByRole("button", { name: /^影视作品/ });

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

    fireEvent.click(screen.getByRole("button", { name: "排行榜" }));
    fireEvent.click(screen.getByRole("button", { name: "分值排名" }));

    await waitFor(() => {
      const rows = within(
        screen.getByRole("list", { name: "排名作品" }),
      ).getAllByRole("listitem");
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
    await screen.findByRole("button", { name: /^影视作品/ });

    fireEvent.click(screen.getByRole("button", { name: "排行榜" }));
    fireEvent.click(screen.getByRole("button", { name: "分值排名" }));

    expect(screen.getByRole("button", { name: "导出排名图" })).toBeDisabled();
    expect(screen.getByText("这个大分类还没有作品。")).toBeInTheDocument();
  });

  it("exports work share images into the data directory", async () => {
    render(<App />);

    await screen.findByRole("heading", { name: "Taste Ledger" });

    await createRootCategory("影视作品");
    await screen.findByRole("button", { name: /^影视作品/ });

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

    fireEvent.click(screen.getByRole("button", { name: "导出预览" }));

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
    await screen.findByRole("button", { name: /^影视作品/ });

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

    fireEvent.click(screen.getByRole("button", { name: "排行榜" }));

    fireEvent.click(screen.getByRole("button", { name: "创建分级" }));
    await screen.findByRole("button", { name: /五级分级/ });

    fireEvent.change(screen.getByLabelText("等级 1"), {
      target: { value: "神作" },
    });
    fireEvent.change(screen.getByLabelText("等级 2"), {
      target: { value: "不错" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存分级" }));
    await waitFor(() => {
      expect(screen.getByLabelText("等级 1")).toHaveValue("神作");
      expect(screen.getByLabelText("等级 2")).toHaveValue("不错");
    });

    const dataTransferA = createDataTransfer();
    const workA = screen.getByRole("article", { name: "拖动 作品 A" });
    const dropA = screen.getByRole("region", { name: "等级 神作" });

    fireEvent.dragStart(workA, { dataTransfer: dataTransferA });
    fireEvent.dragOver(dropA, { dataTransfer: dataTransferA });
    fireEvent.drop(dropA, { dataTransfer: dataTransferA });
    fireEvent.dragEnd(workA);
    await waitFor(() => {
      expect(
        within(screen.getByRole("region", { name: "等级 神作" })).getByRole(
          "article",
          { name: "拖动 作品 A" },
        ),
      ).toBeInTheDocument();
    });
    expect(screen.queryByLabelText("移动 作品 A")).not.toBeInTheDocument();

    const dataTransferB = createDataTransfer();
    const workB = screen.getByRole("article", { name: "拖动 作品 B" });
    const dropB = screen.getByRole("region", { name: "等级 不错" });

    fireEvent.dragStart(workB, { dataTransfer: dataTransferB });
    fireEvent.dragOver(dropB, { dataTransfer: dataTransferB });
    fireEvent.drop(dropB, { dataTransfer: dataTransferB });
    fireEvent.dragEnd(workB);
    await waitFor(() => {
      expect(
        within(screen.getByRole("region", { name: "等级 不错" })).getByRole(
          "article",
          { name: "拖动 作品 B" },
        ),
      ).toBeInTheDocument();
    });
    expect(screen.queryByLabelText("移动 作品 B")).not.toBeInTheDocument();

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
  fireEvent.click(screen.getByRole("button", { name: "创建大分类" }));
  fireEvent.change(screen.getByLabelText("大类名称"), {
    target: { value: name },
  });
  fireEvent.click(screen.getByRole("button", { name: "确认创建" }));
}

async function createScoredWork(
  title: string,
  score: number,
  input: { tags?: string; shortReview?: string; longReview?: string } = {},
) {
  fireEvent.click(screen.getByRole("button", { name: "添加作品" }));
  const dialog = await screen.findByRole("dialog", { name: "添加新作品" });
  fireEvent.change(within(dialog).getByLabelText("作品名称"), {
    target: { value: title },
  });
  if (input.tags) {
    fireEvent.change(within(dialog).getByLabelText("标签"), {
      target: { value: input.tags },
    });
  }

  if (input.shortReview) {
    fireEvent.change(within(dialog).getByLabelText("短评"), {
      target: { value: input.shortReview },
    });
  }

  if (input.longReview) {
    fireEvent.change(within(dialog).getByLabelText("长评"), {
      target: { value: input.longReview },
    });
  }

  for (const ratingInput of within(dialog).getAllByLabelText(/^评分 \d+$/)) {
    fireEvent.change(ratingInput, {
      target: { value: String(score) },
    });
  }

  await waitFor(() => {
    expect(within(dialog).getByText(`当前评分 ${score}`)).toBeInTheDocument();
  });

  fireEvent.click(within(dialog).getByRole("button", { name: "保存作品" }));

  await waitFor(() => {
    expect(
      screen.getByRole("button", { name: "编辑评测" }),
    ).toBeInTheDocument();
  });
}

function getWorkButton(name: string | RegExp) {
  return within(screen.getByLabelText("作品列表")).getByRole("button", {
    name,
  });
}

function selectOptionValue(select: HTMLElement, optionLabel: string) {
  const element = select as HTMLSelectElement;
  const option = Array.from(element.options).find(
    (item) => item.textContent === optionLabel,
  );

  if (!option) {
    throw new Error(`Option ${optionLabel} not found.`);
  }

  return option.value;
}

function createDataTransfer() {
  const data = new Map<string, string>();

  return {
    effectAllowed: "move",
    setData(type: string, value: string) {
      data.set(type, value);
    },
    getData(type: string) {
      return data.get(type) ?? "";
    },
    clearData(type?: string) {
      if (type) {
        data.delete(type);
        return;
      }

      data.clear();
    },
  } as unknown as DataTransfer;
}

async function flushUi() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

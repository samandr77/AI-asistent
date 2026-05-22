import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { AppShell } from "../src/components/AppShell";

function renderShell(initialPath = "/today", hideTabBar = false) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AppShell hideTabBar={hideTabBar}>
        <main>Контент страницы</main>
      </AppShell>
    </MemoryRouter>,
  );
}

describe("AppShell", () => {
  it("renders bottom tab-bar with Дом/Задачи/+/Финансы/Здоровье", () => {
    renderShell();
    expect(screen.getByRole("link", { name: /Дом/ })).toHaveAttribute(
      "href",
      "/today",
    );
    expect(screen.getByRole("link", { name: /Задачи/ })).toHaveAttribute(
      "href",
      "/tasks",
    );
    expect(screen.getByRole("link", { name: /Финансы/ })).toHaveAttribute(
      "href",
      "/finance",
    );
    expect(screen.getByRole("link", { name: /Здоровье/ })).toHaveAttribute(
      "href",
      "/health",
    );
    expect(
      screen.getByRole("button", { name: "Открыть AI-ввод" }),
    ).toBeInTheDocument();
  });

  it("renders profile button at top-right", () => {
    renderShell();
    expect(screen.getByRole("link", { name: "Профиль" })).toHaveAttribute(
      "href",
      "/profile",
    );
  });

  it("marks Дом active on /today", () => {
    renderShell("/today");
    expect(screen.getByRole("link", { name: /Дом/ })).toHaveClass("active");
  });

  it("marks Задачи active on /tasks/inbox", () => {
    renderShell("/tasks/inbox");
    expect(screen.getByRole("link", { name: /Задачи/ })).toHaveClass("active");
  });

  it("marks Задачи active on /goals (объединение задач и целей)", () => {
    renderShell("/goals");
    expect(screen.getByRole("link", { name: /Задачи/ })).toHaveClass("active");
  });

  it("marks Финансы active on /finance/budgets", () => {
    renderShell("/finance/budgets");
    expect(screen.getByRole("link", { name: /Финансы/ })).toHaveClass("active");
  });

  it("marks Здоровье active on /health", () => {
    renderShell("/health");
    expect(screen.getByRole("link", { name: /Здоровье/ })).toHaveClass(
      "active",
    );
  });

  it("hides profile button on /profile (already there)", () => {
    renderShell("/profile");
    expect(
      screen.queryByRole("link", { name: "Профиль" }),
    ).not.toBeInTheDocument();
  });

  it("opens AI input sheet when + is pressed", () => {
    const { container } = renderShell();
    const sheet = container.querySelector(".ai-sheet");
    expect(sheet).not.toBeNull();
    expect(sheet).not.toHaveClass("open");

    fireEvent.click(screen.getByRole("button", { name: "Открыть AI-ввод" }));

    expect(container.querySelector(".ai-sheet")).toHaveClass("open");
    expect(
      screen.getByPlaceholderText(/завтра в 10 встреча/),
    ).toBeInTheDocument();
  });

  it("does not render tab-bar or profile button when hideTabBar is set", () => {
    renderShell("/onboarding/setup", true);
    expect(
      screen.queryByRole("button", { name: "Открыть AI-ввод" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Дом/ })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Профиль" }),
    ).not.toBeInTheDocument();
  });
});

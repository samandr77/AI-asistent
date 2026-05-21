import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { AppShell } from "../src/components/AppShell";

function renderShell(initialPath = "/today") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AppShell>
        <main>Контент страницы</main>
      </AppShell>
    </MemoryRouter>,
  );
}

describe("AppShell", () => {
  it("opens the Russian navigation menu from the hamburger button", () => {
    renderShell();

    fireEvent.click(screen.getByRole("button", { name: "Открыть меню" }));

    expect(
      screen.getByRole("navigation", { name: "Разделы приложения" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Сегодня" })).toHaveAttribute(
      "href",
      "/today",
    );
    expect(screen.getByRole("link", { name: "Задачи" })).toHaveAttribute(
      "href",
      "/tasks",
    );
    expect(screen.getByRole("link", { name: "Финансы" })).toHaveAttribute(
      "href",
      "/finance",
    );
  });

  it("marks the current section as active", () => {
    renderShell("/tasks/inbox");

    fireEvent.click(screen.getByRole("button", { name: "Открыть меню" }));

    expect(screen.getByRole("link", { name: "Инбокс" })).toHaveClass("active");
  });
});

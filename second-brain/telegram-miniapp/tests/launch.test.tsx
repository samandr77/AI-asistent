import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { LaunchScreen } from "../src/screens/launch/LaunchScreen";

describe("LaunchScreen", () => {
  it("renders browser preview state without Telegram initData", () => {
    render(
      <MemoryRouter>
        <LaunchScreen />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: /Telegram|Запуск/i })).toBeInTheDocument();
    expect(screen.getByText("Browser preview")).toBeInTheDocument();
  });
});

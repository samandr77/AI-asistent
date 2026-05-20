import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { LaunchScreen } from "../src/screens/launch/LaunchScreen";

describe("LaunchScreen", () => {
  it("renders branded splash with connecting status", () => {
    render(
      <MemoryRouter>
        <LaunchScreen />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", { name: /AI ASSISTANT/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: /AI Assistant/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/Соединяемся/);
  });
});

import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

import { initI18n } from "../src/services/i18n";

initI18n();

afterEach(() => {
  cleanup();
  localStorage.clear();
});

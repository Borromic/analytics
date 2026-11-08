import { act, cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OptOut, isOptedOut, optOut } from "../src/opt-out.js";
import { Analytics } from "../src/react.js";
import { WebVitals } from "../src/vitals.js";
import { freshPage, hidePage, stubNetwork } from "./support.js";

let network: ReturnType<typeof stubNetwork>;

beforeEach(() => {
  freshPage("/");
  network = stubNetwork();
});

afterEach(cleanup);

describe("Analytics", () => {
  it("renders nothing and counts the page once, even in strict mode", () => {
    const { container } = render(
      <StrictMode>
        <Analytics siteKey="site_test" />
      </StrictMode>,
    );
    hidePage();
    expect([container.innerHTML, network.events()]).toEqual([
      "",
      [{ kind: "pageview", path: "/", ago: expect.any(Number) }],
    ]);
  });

  it("uses the latest beforeSend without starting again", () => {
    const { rerender } = render(<Analytics siteKey="site_test" beforeSend={() => null} />);
    rerender(<Analytics siteKey="site_test" beforeSend={(event) => ({ ...event, path: "/changed" })} />);
    hidePage();
    expect(network.events().map((event) => event.path)).toEqual(["/changed"]);
  });

  it("sends events unchanged without beforeSend", () => {
    render(<Analytics siteKey="site_test" />);
    hidePage();
    expect(network.events()[0]?.path).toBe("/");
  });
});

describe("WebVitals", () => {
  it("watches the page's vitals while it is shown", () => {
    const observe = vi.fn();
    vi.stubGlobal(
      "PerformanceObserver",
      class {
        observe = observe;
        disconnect() {}
      },
    );
    const { container } = render(<WebVitals />);
    expect([container.innerHTML, observe.mock.calls.length > 0]).toEqual(["", true]);
  });
});

describe("OptOut", () => {
  it("offers to stop measuring, then to measure again", async () => {
    render(<OptOut />);
    await userEvent.click(screen.getByRole("button", { name: "Stop measuring my visits" }));
    expect(isOptedOut()).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "Measure my visits again" }));
    expect(isOptedOut()).toBe(false);
  });

  it("says what the site asks it to say", () => {
    render(<OptOut stop="Arrêter la mesure" resume="Reprendre la mesure" />);
    expect(screen.getByRole("button").textContent).toBe("Arrêter la mesure");
  });

  it("follows a choice made elsewhere on the page", () => {
    render(<OptOut />);
    act(() => optOut());
    expect(screen.getByRole("button").textContent).toBe("Measure my visits again");
  });

  it("reads as a link unless the site styles it", () => {
    render(
      <>
        <OptOut />
        <OptOut className="privacy-button" />
      </>,
    );
    const [link, styled] = screen.getAllByRole("button");
    expect([link?.style.textDecoration, styled?.getAttribute("style"), styled?.className]).toEqual([
      "underline",
      null,
      "privacy-button",
    ]);
  });
});

import { fireEvent, render } from "@testing-library/react";

import { ChoiceField, type ChoiceOption } from "./ChoiceField";

const OPTIONS: ChoiceOption[] = [
  { label: "System", value: "system" },
  { label: "English", value: "en" },
  { label: "Português (Brasil)", value: "pt-BR" },
  { label: "Español", value: "es" },
  { label: "Deutsch", value: "de" },
  { label: "Français", value: "fr" },
];

function setViewportHeight(height: number) {
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    writable: true,
    value: height,
  });
}

function mockTriggerRect(trigger: HTMLButtonElement, top: number, bottom: number) {
  vi.spyOn(trigger, "getBoundingClientRect").mockReturnValue({
    x: 0,
    y: top,
    width: 280,
    height: bottom - top,
    top,
    right: 280,
    bottom,
    left: 0,
    toJSON: () => ({}),
  } as DOMRect);
}

describe("ChoiceField", () => {
  it("decides upward direction before the first visible click-open render", () => {
    const { container } = render(
      <ChoiceField
        id="language-select"
        label="Language"
        onChange={() => undefined}
        options={OPTIONS}
        value="system"
      />
    );

    setViewportHeight(600);
    const trigger = document.getElementById("language-select") as HTMLButtonElement;
    mockTriggerRect(trigger, 520, 568);

    fireEvent.click(trigger);

    const root = container.querySelector(".choice-field");
    expect(root).toHaveAttribute("data-open", "true");
    expect(root).toHaveAttribute("data-open-upward", "true");
    expect(container.querySelector(".choice-menu")).toBeInTheDocument();
  });

  it("keeps trigger click toggle semantics after the direction precompute", () => {
    const { container } = render(
      <ChoiceField
        id="theme-select"
        label="Theme"
        onChange={() => undefined}
        options={OPTIONS}
        value="system"
      />
    );

    setViewportHeight(900);
    const trigger = document.getElementById("theme-select") as HTMLButtonElement;
    mockTriggerRect(trigger, 120, 168);

    fireEvent.click(trigger);
    expect(container.querySelector(".choice-menu")).toBeInTheDocument();
    expect(container.querySelector(".choice-field")).toHaveAttribute("data-open-upward", "false");

    fireEvent.click(trigger);
    expect(container.querySelector(".choice-menu")).not.toBeInTheDocument();
    expect(container.querySelector(".choice-field")).toHaveAttribute("data-open", "false");
  });

  it("uses the same pre-open direction path for keyboard opening", () => {
    const { container } = render(
      <ChoiceField
        id="keyboard-select"
        label="Language"
        onChange={() => undefined}
        options={OPTIONS}
        value="system"
      />
    );

    setViewportHeight(600);
    const trigger = document.getElementById("keyboard-select") as HTMLButtonElement;
    mockTriggerRect(trigger, 520, 568);

    fireEvent.keyDown(trigger, { key: "Enter" });

    expect(container.querySelector(".choice-field")).toHaveAttribute("data-open", "true");
    expect(container.querySelector(".choice-field")).toHaveAttribute("data-open-upward", "true");
  });
});

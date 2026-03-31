import { type KeyboardEvent as ReactKeyboardEvent, useEffect, useRef, useState } from "react";

export type ChoiceOption = { label: string; value: string };

const MAX_VISIBLE_MENU_OPTIONS = 6;
const ESTIMATED_OPTION_HEIGHT = 44;
const ESTIMATED_MENU_CHROME_HEIGHT = 16;
const MAX_MENU_HEIGHT = 252;

function estimatedMenuHeight(optionCount: number) {
  const visibleOptionCount = Math.min(Math.max(optionCount, 1), MAX_VISIBLE_MENU_OPTIONS);
  const estimatedHeight =
    visibleOptionCount * ESTIMATED_OPTION_HEIGHT + ESTIMATED_MENU_CHROME_HEIGHT;

  return Math.min(estimatedHeight, MAX_MENU_HEIGHT);
}

function shouldOpenUpward(
  triggerRect: Pick<DOMRect, "top" | "bottom">,
  viewportHeight: number,
  menuHeight: number
) {
  const spaceBelow = viewportHeight - triggerRect.bottom;
  const spaceAbove = triggerRect.top;

  return spaceBelow < menuHeight && spaceAbove > spaceBelow;
}

export function ChoiceField({
  disabled,
  id,
  label,
  onChange,
  options,
  value,
}: {
  disabled?: boolean;
  id: string;
  label: string;
  onChange: (value: string) => void;
  options: ChoiceOption[];
  value: string;
}) {
  const [open, setOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const optionRefs = useRef(new Map<string, HTMLButtonElement>());
  const selectedOption = options.find((option) => option.value === value) ?? options[0] ?? null;

  useEffect(() => {
    if (!open) {
      return;
    }

    const root = rootRef.current;

    const handlePointerDown = (event: MouseEvent) => {
      if (!root?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleFocusIn = (event: FocusEvent) => {
      if (!root?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("focusin", handleFocusIn);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("focusin", handleFocusIn);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const updateDirection = () => {
      const trigger = triggerRef.current;
      if (!trigger) {
        return;
      }

      const rect = trigger.getBoundingClientRect();
      const menuHeight =
        menuRef.current?.getBoundingClientRect().height ?? estimatedMenuHeight(options.length);

      setOpenUpward(shouldOpenUpward(rect, window.innerHeight, menuHeight));
    };

    const raf = window.requestAnimationFrame(() => {
      updateDirection();
      optionRefs.current.get(value)?.focus();
    });

    window.addEventListener("resize", updateDirection);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", updateDirection);
    };
  }, [open, options.length, value]);

  useEffect(() => {
    if (disabled && open) {
      setOpen(false);
    }
  }, [disabled, open]);

  function setOptionRef(optionValue: string, node: HTMLButtonElement | null) {
    if (node) {
      optionRefs.current.set(optionValue, node);
      return;
    }

    optionRefs.current.delete(optionValue);
  }

  function focusOption(index: number) {
    const nextOption = options[index];
    if (!nextOption) {
      return;
    }

    optionRefs.current.get(nextOption.value)?.focus();
  }

  function resolveOpenDirection() {
    const trigger = triggerRef.current;
    if (!trigger) {
      return false;
    }

    return shouldOpenUpward(
      trigger.getBoundingClientRect(),
      window.innerHeight,
      estimatedMenuHeight(options.length)
    );
  }

  function openMenu() {
    setOpenUpward(resolveOpenDirection());
    setOpen(true);
  }

  function handleTriggerClick() {
    if (open) {
      setOpen(false);
      return;
    }

    openMenu();
  }

  function handleTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (disabled) {
      return;
    }

    if (
      event.key === "ArrowDown" ||
      event.key === "ArrowUp" ||
      event.key === "Enter" ||
      event.key === " "
    ) {
      event.preventDefault();
      openMenu();
    }
  }

  function handleOptionKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, optionValue: string) {
    const currentIndex = options.findIndex((option) => option.value === optionValue);

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        focusOption(Math.min(currentIndex + 1, options.length - 1));
        return;
      case "ArrowUp":
        event.preventDefault();
        focusOption(Math.max(currentIndex - 1, 0));
        return;
      case "Home":
        event.preventDefault();
        focusOption(0);
        return;
      case "End":
        event.preventDefault();
        focusOption(options.length - 1);
        return;
      case "Enter":
      case " ":
        event.preventDefault();
        setOpen(false);
        if (optionValue !== value) {
          onChange(optionValue);
        }
        return;
      case "Tab":
        setOpen(false);
        return;
      case "Escape":
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
        return;
    }
  }

  return (
    <div
      className="choice-field"
      data-open={open ? "true" : "false"}
      data-open-upward={openUpward ? "true" : "false"}
      ref={rootRef}
    >
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <button
        aria-expanded={open}
        className="choice-trigger"
        data-open={open ? "true" : "false"}
        disabled={disabled || !selectedOption}
        id={id}
        onClick={handleTriggerClick}
        onKeyDown={handleTriggerKeyDown}
        ref={triggerRef}
        type="button"
      >
        <span>{selectedOption?.label ?? ""}</span>
        <span aria-hidden="true" className="choice-caret" />
      </button>

      {open ? (
        <div className="choice-menu" ref={menuRef}>
          {options.map((option) => {
            const selected = option.value === value;

            return (
              <button
                aria-pressed={selected}
                className="choice-option"
                data-selected={selected}
                key={option.value}
                onClick={() => {
                  setOpen(false);
                  if (option.value !== value) {
                    onChange(option.value);
                  }
                }}
                onKeyDown={(event) => handleOptionKeyDown(event, option.value)}
                ref={(node) => setOptionRef(option.value, node)}
                tabIndex={selected ? 0 : -1}
                type="button"
              >
                <span>{option.label}</span>
                <span
                  aria-hidden="true"
                  className="choice-option-indicator"
                  data-selected={selected}
                />
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

import React, { useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { ModalProps } from "react-native";

type Props = Omit<ModalProps, "onRequestClose"> & {
  onRequestClose?: () => void;
};

export function AppModal({
  visible = true,
  children,
  onRequestClose,
  accessibilityLabel = "Dialog",
}: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    if (!visible || !ref.current) return;
    const dialog = ref.current;
    const trigger = document.activeElement;
    // Native dialog moves focus and makes the background inert atomically.
    dialog.showModal();
    return () => {
      dialog.close();
      if (trigger instanceof HTMLElement && trigger.isConnected)
        trigger.focus({ preventScroll: true });
    };
  }, [visible]);

  if (!visible || typeof document === "undefined") return null;
  return createPortal(
    <dialog
      ref={ref}
      aria-label={accessibilityLabel}
      onCancel={(event) => {
        event.preventDefault();
        onRequestClose?.();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            "button, input, select, textarea, a[href], [tabindex]",
          ),
        ).filter(
          (element) =>
            element.tabIndex >= 0 &&
            !element.matches(":disabled, [aria-disabled=true]") &&
            element.getClientRects().length > 0,
        );
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (!first || !last) {
          event.preventDefault();
          return;
        }
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
      style={{
        position: "fixed",
        inset: 0,
        margin: 0,
        padding: 0,
        border: 0,
        width: "100%",
        height: "100%",
        maxWidth: "none",
        maxHeight: "none",
        background: "transparent",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {children}
    </dialog>,
    document.body,
  );
}

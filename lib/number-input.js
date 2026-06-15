import { useEffect } from "react";

/** Prevent mouse wheel from changing a focused number input's value. */
export function onNumberInputWheel(event) {
  event.preventDefault();
}

/** Props to spread onto `<input type="number" />` elements. */
export const numberInputWheelProps = {
  onWheel: onNumberInputWheel,
};

/** Returns wheel-disable props when the input type is number. */
export function numberInputProps(type) {
  return type === "number" ? numberInputWheelProps : {};
}

/** App-wide: block wheel scroll from incrementing/decrementing focused number inputs. */
export function useDisableNumberInputScroll() {
  useEffect(() => {
    const onWheel = (event) => {
      const el = event.target;
      if (el instanceof HTMLInputElement && el.type === "number" && document.activeElement === el) {
        event.preventDefault();
      }
    };
    document.addEventListener("wheel", onWheel, { capture: true, passive: false });
    return () => document.removeEventListener("wheel", onWheel, { capture: true });
  }, []);
}

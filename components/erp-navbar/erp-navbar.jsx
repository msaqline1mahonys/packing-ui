"use client";

import { useNavDock } from "./nav-dock-context";
import { ErpNavUiProvider } from "./nav-ui-context";
import { ErpHorizontalNav } from "./horizontal-nav";
import { ErpVerticalRail } from "./vertical-rail";

function ErpNavbarDockPicker() {
  const { dock } = useNavDock();

  if (dock === "horizontal-top") return <ErpHorizontalNav edge="top" />;
  if (dock === "horizontal-bottom") return <ErpHorizontalNav edge="bottom" />;
  return <ErpVerticalRail edge={dock === "vertical-end" ? "end" : "start"} />;
}

/** Main ERP shell navbar (vertical hover-rail or horizontal bar). Requires `NavDockProvider` above. */
export function ErpNavbar(props) {
  return (
    <ErpNavUiProvider {...props}>
      <ErpNavbarDockPicker />
    </ErpNavUiProvider>
  );
}

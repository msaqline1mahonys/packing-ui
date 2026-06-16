"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { navigateNavHref } from "./nav-path";

export function NavRouteLink({ href, siblingHrefs = [], className, children, onClick, ...props }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <Link
      href={href}
      className={className}
      {...props}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        event.preventDefault();
        navigateNavHref(router, pathname, href, { siblingHrefs });
      }}
    >
      {children}
    </Link>
  );
}

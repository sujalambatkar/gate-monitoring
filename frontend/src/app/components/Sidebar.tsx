"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "◼" },
  { href: "/reports",   label: "Reports",   icon: "≡" },
  { href: "/alerts",    label: "Alerts",    icon: "!" },
];

export default function Sidebar() {
  const path = usePathname();
  const router = useRouter();

  function logout() {
    window.localStorage.removeItem("token");
    router.push("/");
  }

  return (
    <aside className="w-56 min-h-screen bg-surface border-r border-border flex flex-col
                      fixed left-0 top-0 z-40">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-border">
        <div className="w-7 h-7 bg-accent rounded-lg flex items-center justify-center text-sm font-bold">
          S
        </div>
        <span className="font-semibold text-sm tracking-tight">Site Ops Intel</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map(({ href, label, icon }) => {
          const active = path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm
                          transition-colors ${
                            active
                              ? "bg-accent/20 text-accent-light font-medium"
                              : "text-muted hover:bg-border hover:text-white"
                          }`}
            >
              <span className="text-base leading-none">{icon}</span>
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-border">
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm
                     text-muted hover:bg-border hover:text-danger transition-colors"
        >
          <span>←</span> Sign out
        </button>
      </div>
    </aside>
  );
}

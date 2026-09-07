"use client";

import { useEffect } from "react";

export function DemoTheme() {
  useEffect(() => {
    const html = document.documentElement;
    html.classList.add("demo-light");
    html.classList.remove("dark");
    return () => {
      html.classList.remove("demo-light");
      html.classList.add("dark");
    };
  }, []);
  return null;
}

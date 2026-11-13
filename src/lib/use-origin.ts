"use client";

import { useEffect, useState } from "react";

/**
 * The site's origin (e.g. https://example.com), available after mount. Reading
 * window.location during render makes the server and browser output differ
 * (a hydration mismatch); this returns "" on the first render instead.
 */
export function useOrigin(): string {
  const [origin, setOrigin] = useState("");
  useEffect(() => { setOrigin(window.location.origin); }, []);
  return origin;
}

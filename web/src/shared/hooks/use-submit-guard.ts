"use client";

import { useCallback, useState } from "react";

export function useSubmitGuard(cooldownMs = 2500) {
  const [blocked, setBlocked] = useState(false);
  const guard = useCallback(
    (action: () => void) => {
      if (blocked) return false;
      setBlocked(true);
      action();
      setTimeout(() => setBlocked(false), cooldownMs);
      return true;
    },
    [blocked, cooldownMs],
  );
  return { blocked, guard };
}

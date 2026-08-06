import { useEffect } from "react";
import { useBlocker } from "react-router-dom";

const defaultMessage = "You have unsaved changes. Leave this page?";

function useUnsavedChangesPrompt(when, message = defaultMessage, options = {}) {
  const shouldBlock = Boolean(when);
  const allowLeave = options.allowLeave !== false;
  const mode = options.mode || "browser";

  const blocker = useBlocker(({ currentLocation, nextLocation }) => (
    shouldBlock &&
    `${currentLocation.pathname}${currentLocation.search}` !==
      `${nextLocation.pathname}${nextLocation.search}`
  ));

  useEffect(() => {
    if (blocker.state !== "blocked") return;
    if (mode === "inline") return;

    if (!allowLeave) {
      window.alert(message);
      blocker.reset();
      return;
    }

    if (window.confirm(message)) {
      blocker.proceed();
    } else {
      blocker.reset();
    }
  }, [allowLeave, blocker, message, mode]);

  useEffect(() => {
    if (!shouldBlock) return undefined;

    function handleBeforeUnload(event) {
      event.preventDefault();
      event.returnValue = message;
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [message, shouldBlock]);

  return {
    isBlocked: blocker.state === "blocked",
    message,
    proceed: () => blocker.proceed?.(),
    reset: () => blocker.reset?.(),
  };
}

export default useUnsavedChangesPrompt;

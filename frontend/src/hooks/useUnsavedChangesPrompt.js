import { useEffect } from "react";
import { useBlocker } from "react-router-dom";

const defaultMessage = "You have unsaved changes. Leave this page?";

function useUnsavedChangesPrompt(when, message = defaultMessage) {
  const shouldBlock = Boolean(when);

  const blocker = useBlocker(({ currentLocation, nextLocation }) => (
    shouldBlock &&
    `${currentLocation.pathname}${currentLocation.search}` !==
      `${nextLocation.pathname}${nextLocation.search}`
  ));

  useEffect(() => {
    if (blocker.state !== "blocked") return;

    if (window.confirm(message)) {
      blocker.proceed();
    } else {
      blocker.reset();
    }
  }, [blocker, message]);

  useEffect(() => {
    if (!shouldBlock) return undefined;

    function handleBeforeUnload(event) {
      event.preventDefault();
      event.returnValue = message;
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [message, shouldBlock]);
}

export default useUnsavedChangesPrompt;

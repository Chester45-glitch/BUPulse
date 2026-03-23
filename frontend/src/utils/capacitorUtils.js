/**
 * capacitorUtils.js
 * Helpers for detecting and using Capacitor native features.
 */

export const isNative = () => {
  return (
    typeof window !== "undefined" &&
    (
      !!(window.Capacitor?.isNative) ||
      // Fallback: check if running inside Capacitor WebView
      navigator.userAgent.includes("Capacitor") ||
      typeof window.Capacitor !== "undefined"
    )
  );
};

/**
 * Opens OAuth URL:
 * - Native: uses Chrome Custom Tab (closes automatically after deep link fires)
 * - Web: normal redirect
 */
export const openAuthUrl = async (url) => {
  // Always try Capacitor Browser first when Capacitor object exists
  if (typeof window !== "undefined" && typeof window.Capacitor !== "undefined") {
    try {
      const { Browser } = await import("@capacitor/browser");
      await Browser.open({
        url,
        presentationStyle: "fullscreen",
        toolbarColor: "#0f2010",
      });
      return;
    } catch (e) {
      console.warn("Capacitor Browser failed, falling back:", e);
    }
  }
  window.location.href = url;
};

/**
 * Closes the in-app browser (Chrome Custom Tab) after OAuth completes.
 */
export const closeAuthBrowser = async () => {
  if (typeof window !== "undefined" && typeof window.Capacitor !== "undefined") {
    try {
      const { Browser } = await import("@capacitor/browser");
      await Browser.close();
    } catch {}
  }
};

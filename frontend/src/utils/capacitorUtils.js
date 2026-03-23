/**
 * capacitorUtils.js
 */

export const isNative = () =>
  typeof window !== "undefined" && typeof window.Capacitor !== "undefined";

export const openAuthUrl = async (url) => {
  if (isNative()) {
    try {
      const { Browser } = await import("@capacitor/browser");
      // Use "popover" so the app stays alive in background to receive appUrlOpen
      await Browser.open({
        url,
        presentationStyle: "popover",
        toolbarColor: "#0f2010",
      });
      return;
    } catch (e) {
      console.warn("Capacitor Browser failed:", e);
    }
  }
  window.location.href = url;
};

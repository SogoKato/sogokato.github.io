const pyTerminalIds = ["inlinePyTerminal", "sidebarPyTerminal"];

export const pyTerminalExists = (): boolean => {
  for (let i = 0; i < pyTerminalIds.length; i++) {
    const el = document.getElementById(pyTerminalIds[i]);
    if (el !== null) return true;
  }
  return false;
};

export const scrollToPyTerminal = () => {
  for (let i = 0; i < pyTerminalIds.length; i++) {
    const el = document.getElementById(pyTerminalIds[i]);
    if (el !== null) {
      el.scrollIntoView({ behavior: "smooth" });
      return;
    }
  }
};

(() => {
  const themeSelector = document.getElementById("themeSelector");
  const matchTheme = () => {
    if (localStorage.theme === "dark" || (!("theme" in localStorage) && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      document.documentElement.classList.add("dark");
      themeSelector.children[0].src = "/images/light.svg";
      localStorage.theme = "dark";
    } else {
      document.documentElement.classList.remove("dark");
      themeSelector.children[0].src = "/images/dark.svg";
      localStorage.theme = "light";
    }
  };
  matchTheme();
  themeSelector.addEventListener("click", () => {
    localStorage.theme = localStorage.theme === "dark" ? "light" : "dark";
    matchTheme();
  });
})();

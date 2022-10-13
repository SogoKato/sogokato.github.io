(() => {
  const style = document.createElement("style");
  style.innerText = `
    .theme-selector > .theme-selector__light,
    .theme-selector > .theme-selector__dark {
      left: 0;
      position: absolute;
      top: 0;
      transform: scale(0.5) translate(-2.5rem, -1rem);
      transition: all .5s ease-in-out;
    }

    @media screen and (min-width: 640px) {
      .theme-selector {
        position: relative;
      }

      .theme-selector > .theme-selector__light,
      .theme-selector > .theme-selector__dark {
        transform: scale(0.5) translate(-2.5rem, -2.5rem);
      }
    }

    .theme-selector > .theme-selector__light,
    .theme-selector.theme-selector--light > .theme-selector__dark {
      fill: #401a0d;
    }

    .theme-selector > .theme-selector__dark,
    .theme-selector.theme-selector--dark > .theme-selector__light {
      fill: #ffeee8;
    }

    .theme-selector.theme-selector--light > .theme-selector__light,
    .theme-selector.theme-selector--dark > .theme-selector__dark {
      transform: scale(1) translate(0);
    }
  `;
  document.getElementsByTagName("head")[0].insertAdjacentElement("beforeend", style);
  const themeSelector = document.getElementById("themeSelector");
  const matchTheme = () => {
    if (localStorage.theme === "dark" || (!("theme" in localStorage) && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      document.documentElement.classList.add("dark");
      themeSelector.classList.add("theme-selector--dark");
      themeSelector.classList.remove("theme-selector--light");
      localStorage.theme = "dark";
    } else {
      document.documentElement.classList.remove("dark");
      themeSelector.classList.add("theme-selector--light");
      themeSelector.classList.remove("theme-selector--dark");
      localStorage.theme = "light";
    }
  };
  matchTheme();
  themeSelector.addEventListener("click", () => {
    localStorage.theme = localStorage.theme === "dark" ? "light" : "dark";
    matchTheme();
  });
})();

export default function ThemeSelector() {
  const style = document.createElement("style");
  style.innerText = `
    .theme-selector .theme-selector__light,
    .theme-selector .theme-selector__dark {
      left: 0;
      position: absolute;
      top: 0;
      transform: scale(0.5) translate(-2.5rem, -1rem);
      transition: all .5s ease-in-out;
    }

    .theme-selector > .theme-selector__system {
      opacity: 0;
      right: 1.8rem;
      position: absolute;
      bottom: 0.2rem;
    }

    .theme-selector--system > .theme-selector__system {
      opacity: 1;
      word-break: keep-all;
    }

    @media screen and (min-width: 640px) {
      .theme-selector {
        position: relative;
      }

      .theme-selector .theme-selector__light,
      .theme-selector .theme-selector__dark {
        transform: scale(0.5) translate(-2.5rem, -2.5rem);
      }

      .theme-selector > .theme-selector__system  {
        left: 2rem;
        top: -0.8rem;
      }
    }

    .theme-selector .theme-selector__light,
    .theme-selector.theme-selector--light .theme-selector__dark {
      fill: #401a0d;
    }

    .theme-selector .theme-selector__dark,
    .theme-selector.theme-selector--dark .theme-selector__light {
      fill: #ffeee8;
    }

    .theme-selector.theme-selector--light .theme-selector__light,
    .theme-selector.theme-selector--dark .theme-selector__dark {
      transform: scale(1) translate(0);
    }
  `;
  document.getElementsByTagName("head")[0].insertAdjacentElement("beforeend", style);
  const isDark = () => {
    return localStorage.theme === "dark" || (!("theme" in localStorage) && window.matchMedia("(prefers-color-scheme: dark)").matches);
  };
  const isSystem = () => {
    return !("theme" in localStorage);
  };
  const setTheme = () => {
    if (isDark()) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };
  setTheme();
  interface ClassNames {
    add: string[];
    remove: string[];
  }
  const getClassNames = (): ClassNames => {
    const themeSelector = document.getElementById("themeSelector");
    const ret: ClassNames = {
      add: [],
      remove: [],
    };
    if (isDark()) {
      ret.add.push("theme-selector--dark");
      ret.remove.push("theme-selector--light");
    } else {
      ret.add.push("theme-selector--light");
      ret.remove.push("theme-selector--dark");
    }
    if (isSystem()) {
      ret.add.push("theme-selector--system");
    } else {
      ret.remove.push("theme-selector--system");
    }
    return ret;
  };
  const currentTheme = getClassNames().add.join(" ");
  const onClickFunc = () => {
    // light -> dark -> system
    if (localStorage.theme === "light") {
      localStorage.setItem("theme", "dark");
    } else if (localStorage.theme === "dark") {
      localStorage.removeItem("theme");
    } else {
      localStorage.setItem("theme", "light");
    }
    setTheme();
    const classNames = getClassNames();
    const themeSelector = document.getElementById("themeSelector");
    classNames.add.forEach(className => themeSelector?.classList.add(className));
    classNames.remove.forEach(className => themeSelector?.classList.remove(className));
  };
  return (
    <button
      id="themeSelector"
      className={"theme-selector absolute sm:static h-8 right-0 text-center top-0 w-6 sm:w-8 " + currentTheme}
      onClick={onClickFunc}
    >
      <svg className="theme-selector__light" viewBox="0 0 70.1 80.32">
        <g>
          <circle className="cls-1" cx="35.3" cy="40" r="24"/>
          <path className="cls-1" d="M33.57,1l-5.2,9c-.77,1.33,.19,3,1.73,3h10.39c1.54,0,2.5-1.67,1.73-3L37.03,1c-.77-1.33-2.69-1.33-3.46,0Z"/>
          <path className="cls-1" d="M37.03,79.32l5.2-9c.77-1.33-.19-3-1.73-3h-10.39c-1.54,0-2.5,1.67-1.73,3l5.2,9c.77,1.33,2.69,1.33,3.46,0Z"/>
          <path className="cls-1" d="M.27,21.74l5.2,9c.77,1.33,2.69,1.33,3.46,0l5.2-9c.77-1.33-.19-3-1.73-3H2c-1.54,0-2.5,1.67-1.73,3Z"/>
          <path className="cls-1" d="M69.83,57.9l-5.2-9c-.77-1.33-2.69-1.33-3.46,0l-5.2,9c-.77,1.33,.19,3,1.73,3h10.39c1.54,0,2.5-1.67,1.73-3Z"/>
          <path className="cls-1" d="M2,60.9H12.4c1.54,0,2.5-1.67,1.73-3l-5.2-9c-.77-1.33-2.69-1.33-3.46,0L.27,57.9c-.77,1.33,.19,3,1.73,3Z"/>
          <path className="cls-1" d="M68.1,18.74h-10.39c-1.54,0-2.5,1.67-1.73,3l5.2,9c.77,1.33,2.69,1.33,3.46,0l5.2-9c.77-1.33-.19-3-1.73-3Z"/>
        </g>
      </svg>
      <svg className="theme-selector__dark" viewBox="0 0 42.85 46.18">
        <path className="cls-1" d="M26.15,3.33c3.37,4,5.2,9.34,4.57,15.11-.99,9.01-8.15,16.35-17.14,17.55-3.88,.52-7.57-.08-10.81-1.52-1.92-.86-3.64,1.55-2.29,3.16,4.84,5.75,12.32,9.19,20.57,8.45,11.6-1.04,20.92-10.56,21.73-22.18,.74-10.57-5.38-19.81-14.35-23.72-1.93-.84-3.64,1.54-2.28,3.15Z"/>
      </svg>
      <div className="theme-selector__system font-black font-display text-duchs-900 dark:text-duchs-100 text-xs transition-all">AUTO</div>
      <style></style>
    </button>
  );
};

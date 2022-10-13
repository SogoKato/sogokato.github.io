import Image from "next/image";
import Link from "next/link";
import Script from "next/script";

type HeaderProps = {
  className?: string;
};

const Header: React.FC<HeaderProps> = ({ className }) => {
  return (
    <header className={className}>
      <div className="max-w-4xl mt-4 sm:mt-0 mx-auto flex justify-center sm:justify-between h-36 sm:h-48 items-center relative w-11/12">
        <div className="hidden sm:block"></div>
        <Link href="/">
          <a className="w-72 sm:w-auto">
            <Image src="/images/logo.svg" alt="logo" width="480" height="160" />
          </a>
        </Link>
        <button id="themeSelector" className="theme-selector absolute sm:static h-8 right-0 text-center top-0 w-6 sm:w-8">
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
        </button>
      </div>
      <Script src="/js/theme.js" strategy="beforeInteractive" />
    </header>
  );
};

export default Header;

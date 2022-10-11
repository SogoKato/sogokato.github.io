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
        <button id="themeSelector" className="absolute sm:static h-8 right-0 text-center top-0 w-6 sm:w-8">
          <img alt="テーマ切り替え" />
        </button>
      </div>
      <Script src="/js/theme.js" strategy="beforeInteractive" />
    </header>
  );
};

export default Header;

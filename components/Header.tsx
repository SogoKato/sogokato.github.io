import Image from "next/image";
import Link from "next/link";
import Script from "next/script";

type HeaderProps = {
  className?: string;
};

const Header: React.FC<HeaderProps> = ({ className }) => {
  return (
    <header className={className}>
      <div className="max-w-4xl mx-auto flex justify-between items-center h-48">
        <div></div>
        <Link href="/">
          <a>
            <Image src="/images/logo.svg" alt="logo" width="480" height="160" />
          </a>
        </Link>
        <button id="themeSelector" className="h-8 text-center w-8">
          <img alt="テーマ切り替え" />
        </button>
      </div>
      <Script src="/js/theme.js" />
    </header>
  );
};

export default Header;

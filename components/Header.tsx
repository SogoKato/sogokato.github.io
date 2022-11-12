import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";

type HeaderProps = {
  className?: string;
};

const Header: React.FC<HeaderProps> = ({ className }) => {
  const ThemeSelector = dynamic(() => import("./ThemeSelector"), { ssr: false });
  return (
    <header className={className}>
      <div className="max-w-4xl mt-4 sm:mt-0 mx-auto flex justify-center sm:justify-between h-36 sm:h-48 items-center relative w-11/12">
        <div className="hidden sm:block"></div>
        <Link href="/">
          <a className="w-72 sm:w-auto">
            <Image src="/images/logo.svg" alt="logo" width="480" height="160" />
          </a>
        </Link>
        <ThemeSelector />
      </div>
    </header>
  );
};

export default Header;

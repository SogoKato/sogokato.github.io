"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/router";

type HeaderProps = {
  className?: string;
};

const Header: React.FC<HeaderProps> = ({ className }) => {
  const pathname = usePathname();
  const ThemeSelector = dynamic(() => import("./ThemeSelector"), {
    ssr: false,
  });
  const logoImage = (
    <Image src="/images/logo.svg" alt="logo" width="480" height="160" />
  );
  const logo = pathname === "/" ? <h1>{logoImage}</h1> : logoImage;
  return (
    <header className={className}>
      <div className="max-w-4xl mt-4 sm:mt-0 mx-auto flex justify-center sm:justify-between h-36 sm:h-48 items-center relative w-11/12">
        <div className="hidden sm:block"></div>
        <Link href="/" className="w-72 sm:w-auto">
          {logo}
        </Link>
        <ThemeSelector />
      </div>
    </header>
  );
};

export default Header;

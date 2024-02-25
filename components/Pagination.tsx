import Link from "next/link";

type PaginationProps = {
  pages: number[];
  currentPage: number;
  parentPath: string;
  topPath: string;
};

const Pagination: React.FC<PaginationProps> = ({
  pages,
  currentPage,
  parentPath,
  topPath,
}) => {
  const styleColor =
    "bg-duchs-200 hover:bg-duchs-800 text-duchs-900 hover:text-duchs-100 ";
  const styleColorCurrent = "bg-neutral-300 dark:bg-neutral-600 ";
  const styleWidth = "w-11 sm:w-14 ";
  const styleWidthLong = "w-14 sm:w-20 ";
  const className =
    "font-display h-11 sm:h-14 sm:h-14 mb-2 mr-2 sm:mr-5 last:mr-0 px-4 py-2 rounded-full text-xl sm:text-4xl text-center transition-all";
  const elements = pages.map((page) => {
    if (page === currentPage) {
      return (
        <div className={styleColorCurrent + styleWidth + className} key={page}>
          {page}
        </div>
      );
    } else {
      const href = page === 1 ? topPath : `${parentPath}/${page}`;
      return (
        <Link href={href} key={page} className={styleColor + styleWidth + className}>
          <div>{page}</div>
        </Link>
      );
    }
  });
  if (currentPage - 1 > 1) {
    elements.splice(
      0,
      0,
      <Link href={topPath} key={0}className={styleColor + styleWidthLong + className}>
        <div>{"<<"}</div>
      </Link>
    );
  }
  if (currentPage + 1 < pages.length) {
    elements.splice(
      pages.length,
      0,
      <Link href={`${parentPath}/${pages.length}`} key={pages.length + 1} className={styleColor + styleWidthLong + className}>
        <div>{">>"}</div>
      </Link>
    );
  }
  return <div className="flex flex-wrap justify-center">{elements}</div>;
};

export default Pagination;

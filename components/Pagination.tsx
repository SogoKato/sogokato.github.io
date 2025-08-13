import Link from "next/link";

type PaginationProps = {
  pages: number[];
  currentPage: number;
  parentPath: string;
  topPath: string;
};

// must be odd
const MAX_ELEMENTS = 7;

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

  const createPageElement = (page: number, isCurrent = false) => {
    if (isCurrent) {
      return (
        <div className={styleColorCurrent + styleWidth + className} key={page}>
          {page}
        </div>
      );
    }
    
    const href = page === 1 ? topPath : `${parentPath}/${page}`;
    return (
      <Link href={href} key={page} className={styleColor + styleWidth + className}>
        <div>{page}</div>
      </Link>
    );
  };

  const createArrowElement = (direction: 'first' | 'last') => {
    const href = direction === 'first' ? topPath : `${parentPath}/${pages.length}`;
    const symbol = direction === 'first' ? '<<' : '>>';
    const key = direction === 'first' ? 0 : pages.length + 1;
    
    return (
      <Link href={href} key={key} className={styleColor + styleWidthLong + className}>
        <div>{symbol}</div>
      </Link>
    );
  };

  const getVisiblePageRange = () => {
    const totalPages = pages.length;
    const sideItems = Math.floor(MAX_ELEMENTS / 2) - 1;
    
    let start: number;
    let end: number;
    
    if (totalPages <= MAX_ELEMENTS - 2) {
      start = 1;
      end = totalPages;
    } else if (currentPage <= sideItems + 2) {
      start = 1;
      end = MAX_ELEMENTS - 1;
    } else if (currentPage >= totalPages - sideItems - 1) {
      start = totalPages - MAX_ELEMENTS + 2;
      end = totalPages;
    } else {
      start = currentPage - sideItems;
      end = currentPage + sideItems;
    }
    
    return { start, end };
  };

  const buildPaginationElements = () => {
    const { start, end } = getVisiblePageRange();
    const elements: JSX.Element[] = [];
    const sideItems = Math.floor(MAX_ELEMENTS / 2) - 1;
    
    if (currentPage > sideItems + 2) {
      elements.push(createArrowElement('first'));
    }
    
    for (let page = start; page <= end; page++) {
      elements.push(createPageElement(page, page === currentPage));
    }
    
    if (currentPage < pages.length - sideItems - 1) {
      elements.push(createArrowElement('last'));
    }
    
    return elements;
  };

  const elements = buildPaginationElements();

  return <div className="flex flex-wrap justify-center">{elements}</div>;
};

export default Pagination;

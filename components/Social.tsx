import { baseUrl } from "../utils/const";

type SocialProps = {
  className: string;
  path: string;
  text: string;
};

type ShareButtonProps = {
  href: string;
  label: string;
  colorClassName: string;
  iconPath: string;
};

// Icon paths are from Simple Icons (X) and LinkedIn's "in" logo, on a 24x24 viewBox.
const xIconPath =
  "M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z";
const linkedInIconPath =
  "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.71 1.637-1.459 3.37-1.459 3.601 0 4.267 2.37 4.267 4.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z";

const ShareButton: React.FC<ShareButtonProps> = ({
  href,
  label,
  colorClassName,
  iconPath,
}) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    aria-label={label}
    className={`${colorClassName} flex font-display items-center px-3.5 py-0.5 rounded-full text-xs transition-all`}
  >
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={{ fill: "#fafafa", width: 14, height: 14 }}
    >
      <path d={iconPath}></path>
    </svg>
    <div className="ml-1 text-neutral-50">SHARE</div>
  </a>
);

const Social: React.FC<SocialProps> = ({ className, path, text }) => {
  const pageUrl = baseUrl + path;
  const xUrl = new URL("https://x.com/intent/post");
  xUrl.searchParams.set("text", text);
  xUrl.searchParams.set("url", pageUrl);
  // LinkedIn only takes the URL and reads the title from the page's OGP tags.
  const linkedInUrl = new URL("https://www.linkedin.com/sharing/share-offsite/");
  linkedInUrl.searchParams.set("url", pageUrl);
  return (
    <div className={`${className} gap-2`}>
      <ShareButton
        href={xUrl.toString()}
        label="X でシェア"
        colorClassName="bg-black hover:bg-neutral-700 dark:ring-1 dark:ring-neutral-600"
        iconPath={xIconPath}
      />
      <ShareButton
        href={linkedInUrl.toString()}
        label="LinkedIn でシェア"
        colorClassName="bg-[#0a66c2] hover:bg-[#004182]"
        iconPath={linkedInIconPath}
      />
    </div>
  );
};

export default Social;

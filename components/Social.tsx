import { baseUrl } from "../utils/const";

type SocialProps = {
  className: string;
  path: string;
  text: string;
};

const Social: React.FC<SocialProps> = ({ className, path, text }) => {
  const pageUrl = baseUrl + path;
  const twitterUrl = new URL("https://twitter.com/intent/tweet");
  twitterUrl.searchParams.set("text", text);
  twitterUrl.searchParams.set("url", pageUrl);
  return (
    <div className={className}>
      <a href={twitterUrl.toString()} target="_blank" rel="noopener noreferrer">
        <button className="bg-[#1da1f2] hover:bg-[#067acc] flex font-display items-center px-3.5 py-0.5 rounded-full text-duchs-900 hover:text-duchs-100 text-xs transition-all">
          <svg
            viewBox="0 0 20 20"
            style={{ fill: "#fafafa", width: 16, height: 16 }}
          >
            <path d="m6.29 18.12c7.53 0 11.65-6.25 11.65-11.65 0-.18 0-.35 0-.53.8-.58 1.49-1.3 2.04-2.12-.73.33-1.53.54-2.36.65.85-.5 1.49-1.31 1.81-2.27-.79.47-1.67.81-2.6.99-.75-.8-1.81-1.29-2.99-1.29-2.26 0-4.1 1.84-4.1 4.1 0 .32.04.63.1.93-3.4-.17-6.42-1.81-8.44-4.28-.35.61-.55 1.31-.55 2.06 0 1.42.73 2.68 1.82 3.41-.67-.02-1.3-.21-1.85-.51v.06c0 1.98 1.41 3.64 3.28 4.02-.34.1-.7.14-1.08.14-.26 0-.52-.02-.77-.07.52 1.63 2.04 2.81 3.83 2.84-1.41 1.1-3.17 1.76-5.09 1.76-.33 0-.65-.02-.97-.06 1.81 1.15 3.96 1.83 6.27 1.83"></path>
          </svg>
          <div className="ml-1 text-neutral-50">SHARE</div>
        </button>
      </a>
    </div>
  );
};

export default Social;

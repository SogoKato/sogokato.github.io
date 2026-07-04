import Ad from "./Ad";

const PostListAd: React.FC = () => {
  return (
    <div className="bg-white dark:bg-neutral-800 mx-auto mb-6 overflow-hidden pt-6 sm:pt-8 rounded-t-3xl sm:rounded-3xl shadow-lg sm:w-11/12">
      <p className="text-neutral-600 dark:text-neutral-300 px-6 sm:px-8">
        広告
      </p>
      <Ad type="display" format="horizontal" className="mt-4" />
    </div>
  );
};

export default PostListAd;

import Link from "next/link";

type FooterProps = {
  className?: string;
};

const Footer: React.FC<FooterProps> = ({ className }) => {
  return (
    <footer className={className}>
      <div className="flex flex-col items-center py-10">
        <Link href="/privacy" className="mb-2 text-xs">プライバシーポリシー</Link>
        <small>Copyright © {(new Date).getFullYear()} Sogo Kato All rights reserved.</small>
      </div>
    </footer>
  );
};

export default Footer;

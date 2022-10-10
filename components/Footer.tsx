type FooterProps = {
  className?: string;
};

const Footer: React.FC<FooterProps> = ({ className }) => {
  return (
    <footer className={className}>
      <div className="flex justify-center py-10">
        <small>Copyright © {(new Date).getFullYear()} Sogo Kato All rights reserved.</small>
      </div>
    </footer>
  );
};

export default Footer;

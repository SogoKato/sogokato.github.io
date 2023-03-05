import React from "react";

type PyTerminalProps = {
  id?: string;
  className?: string;
  showTitle?: boolean;
  descStyle?: React.CSSProperties;
  linkStyle?: React.CSSProperties;
};

const PyTerminal: React.FC<PyTerminalProps> = ({
  id,
  className,
  showTitle,
  descStyle,
  linkStyle,
}) => {
  if (customElements.get("py-script")) {
    return (
      <div id={id} className={className} style={descStyle}>
        <p>
          🐍 PyScriptを実行するにはページの
          <a style={linkStyle} onClick={() => window.location.reload()}>
            再読み込み
          </a>
          が必要です。
        </p>
      </div>
    );
  }
  // @ts-ignore
  const pyTerminal = <py-terminal></py-terminal>;
  return (
    <div id={id} className={className}>
      <style>{`
      `}</style>
      {showTitle ? <div>ターミナル</div> : null}
      {pyTerminal}
      <small style={descStyle}>
        WebAssembly で実行された Python スクリプトの出力です。
        <a style={linkStyle} href="/posts/2023/03/pyscript-codeblock">
          PyScriptを使ってブログのサンプルコードを実行させる
        </a>
        で解説しています。
      </small>
    </div>
  );
};

export default PyTerminal;

import React from "react";
import { pyTerminalExists, scrollToPyTerminal } from "../utils/pyscript";

type PyReplProps = {
  code: string;
};

const PyRepl: React.FC<PyReplProps> = ({ code }) => {
  const random = Math.random().toString(32).substring(2);
  const outputId = `py-output-${random}`;
  // @ts-ignore
  const pyRepl = <py-repl output={outputId}>{code}</py-repl>;
  const outputDescription = pyTerminalExists() ? (
    <>
      出力はターミナルを確認してください。
      <a
        style={{ color: "inherit", cursor: "pointer" }}
        onClick={scrollToPyTerminal}
      >
        ターミナルの位置に移動
      </a>
    </>
  ) : null;
  return (
    <>
      <style>{`
      .py-repl-run-button {opacity: 1;}
      `}</style>
      <div className="mb-5">
        ▶ボタンをクリックして実行します。書き換えることもできます！
      </div>
      {pyRepl}
      <pre id={outputId}></pre>
      <small style={{ whiteSpace: "pre-wrap" }}>
        WebAssembly で実行されます。{outputDescription}
      </small>
    </>
  );
};

export default PyRepl;

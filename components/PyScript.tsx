"use client";

import React from "react";
import { pyTerminalExists, scrollToPyTerminal } from "../utils/pyscript";

type PyScriptProps = {
  code: string;
};

const PyScript: React.FC<PyScriptProps> = ({ code }) => {
  // @ts-ignore
  const pyScript = <py-script async>{code}</py-script>;
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
      `}</style>
      {pyScript}
      <small style={{ whiteSpace: "pre-wrap" }}>
        WebAssembly で実行されます。{outputDescription}
      </small>
    </>
  );
};

export default PyScript;

import React from "react";

type PyScriptProps = {
  filename: string;
  code: string;
}

const PyScript: React.FC<PyScriptProps> = ({filename, code}) => {
  // @ts-ignore
  const pyScript = <py-script>{code}</py-script>;
  // @ts-ignore
  const pyTerminal = <py-terminal></py-terminal>;
  return (
    <>
      <div className="mt-6">$ python3 {filename}</div>
      {pyScript}
      {pyTerminal}
      <small style={{overflowWrap: "anywhere"}}>この Python スクリプトは Web Assembly で実行されました。<a href="https://pyodide.org/en/stable/">Pyodide</a> および <a href="https://pyscript.net/">PyScript</a> を使用しています。</small>
    </>
  );
}

export default PyScript;

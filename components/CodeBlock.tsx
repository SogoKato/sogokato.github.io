import { YouTubeEmbed } from "@next/third-parties/google";
import { CodeComponent } from "react-markdown/lib/ast-to-react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { tomorrow } from "react-syntax-highlighter/dist/cjs/styles/prism";
import toml from "toml";
import PyConfig from "./PyConfig";
import dynamic from "next/dynamic";

const CodeBlock: CodeComponent = ({ inline, className, children }) => {
  if (inline) {
    return <code className={className}>{children}</code>;
  }
  const match = /language-(\w+)/.exec(className || "");
  const lang = match && match[1] ? match[1] : "";
  const codeBlockParams = className ? className.split(":") : [];
  let filename = codeBlockParams?.length >= 2 ? codeBlockParams[1] : "";
  const code = String(children).replace(/\n$/, "");
  let extra = null;
  if (
    lang === "python" &&
    codeBlockParams.length >= 2 &&
    codeBlockParams.includes("pyscript")
  ) {
    filename = codeBlockParams.length > 2 ? filename : "";
    const PyScript = dynamic(() => import("./PyScript"), { ssr: false });
    extra = <PyScript code={String(children)} />;
  } else if (lang === "pyrepl") {
    const PyRepl = dynamic(() => import("./PyRepl"), { ssr: false });
    return <PyRepl code={code} />;
  } else if (lang === "pyterminal") {
    const PyTerminal = dynamic(() => import("./PyTerminal"), { ssr: false });
    return (
      <PyTerminal
        id="inlinePyTerminal"
        showTitle={true}
        descStyle={{ whiteSpace: "pre-wrap" }}
        linkStyle={{ color: "inherit", cursor: "pointer" }}
      />
    );
  } else if (lang === "pyconfig") {
    type Files = {
      [file: string]: string;
    };
    type Config = {
      files: Files;
    };
    const config: Config = toml.parse(code);
    const files = config.files
      ? Object.values(config.files).map((v: string) => {
          const tmp = v.split("/");
          return `├─ ${tmp[tmp.length - 1]}\n`;
        })
      : [];
    return (
      <>
        <div>{files}</div>
        <PyConfig config={code}></PyConfig>
      </>
    );
  } else if (lang == "youtube") {
    return <YouTubeEmbed videoid={code} />;
  }
  return (
    <>
      <div>{filename}</div>
      <SyntaxHighlighter style={tomorrow} language={lang}>
        {code}
      </SyntaxHighlighter>
      {extra}
    </>
  );
};

export default CodeBlock;

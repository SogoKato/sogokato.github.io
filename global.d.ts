import "react";

declare module "react" {
  // For PyScript's PyEditor
  // see https://docs.pyscript.net/2025.5.1/user-guide/editor/
  interface ScriptHTMLAttributes<T> extends React.HTMLAttributes<T> {
    env?: string;
    output?: string;
  }
}

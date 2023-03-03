import React from "react";

type PyConfigProps = {
  config: string;
};

const PyConfig: React.FC<PyConfigProps> = ({ config }) => {
  // @ts-ignore
  const pyConfig = <py-config>{config}</py-config>;
  return (
    <>
      <style>{`
      py-config, py-splashscreen {display: none;}
      `}</style>
      {pyConfig}
    </>
  );
};

export default PyConfig;

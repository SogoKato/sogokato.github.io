import fs from "fs";

export type SummaryIndex = {
  [ref: string]: {
    fileHash: string;
    embedding: number[];
    summary: string;
  };
};

const INDEX_FILE = "data/index.json";

export const loadSummaryIndex = (): SummaryIndex => {
  try {
    const fileContent = fs.readFileSync(INDEX_FILE, "utf-8");
    return JSON.parse(fileContent);
  } catch {
    return {};
  }
};

export const saveSummaryIndex = (data: SummaryIndex) => {
  const fileContent = JSON.stringify(data);
  fs.writeFileSync(INDEX_FILE, fileContent);
};

/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: "https://sogo.dev",
  generateRobotsTxt: true,
  robotsTxtOptions: {
    transformRobotsTxt: async (_, robotsTxt) => {
      const contentSignal = "Content-Signal: ai-train=yes, search=yes, ai-input=yes"
      return `${robotsTxt.trimEnd()}\n${contentSignal}\n`
    },
  },
  output: "export",
  outDir: "out",
}

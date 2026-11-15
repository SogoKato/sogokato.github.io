/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: "https://sogo.dev",
  // public/assets holds files for posts, including standalone demo pages (e.g. a PWA's index.html).
  // next-sitemap 4 lists those HTML files too; they are not articles, so keep them out of the sitemap.
  exclude: ["/assets/*"],
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

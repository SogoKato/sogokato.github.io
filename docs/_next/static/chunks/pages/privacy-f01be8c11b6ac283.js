(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[915],{21640:function(e,t,n){(window.__NEXT_P=window.__NEXT_P||[]).push(["/privacy",function(){return n(10883)}])},29862:function(e,t,n){"use strict";n.d(t,{Z:function(){return w}});var r=n(11527),s=n(14711),l=n.n(s),a=n(73438),i=n.n(a),c=n(26760),o=n(27106),d=n(27710),p=n(96861),x=n(45217),h=n(33859),u=n.n(h);n(50959);var m=e=>{let{config:t}=e,n=(0,r.jsx)("py-config",{children:t});return(0,r.jsxs)(r.Fragment,{children:[(0,r.jsx)("style",{children:"\n      py-config, py-splashscreen {display: none;}\n      "}),n]})},j=e=>{let{inline:t,className:s,children:a}=e;if(t)return(0,r.jsx)("code",{className:s,children:a});let i=/language-(\w+)/.exec(s||""),c=i&&i[1]?i[1]:"",o=s?s.split(":"):[],d=(null==o?void 0:o.length)>=2?o[1]:"",h=String(a).replace(/\n$/,""),j=null;if("python"===c&&o.length>=2&&o.includes("pyscript")){d=o.length>2?d:"";let e=l()(()=>n.e(535).then(n.bind(n,14535)),{loadableGenerated:{webpack:()=>[14535]},ssr:!1});j=(0,r.jsx)(e,{code:String(a)})}else if("pyrepl"===c){let e=l()(()=>n.e(717).then(n.bind(n,30717)),{loadableGenerated:{webpack:()=>[30717]},ssr:!1});return(0,r.jsx)(e,{code:h})}else if("pyterminal"===c){let e=l()(()=>n.e(21).then(n.bind(n,54021)),{loadableGenerated:{webpack:()=>[54021]},ssr:!1});return(0,r.jsx)(e,{id:"inlinePyTerminal",showTitle:!0,descStyle:{whiteSpace:"pre-wrap"},linkStyle:{color:"inherit",cursor:"pointer"}})}else if("pyconfig"===c){let e=u().parse(h),t=e.fetch?e.fetch.map(e=>{let t=e.to_file.split("/");return"├─ ".concat(t[t.length-1])}).join("\n"):[];return(0,r.jsxs)(r.Fragment,{children:[(0,r.jsx)("div",{children:t}),(0,r.jsx)(m,{config:h})]})}return(0,r.jsxs)(r.Fragment,{children:[(0,r.jsx)("div",{children:d}),(0,r.jsx)(p.Z,{style:x.Ro,language:c,children:h}),j]})},g=n(16176),f=n(58184),y=n(20683),b=e=>{let{className:t,path:n,text:s}=e,l=y.FH+n,a=new URL("https://twitter.com/intent/tweet");return a.searchParams.set("text",s),a.searchParams.set("url",l),(0,r.jsx)("div",{className:t,children:(0,r.jsx)("a",{href:a.toString(),target:"_blank",rel:"noopener noreferrer",children:(0,r.jsxs)("button",{className:"bg-[#1da1f2] hover:bg-[#067acc] flex font-display items-center px-3.5 py-0.5 rounded-full text-duchs-900 hover:text-duchs-100 text-xs transition-all",children:[(0,r.jsx)("svg",{viewBox:"0 0 20 20",style:{fill:"#fafafa",width:16,height:16},children:(0,r.jsx)("path",{d:"m6.29 18.12c7.53 0 11.65-6.25 11.65-11.65 0-.18 0-.35 0-.53.8-.58 1.49-1.3 2.04-2.12-.73.33-1.53.54-2.36.65.85-.5 1.49-1.31 1.81-2.27-.79.47-1.67.81-2.6.99-.75-.8-1.81-1.29-2.99-1.29-2.26 0-4.1 1.84-4.1 4.1 0 .32.04.63.1.93-3.4-.17-6.42-1.81-8.44-4.28-.35.61-.55 1.31-.55 2.06 0 1.42.73 2.68 1.82 3.41-.67-.02-1.3-.21-1.85-.51v.06c0 1.98 1.41 3.64 3.28 4.02-.34.1-.7.14-1.08.14-.26 0-.52-.02-.77-.07.52 1.63 2.04 2.81 3.83 2.84-1.41 1.1-3.17 1.76-5.09 1.76-.33 0-.65-.02-.97-.06 1.81 1.15 3.96 1.83 6.27 1.83"})}),(0,r.jsx)("div",{className:"ml-1 text-neutral-50",children:"SHARE"})]})})})},w=e=>{let{className:t,post:s,isStaticPostPage:a}=e,p=a?null:(0,r.jsxs)("p",{className:"text-neutral-600 dark:text-neutral-300",children:[s.date.getFullYear(),"年",s.date.getMonth()+1,"月",s.date.getDate(),"日"]}),x=(0,r.jsx)(g.Z,{className:"mt-5",tags:s.tags}),h="font-bold leading-tight mb-5 text-2xl sm:text-3xl",u=(0,f.D)(s),m=u?(0,r.jsx)("h1",{className:"mt-8 "+h,children:s.title}):(0,r.jsx)("h2",{className:"mt-5 "+h,children:s.title}),y=u?(0,r.jsx)(c.D,{remarkPlugins:[d.Z],rehypePlugins:[o.Z],components:{code:j},children:s.content}):(0,r.jsx)("p",{className:"line-clamp-3 my-5 text-neutral-600 dark:text-neutral-300",children:s.desc}),w=l()(()=>n.e(72).then(n.bind(n,78072)),{loadableGenerated:{webpack:()=>[78072]},ssr:!1}),v=a?null:(0,r.jsx)(b,{className:"flex justify-end",path:s.ref,text:"".concat(s.title,"\n")}),N=u?(0,r.jsxs)("div",{children:[p,m,v,(0,r.jsx)("div",{className:"mb-16 mt-8 "+t,children:y}),a?null:(0,r.jsx)(w,{path:s.ref}),x,(0,r.jsx)(i(),{src:"https://pyscript.net/latest/pyscript.js",strategy:"lazyOnload"})]}):(0,r.jsxs)("div",{children:[(0,r.jsxs)("a",{className:"block",href:s.ref,children:[p,m,y]}),x]}),_="bg-white dark:bg-neutral-800 mx-auto mb-6 p-6 sm:p-8 shadow-lg sm:w-11/12";return(0,r.jsx)("div",{className:u?"rounded-3xl "+_:"rounded-t-3xl sm:rounded-3xl "+_,children:N})}},59899:function(e,t,n){"use strict";var r=n(11527),s=n(34673),l=n.n(s),a=n(20683);t.Z=e=>{let{title:t,description:n,path:s,type:i}=e;return(0,r.jsxs)(l(),{children:[(0,r.jsx)("title",{children:t}),(0,r.jsx)("meta",{name:"description",content:n}),(0,r.jsx)("meta",{httpEquiv:"content-language",content:"ja"}),(0,r.jsx)("meta",{property:"og:url",content:a.FH+s}),(0,r.jsx)("meta",{property:"og:type",content:i}),(0,r.jsx)("meta",{property:"og:title",content:t}),(0,r.jsx)("meta",{property:"og:description",content:n}),(0,r.jsx)("meta",{property:"og:site_name",content:a.y7}),(0,r.jsx)("meta",{property:"og:image",content:a.FH+"/images/ogp-image.jpg"}),(0,r.jsx)("meta",{name:"twitter:card",content:"summary"})]})}},10883:function(e,t,n){"use strict";n.r(t),n.d(t,{__N_SSG:function(){return c}});var r=n(11527),s=n(29862),l=n(59899),a=n(20683),i=n(88868),c=!0;t.default=e=>{let{post:t}=e,n=(0,i.d)(t);return(0,r.jsxs)("article",{children:[(0,r.jsx)(l.Z,{title:"".concat(t.title," - ").concat(a.y7),description:a.JG,path:"/privacy",type:"article"}),(0,r.jsx)(s.Z,{className:"max-w-none prose dark:prose-invert prose-pre:m-0 prose-neutral prose-pre:px-2 prose-pre:py-1",post:n,isStaticPostPage:!0})]})}},58184:function(e,t){"use strict";t.D=void 0,t.D=function(e){return"object"==typeof e&&null!==e&&"string"==typeof e.content}}},function(e){e.O(0,[505,888,774,179],function(){return e(e.s=21640)}),_N_E=e.O()}]);
(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[50],{53020:function(e,t,s){(window.__NEXT_P=window.__NEXT_P||[]).push(["/posts/[...slug]",function(){return s(49830)}])},29862:function(e,t,s){"use strict";s.d(t,{Z:function(){return w}});var n=s(11527),l=s(14711),r=s.n(l),a=s(73438),c=s.n(a),i=s(26760),d=s(27106),o=s(27710),x=s(96861),u=s(45217),h=s(33859),p=s.n(h);s(50959);var m=e=>{let{config:t}=e,s=(0,n.jsx)("py-config",{children:t});return(0,n.jsxs)(n.Fragment,{children:[(0,n.jsx)("style",{children:"\n      py-config, py-splashscreen {display: none;}\n      "}),s]})},j=e=>{let{inline:t,className:l,children:a}=e;if(t)return(0,n.jsx)("code",{className:l,children:a});let c=/language-(\w+)/.exec(l||""),i=c&&c[1]?c[1]:"",d=l?l.split(":"):[],o=(null==d?void 0:d.length)>=2?d[1]:"",h=String(a).replace(/\n$/,""),j=null;if("python"===i&&d.length>=2&&d.includes("pyscript")){o=d.length>2?o:"";let e=r()(()=>s.e(535).then(s.bind(s,14535)),{loadableGenerated:{webpack:()=>[14535]},ssr:!1});j=(0,n.jsx)(e,{code:String(a)})}else if("pyrepl"===i){let e=r()(()=>s.e(717).then(s.bind(s,30717)),{loadableGenerated:{webpack:()=>[30717]},ssr:!1});return(0,n.jsx)(e,{code:h})}else if("pyterminal"===i){let e=r()(()=>s.e(21).then(s.bind(s,54021)),{loadableGenerated:{webpack:()=>[54021]},ssr:!1});return(0,n.jsx)(e,{id:"inlinePyTerminal",showTitle:!0,descStyle:{whiteSpace:"pre-wrap"},linkStyle:{color:"inherit",cursor:"pointer"}})}else if("pyconfig"===i){let e=p().parse(h),t=e.fetch?e.fetch.map(e=>{let t=e.to_file.split("/");return"├─ ".concat(t[t.length-1])}).join("\n"):[];return(0,n.jsxs)(n.Fragment,{children:[(0,n.jsx)("div",{children:t}),(0,n.jsx)(m,{config:h})]})}return(0,n.jsxs)(n.Fragment,{children:[(0,n.jsx)("div",{children:o}),(0,n.jsx)(x.Z,{style:u.Ro,language:i,children:h}),j]})},f=s(16176),g=s(58184),y=s(20683),v=e=>{let{className:t,path:s,text:l}=e,r=y.FH+s,a=new URL("https://twitter.com/intent/tweet");return a.searchParams.set("text",l),a.searchParams.set("url",r),(0,n.jsx)("div",{className:t,children:(0,n.jsx)("a",{href:a.toString(),target:"_blank",rel:"noopener noreferrer",children:(0,n.jsxs)("button",{className:"bg-[#1da1f2] hover:bg-[#067acc] flex font-display items-center px-3.5 py-0.5 rounded-full text-duchs-900 hover:text-duchs-100 text-xs transition-all",children:[(0,n.jsx)("svg",{viewBox:"0 0 20 20",style:{fill:"#fafafa",width:16,height:16},children:(0,n.jsx)("path",{d:"m6.29 18.12c7.53 0 11.65-6.25 11.65-11.65 0-.18 0-.35 0-.53.8-.58 1.49-1.3 2.04-2.12-.73.33-1.53.54-2.36.65.85-.5 1.49-1.31 1.81-2.27-.79.47-1.67.81-2.6.99-.75-.8-1.81-1.29-2.99-1.29-2.26 0-4.1 1.84-4.1 4.1 0 .32.04.63.1.93-3.4-.17-6.42-1.81-8.44-4.28-.35.61-.55 1.31-.55 2.06 0 1.42.73 2.68 1.82 3.41-.67-.02-1.3-.21-1.85-.51v.06c0 1.98 1.41 3.64 3.28 4.02-.34.1-.7.14-1.08.14-.26 0-.52-.02-.77-.07.52 1.63 2.04 2.81 3.83 2.84-1.41 1.1-3.17 1.76-5.09 1.76-.33 0-.65-.02-.97-.06 1.81 1.15 3.96 1.83 6.27 1.83"})}),(0,n.jsx)("div",{className:"ml-1 text-neutral-50",children:"SHARE"})]})})})},w=e=>{let{className:t,post:l,isStaticPostPage:a}=e,x=a?null:(0,n.jsxs)("p",{className:"text-neutral-600 dark:text-neutral-300",children:[l.date.getFullYear(),"年",l.date.getMonth()+1,"月",l.date.getDate(),"日"]}),u=(0,n.jsx)(f.Z,{className:"mt-5",tags:l.tags}),h="font-bold leading-tight mb-5 text-2xl sm:text-3xl",p=(0,g.D)(l),m=p?(0,n.jsx)("h1",{className:"mt-8 "+h,children:l.title}):(0,n.jsx)("h2",{className:"mt-5 "+h,children:l.title}),y=p?(0,n.jsx)(i.D,{remarkPlugins:[o.Z],rehypePlugins:[d.Z],components:{code:j},children:l.content}):(0,n.jsx)("p",{className:"line-clamp-3 my-5 text-neutral-600 dark:text-neutral-300",children:l.desc}),w=r()(()=>s.e(72).then(s.bind(s,78072)),{loadableGenerated:{webpack:()=>[78072]},ssr:!1}),b=a?null:(0,n.jsx)(v,{className:"flex justify-end",path:l.ref,text:"".concat(l.title,"\n")}),N=p?(0,n.jsxs)("div",{children:[x,m,b,(0,n.jsx)("div",{className:"mb-16 mt-8 "+t,children:y}),a?null:(0,n.jsx)(w,{path:l.ref}),u,(0,n.jsx)(c(),{src:"https://pyscript.net/latest/pyscript.js",strategy:"lazyOnload"})]}):(0,n.jsxs)("div",{children:[(0,n.jsxs)("a",{className:"block",href:l.ref,children:[x,m,y]}),u]}),k="bg-white dark:bg-neutral-800 mx-auto mb-6 p-6 sm:p-8 shadow-lg sm:w-11/12";return(0,n.jsx)("div",{className:p?"rounded-3xl "+k:"rounded-t-3xl sm:rounded-3xl "+k,children:N})}},59899:function(e,t,s){"use strict";var n=s(11527),l=s(34673),r=s.n(l),a=s(20683);t.Z=e=>{let{title:t,description:s,path:l,type:c}=e;return(0,n.jsxs)(r(),{children:[(0,n.jsx)("title",{children:t}),(0,n.jsx)("meta",{name:"description",content:s}),(0,n.jsx)("meta",{httpEquiv:"content-language",content:"ja"}),(0,n.jsx)("meta",{property:"og:url",content:a.FH+l}),(0,n.jsx)("meta",{property:"og:type",content:c}),(0,n.jsx)("meta",{property:"og:title",content:t}),(0,n.jsx)("meta",{property:"og:description",content:s}),(0,n.jsx)("meta",{property:"og:site_name",content:a.y7}),(0,n.jsx)("meta",{property:"og:image",content:a.FH+"/images/ogp-image.jpg"}),(0,n.jsx)("meta",{name:"twitter:card",content:"summary"})]})}},49830:function(e,t,s){"use strict";s.r(t),s.d(t,{__N_SSG:function(){return x},default:function(){return u}});var n=s(11527),l=s(29862),r=s(23700),a=s.n(r),c=e=>{let{className:t,post:s,isNext:l}=e,r="bg-duchs-200 group-hover:bg-duchs-800 flex items-center justify-center h-14 mx-5 first:ml-0 last:mr-0 px-3 rounded-full shrink-0 transition-all w-14",c="fill-duchs-900 group-hover:fill-duchs-100",i="0 0 10.19 8.33",d=(0,n.jsx)("svg",{className:c,viewBox:i,children:(0,n.jsx)("g",{children:(0,n.jsx)("path",{d:"M.31,4.9c-.11-.11-.19-.23-.24-.35s-.07-.25-.07-.37c0-.13,.02-.26,.07-.38s.13-.24,.24-.35L3.45,.32c.09-.09,.19-.17,.29-.23s.22-.09,.36-.09,.27,.03,.4,.09,.24,.14,.33,.24,.17,.21,.23,.33,.08,.25,.08,.38-.03,.25-.08,.35-.13,.21-.23,.3l-.87,.89c-.11,.11-.22,.22-.34,.32s-.24,.19-.36,.28h5.99c.15,0,.29,.03,.4,.08s.22,.12,.3,.21,.14,.2,.18,.32,.06,.25,.06,.39-.02,.26-.06,.38-.1,.22-.18,.31-.18,.16-.3,.21-.25,.08-.4,.08H3.42c.12,.09,.25,.18,.37,.28s.23,.2,.34,.32l.76,.79c.1,.1,.18,.2,.23,.31s.08,.22,.08,.34c0,.14-.03,.28-.1,.41s-.15,.25-.26,.36-.22,.19-.36,.25-.27,.09-.4,.09c-.12,0-.23-.03-.34-.08s-.21-.13-.31-.23L.31,4.9Z"})})}),o=(0,n.jsx)("svg",{className:c,viewBox:i,children:(0,n.jsx)("g",{children:(0,n.jsx)("path",{d:"M6.77,3.16c-.12-.09-.25-.18-.37-.28s-.23-.2-.34-.32l-.76-.79c-.1-.1-.18-.2-.23-.31s-.08-.22-.08-.34c0-.14,.03-.28,.1-.41s.15-.25,.26-.36,.22-.19,.36-.25,.27-.09,.4-.09c.12,0,.23,.03,.34,.08s.21,.13,.31,.23l3.12,3.12c.11,.11,.19,.23,.24,.35s.07,.25,.07,.37c0,.13-.02,.26-.07,.38s-.13,.24-.24,.35l-3.13,3.13c-.09,.09-.19,.17-.29,.23s-.22,.09-.36,.09-.27-.03-.4-.09-.24-.14-.33-.24-.17-.21-.23-.33-.08-.25-.08-.38,.03-.25,.08-.35,.13-.21,.23-.3l.87-.89c.11-.11,.22-.22,.34-.32s.24-.19,.36-.28H.95c-.15,0-.29-.03-.4-.08s-.22-.12-.3-.21-.14-.2-.18-.32-.06-.25-.06-.39,.02-.26,.06-.38,.1-.22,.18-.31,.18-.16,.3-.21,.25-.08,.4-.08H6.77Z"})})});return(0,n.jsx)("div",{className:t,children:(0,n.jsxs)(a(),{href:s.ref,className:"dark:hover:bg-neutral-600 hover:bg-neutral-300 flex group items-center rounded-full transition-all"+(l?"":" justify-end"),children:[l?(0,n.jsx)("div",{className:r,children:d}):null,(0,n.jsxs)("div",{className:"shrink"+(l?"":" text-end"),children:[(0,n.jsx)("p",{className:"line-clamp-1 mb-1",children:s.title}),(0,n.jsxs)("p",{className:"text-neutral-500",children:[s.date.getFullYear(),"年",s.date.getMonth()+1,"月",s.date.getDate(),"日"]})]}),l?null:(0,n.jsx)("div",{className:r,children:o})]})})},i=s(59899),d=s(20683),o=s(88868),x=!0,u=e=>{let{posts:t,post:s}=e,r=(0,o.d)(s),a=t.map(e=>e.ref).indexOf(s.ref);if(-1===a)throw Error("Could not find current post.");let x=a>0?(0,o.d)(t[a-1]):null,u=a<t.length-1?(0,o.d)(t[a+1]):null;return(0,n.jsxs)("article",{children:[(0,n.jsx)(i.Z,{title:"".concat(s.title," - ").concat(d.y7),description:s.desc,path:s.ref,type:"article"}),(0,n.jsx)(l.Z,{className:"max-w-none prose dark:prose-invert prose-pre:m-0 prose-neutral prose-pre:px-2 prose-pre:py-1",post:r}),(0,n.jsxs)("div",{className:"flex flex-col sm:flex-row justify-between mx-auto w-11/12",children:[x?(0,n.jsx)(c,{className:"mb-4 sm:mb-0 w-full sm:w-1/2",post:x,isNext:!0}):(0,n.jsx)("div",{}),u?(0,n.jsx)(c,{className:"w-full sm:w-1/2",post:u,isNext:!1}):(0,n.jsx)("div",{})]})]})}},58184:function(e,t){"use strict";t.D=void 0,t.D=function(e){return"object"==typeof e&&null!==e&&"string"==typeof e.content}}},function(e){e.O(0,[505,888,774,179],function(){return e(e.s=53020)}),_N_E=e.O()}]);
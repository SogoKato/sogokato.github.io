(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[405],{5335:function(t,e,s){(window.__NEXT_P=window.__NEXT_P||[]).push(["/",function(){return s(4138)}])},3172:function(t,e,s){"use strict";var a=s(1527),n=s(143),r=s.n(n),c=function(t){var e=t.pages,s=t.currentPage,n=t.parentPath,c=t.topPath,i="bg-duchs-200 hover:bg-duchs-800 text-duchs-900 hover:text-duchs-100 ",l="w-14 ",o="w-20 ",d="font-display h-14 mr-5 last:mr-0 px-4 py-2 rounded-full text-4xl text-center transition-all",h=e.map(function(t){if(t===s)return(0,a.jsx)("div",{className:"bg-neutral-300 dark:bg-neutral-600 "+l+d,children:t},t);var e=1===t?c:"".concat(n,"/").concat(t);return(0,a.jsx)(r(),{href:e,children:(0,a.jsx)("a",{className:i+l+d,children:(0,a.jsx)("div",{children:t})})},t)});return s-1>1&&h.splice(0,0,(0,a.jsx)(r(),{href:c,children:(0,a.jsx)("a",{className:i+o+d,children:(0,a.jsx)("div",{children:"<<"})})},0)),s+1<e.length&&h.splice(e.length,0,(0,a.jsx)(r(),{href:"".concat(n,"/").concat(e.length),children:(0,a.jsx)("a",{className:i+o+d,children:(0,a.jsx)("div",{children:">>"})})},e.length+1)),(0,a.jsx)("div",{className:"flex justify-center",children:h})};e.Z=c},1565:function(t,e,s){"use strict";var a=s(1527),n=s(7889),r=s.n(n),c=s(3331),i=s.n(c),l=s(7945),o=s(7710),d=s(1996),h=function(t){var e=t.className,n=t.post,c=t.isPostPage,i=t.isStaticPostPage,h=i?null:(0,a.jsxs)("p",{children:[n.date.getFullYear(),"年",n.date.getMonth()+1,"月",n.date.getDate(),"日"]}),x=(0,a.jsx)(d.Z,{className:"mb-1",tags:n.tags}),p=(0,a.jsx)(d.Z,{className:"mt-3",tags:n.tags}),j="font-bold mt-3 text-4xl",g=c?(0,a.jsx)("h1",{className:"mb-3 "+j,children:n.title}):(0,a.jsx)("h2",{className:j,children:n.title}),f=c?(0,a.jsx)(l.D,{remarkPlugins:[o.Z],children:n.content}):(0,a.jsx)("p",{className:"line-clamp-3 my-5 text-neutral-600 dark:text-neutral-300",children:n.desc}),b=i?null:(0,a.jsxs)("div",{className:"flex",children:[u,m]}),v=r()(function(){return s.e(715).then(s.bind(s,9715))},{loadableGenerated:{webpack:function(){return[9715]}},ssr:!1}),y=c?(0,a.jsxs)("div",{children:[h,g,x,b,(0,a.jsx)("div",{className:"my-5 "+e,children:f}),i?null:(0,a.jsx)(v,{}),b,p]}):(0,a.jsxs)("div",{children:[(0,a.jsxs)("a",{className:"block",href:n.ref,children:[h,g,f]}),p]});return(0,a.jsx)("div",{className:"bg-white dark:bg-neutral-700 mx-auto mb-11 p-8 rounded-3xl shadow-lg w-11/12",children:y})},u=(0,a.jsxs)("div",{className:"mr-2",children:[(0,a.jsx)("a",{href:"https://twitter.com/share?ref_src=twsrc%5Etfw",className:"twitter-share-button","data-show-count":"false",children:"Tweet"}),(0,a.jsx)(i(),{async:!0,src:"https://platform.twitter.com/widgets.js",strategy:"afterInteractive"})]}),m=(0,a.jsxs)("div",{className:"mr-2",children:[(0,a.jsx)("a",{href:"https://b.hatena.ne.jp/entry/",className:"hatena-bookmark-button","data-hatena-bookmark-layout":"basic-label-counter","data-hatena-bookmark-lang":"ja",title:"このエントリーをはてなブックマークに追加",children:(0,a.jsx)("img",{src:"https://b.st-hatena.com/images/v4/public/entry-button/button-only@2x.png",alt:"このエントリーをはてなブックマークに追加",width:"20",height:"20",style:{border:"none"}})}),(0,a.jsx)(i(),{async:!0,type:"text/javascript",src:"https://b.st-hatena.com/js/bookmark_button.js"})]});e.Z=h},5702:function(t,e,s){"use strict";var a=s(1527),n=s(1161),r=s.n(n),c=s(426),i=function(t){var e=t.title,s=t.description,n=t.path,i=t.type;return(0,a.jsxs)(r(),{children:[(0,a.jsx)("title",{children:e}),(0,a.jsx)("meta",{name:"description",content:s}),(0,a.jsx)("meta",{property:"og:url",content:c.FH+n}),(0,a.jsx)("meta",{property:"og:type",content:i}),(0,a.jsx)("meta",{property:"og:title",content:e}),(0,a.jsx)("meta",{property:"og:description",content:s}),(0,a.jsx)("meta",{property:"og:site_name",content:c.y7}),(0,a.jsx)("meta",{property:"og:image",content:c.FH+"/images/ogp-image.jpg"}),(0,a.jsx)("meta",{name:"twitter:card",content:"summary"})]})};e.Z=i},4138:function(t,e,s){"use strict";s.r(e),s.d(e,{__N_SSG:function(){return d}});var a=s(1527),n=s(3172),r=s(1565),c=s(5702),i=s(426),l=s(1443),o=function(t){var e=t.slicedPosts,s=t.pages,o=e.map(function(t,e){var s=(0,l.D)(t);return(0,a.jsx)(r.Z,{post:s,isPostPage:!1},e)});return(0,a.jsxs)("div",{children:[(0,a.jsx)(c.Z,{title:i.y7,description:i.JG,path:"/",type:"website"}),o,(0,a.jsx)(n.Z,{pages:s,currentPage:1,parentPath:"/page",topPath:"/"})]})},d=!0;e.default=o}},function(t){t.O(0,[947,774,888,179],function(){return t(t.s=5335)}),_N_E=t.O()}]);